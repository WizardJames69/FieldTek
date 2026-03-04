// ============================================================
// Equipment Knowledge Graph — Query Expansion + Scoring
// ============================================================
// Expands retrieval keywords by matching user query terms
// against equipment components' failure_modes and
// diagnostic_keywords, then traversing 1 hop via
// component_relationships to discover related terms.
//
// Phase 9A: Also returns componentScores for post-retrieval
// graph relationship scoring (applyGraphScoring).
//
// Latency target: < 50ms (2 parallel + 1 sequential query)
// ============================================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface GraphExpansionResult {
  terms: string[];
  componentScores: Map<string, number>; // component_name (lowercase) → max weight (0.0–1.0)
}

const EMPTY_RESULT: GraphExpansionResult = {
  terms: [],
  componentScores: new Map(),
};

/**
 * Expand a search query with graph-derived keywords and component scores.
 *
 * 1. Match input keywords against failure_modes[] and diagnostic_keywords[]
 *    on equipment_components (filtered by equipmentType if provided).
 * 2. For matched components, traverse 1 hop via component_relationships.
 * 3. Collect diagnostic_keywords from related components.
 * 4. Return de-duped expansion terms (excluding input keywords) and
 *    component scores for post-retrieval graph scoring.
 */
export async function expandQueryWithGraph(
  client: SupabaseClient,
  equipmentType: string | null,
  queryKeywords: string[],
  tenantId: string,
): Promise<GraphExpansionResult> {
  if (queryKeywords.length === 0) return EMPTY_RESULT;

  const start = Date.now();

  try {
    const lowerKeywords = queryKeywords.map((k) => k.toLowerCase());

    // Step 1: Find components whose failure_modes or diagnostic_keywords
    // overlap with the query keywords. Uses GIN index via && (overlap).
    let fmQuery = client
      .from("equipment_components")
      .select("id, component_name, diagnostic_keywords, failure_modes")
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq("is_active", true)
      .overlaps("failure_modes", lowerKeywords)
      .limit(10);

    let dkQuery = client
      .from("equipment_components")
      .select("id, component_name, diagnostic_keywords, failure_modes")
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq("is_active", true)
      .overlaps("diagnostic_keywords", lowerKeywords)
      .limit(10);

    if (equipmentType) {
      fmQuery = fmQuery.eq("equipment_type", equipmentType);
      dkQuery = dkQuery.eq("equipment_type", equipmentType);
    }

    // Run both overlap queries in parallel
    const [{ data: fmMatches }, { data: dkMatches }] = await Promise.all([
      fmQuery,
      dkQuery,
    ]);

    // Merge and de-dupe matched component IDs
    const matchedComponents = new Map<
      string,
      { id: string; name: string; keywords: string[] }
    >();
    for (const row of [...(fmMatches || []), ...(dkMatches || [])]) {
      if (!matchedComponents.has(row.id)) {
        matchedComponents.set(row.id, {
          id: row.id,
          name: row.component_name,
          keywords: [
            ...(row.diagnostic_keywords || []),
            ...(row.failure_modes || []),
          ],
        });
      }
    }

    if (matchedComponents.size === 0) {
      console.log(
        `[graph] No component matches for keywords: ${lowerKeywords.slice(0, 5).join(", ")} (${Date.now() - start}ms)`,
      );
      return EMPTY_RESULT;
    }

    const matchedIds = Array.from(matchedComponents.keys());

    // Step 2: Traverse 1 hop — find related components via relationships
    const { data: relationships } = await client
      .from("component_relationships")
      .select(
        "target_id, relationship, weight, target:target_id(id, component_name, diagnostic_keywords)",
      )
      .in("source_id", matchedIds)
      .gte("weight", 0.5)
      .order("weight", { ascending: false })
      .limit(20);

    // Step 3: Collect expansion terms + component scores
    const expansionTerms = new Set<string>();
    const componentScores = new Map<string, number>();

    // Directly matched components get score 1.0
    for (const comp of matchedComponents.values()) {
      const nameKey = comp.name.toLowerCase();
      componentScores.set(nameKey, 1.0);

      for (const kw of comp.keywords) {
        const lower = kw.toLowerCase();
        if (!lowerKeywords.includes(lower)) {
          expansionTerms.add(lower);
        }
      }
    }

    // 1-hop related components get score = relationship weight
    if (relationships) {
      for (const rel of relationships) {
        const targetName = rel.target?.component_name;
        if (targetName) {
          const nameKey = targetName.toLowerCase();
          const existing = componentScores.get(nameKey) || 0;
          componentScores.set(nameKey, Math.max(existing, rel.weight));
        }

        const targetKeywords = rel.target?.diagnostic_keywords || [];
        for (const kw of targetKeywords) {
          const lower = kw.toLowerCase();
          if (!lowerKeywords.includes(lower)) {
            expansionTerms.add(lower);
          }
        }
      }
    }

    // Cap at 15 expansion terms to avoid query bloat
    const terms = Array.from(expansionTerms).slice(0, 15);
    const latencyMs = Date.now() - start;

    console.log(
      `[graph] Expanded ${queryKeywords.length} keywords -> ${terms.length} new terms ` +
        `(${matchedComponents.size} components matched, ${relationships?.length || 0} relationships traversed, ` +
        `${componentScores.size} scored components, ${latencyMs}ms)`,
    );

    return { terms, componentScores };
  } catch (err) {
    console.warn(
      `[graph] Error (${Date.now() - start}ms):`,
      err instanceof Error ? err.message : String(err),
    );
    return EMPTY_RESULT; // Graceful degradation
  }
}
