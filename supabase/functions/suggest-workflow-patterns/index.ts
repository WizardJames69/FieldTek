// ============================================================
// Suggest Workflow Patterns — Edge Function
// ============================================================
// Batch pattern detection: reads from workflow_diagnostic_statistics,
// clusters chains by (equipment_type, symptom), scores clusters,
// and generates suggested workflow templates for admin review.
//
// Invoked manually from admin UI. Behind 'workflow_pattern_discovery'
// feature flag.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { DiagnosticChain } from "./types.ts";
import {
  clusterChains,
  scoreCluster,
  MIN_CLUSTER_SCORE,
  MIN_SUPPORTING_JOBS,
  MAX_SUGGESTIONS_PER_RUN,
} from "./cluster.ts";
import { generateSuggestion } from "./generate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, supabaseKey);

    // ── 1. Check feature flag ──────────────────────────────────
    const { data: flag } = await client
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "workflow_pattern_discovery")
      .maybeSingle();

    if (!flag?.is_enabled) {
      return new Response(
        JSON.stringify({ error: "workflow_pattern_discovery feature flag is disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Refresh diagnostic statistics ───────────────────────
    const { error: aggErr } = await client.rpc("aggregate_diagnostic_patterns", {
      p_tenant_id: tenant_id,
    });
    if (aggErr) {
      console.warn("[suggest-patterns] aggregate_diagnostic_patterns error:", aggErr.message);
    }

    // ── 3. Fetch clusterable chains ────────────────────────────
    const { data: chainData, error: chainErr } = await client.rpc("fetch_clusterable_chains", {
      p_tenant_id: tenant_id,
    });

    if (chainErr) {
      console.error("[suggest-patterns] fetch_clusterable_chains error:", chainErr.message);
      return new Response(
        JSON.stringify({ error: chainErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chains: DiagnosticChain[] = chainData || [];
    if (chains.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          clusters_found: 0,
          suggestions_created: 0,
          latency_ms: Date.now() - start,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Cluster and score ───────────────────────────────────
    const rawClusters = clusterChains(chains);
    const scoredClusters = rawClusters
      .map(scoreCluster)
      .filter((c) => c.cluster_score >= MIN_CLUSTER_SCORE)
      .sort((a, b) => b.cluster_score - a.cluster_score)
      .slice(0, MAX_SUGGESTIONS_PER_RUN);

    console.log(`[suggest-patterns] ${chains.length} chains → ${rawClusters.length} clusters → ${scoredClusters.length} above threshold`);

    // ── 5. Upsert clusters ─────────────────────────────────────
    let clustersUpserted = 0;
    const clusterIdMap = new Map<string, string>();

    for (const cluster of scoredClusters) {
      const { data: upserted, error: upsertErr } = await client
        .from("workflow_pattern_clusters")
        .upsert(
          {
            tenant_id,
            cluster_key: cluster.cluster_key,
            equipment_type: cluster.equipment_type,
            equipment_model: cluster.equipment_model,
            primary_symptom: cluster.primary_symptom,
            failure_components: cluster.failure_components,
            repair_actions: cluster.repair_actions,
            chain_count: cluster.chain_count,
            total_occurrences: cluster.total_occurrences,
            avg_success_rate: cluster.avg_success_rate,
            avg_confidence: cluster.avg_confidence,
            cluster_score: cluster.cluster_score,
            last_analyzed_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,cluster_key" },
        )
        .select("id")
        .single();

      if (upsertErr) {
        console.warn(`[suggest-patterns] Cluster upsert error for ${cluster.cluster_key}:`, upsertErr.message);
        continue;
      }

      clusterIdMap.set(cluster.cluster_key, upserted.id);
      clustersUpserted++;
    }

    // ── 6. Generate suggestions for eligible clusters ──────────
    let suggestionsCreated = 0;

    for (const cluster of scoredClusters) {
      const clusterId = clusterIdMap.get(cluster.cluster_key);
      if (!clusterId) continue;

      // Skip if below supporting jobs threshold
      if (cluster.total_occurrences < MIN_SUPPORTING_JOBS) continue;

      // Skip if suggestion already exists for this cluster
      const { data: existing } = await client
        .from("workflow_pattern_suggestions")
        .select("id")
        .eq("cluster_id", clusterId)
        .maybeSingle();

      if (existing) continue;

      // Generate suggestion
      const suggestion = generateSuggestion(cluster, clusterId);

      const { error: insertErr } = await client
        .from("workflow_pattern_suggestions")
        .insert({
          tenant_id,
          cluster_id: clusterId,
          suggested_name: suggestion.suggested_name,
          suggested_description: suggestion.suggested_description,
          suggested_category: suggestion.suggested_category,
          equipment_type: suggestion.equipment_type,
          equipment_model: suggestion.equipment_model,
          suggested_steps: suggestion.suggested_steps,
          cluster_score: suggestion.cluster_score,
          total_supporting_jobs: suggestion.total_supporting_jobs,
          avg_success_rate: suggestion.avg_success_rate,
        });

      if (insertErr) {
        console.warn(`[suggest-patterns] Suggestion insert error for cluster ${clusterId}:`, insertErr.message);
        continue;
      }

      suggestionsCreated++;
    }

    const latencyMs = Date.now() - start;
    console.log(
      `[suggest-patterns] Complete: ${clustersUpserted} clusters upserted, ` +
      `${suggestionsCreated} suggestions created (${latencyMs}ms)`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        clusters_found: clustersUpserted,
        suggestions_created: suggestionsCreated,
        latency_ms: latencyMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[suggest-patterns] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
