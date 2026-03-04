// ============================================================
// Equipment Knowledge Graph — Query Expansion
// ============================================================
// Expands retrieval keywords by matching user query terms
// against equipment components' failure_modes and
// diagnostic_keywords, then traversing 1 hop via
// component_relationships to discover related terms.
//
// Latency target: < 50ms (2 parallel + 1 sequential query)
// ============================================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Expand a search query with graph-derived keywords.
 *
 * 1. Match input keywords against failure_modes[] and diagnostic_keywords[]
 *    on equipment_components (filtered by equipmentType if provided).
 * 2. For matched components, traverse 1 hop via component_relationships.
 * 3. Collect diagnostic_keywords from related components.
 * 4. Return de-duped expansion terms (excluding input keywords).
 */
export async function expandQueryWithGraph(
  client: SupabaseClient,
  equipmentType: string | null,
  queryKeywords: string[],
  tenantId: string,
): Promise<string[]> {
  if (queryKeywords.length === 0) return [];

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
      { id: string; keywords: string[] }
    >();
    for (const row of [...(fmMatches || []), ...(dkMatches || [])]) {
      if (!matchedComponents.has(row.id)) {
        matchedComponents.set(row.id, {
          id: row.id,
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
      return [];
    }

    const matchedIds = Array.from(matchedComponents.keys());

    // Step 2: Traverse 1 hop — find related components via relationships
    const { data: relationships } = await client
      .from("component_relationships")
      .select(
        "target_id, relationship, weight, target:target_id(id, diagnostic_keywords)",
      )
      .in("source_id", matchedIds)
      .gte("weight", 0.5)
      .order("weight", { ascending: false })
      .limit(20);

    // Step 3: Collect expansion terms
    const expansionTerms = new Set<string>();

    // Terms from directly matched components
    for (const comp of matchedComponents.values()) {
      for (const kw of comp.keywords) {
        const lower = kw.toLowerCase();
        if (!lowerKeywords.includes(lower)) {
          expansionTerms.add(lower);
        }
      }
    }

    // Terms from 1-hop related components
    if (relationships) {
      for (const rel of relationships) {
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
    const result = Array.from(expansionTerms).slice(0, 15);
    const latencyMs = Date.now() - start;

    console.log(
      `[graph] Expanded ${queryKeywords.length} keywords -> ${result.length} new terms ` +
        `(${matchedComponents.size} components matched, ${relationships?.length || 0} relationships traversed, ${latencyMs}ms)`,
    );

    return result;
  } catch (err) {
    console.warn(
      `[graph] Error (${Date.now() - start}ms):`,
      err instanceof Error ? err.message : String(err),
    );
    return []; // Graceful degradation
  }
}
