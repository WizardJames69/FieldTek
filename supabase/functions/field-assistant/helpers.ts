// ============================================================
// Field Assistant — Utility & Helper Functions
// ============================================================

import { SYMPTOM_CATEGORIES, EMBEDDING_MODEL, EMBEDDING_DIMENSION, detectSymptomsInText as sharedDetectSymptomsInText } from "./constants.ts";
import type {
  ChatMessage,
  ServiceJob,
  SymptomOccurrence,
  PartsPredictionContext,
  PartUsageStats,
  PartPrediction,
  TenantPartsData,
} from "./types.ts";
import { fetchWithFallback } from "../_shared/aiClient.ts";

// ── Basic Utilities ─────────────────────────────────────────

export function getFirst<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function truncateText(text: string | null, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function escapeXmlAttr(str: string): string {
  return str.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c] || c;
  });
}

export function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Warranty Intelligence ───────────────────────────────────

export function getWarrantyContext(warrantyExpiry: string | null): string {
  if (!warrantyExpiry) return "WARRANTY STATUS: Unknown (no expiry date on file)";

  const expiryDate = new Date(warrantyExpiry);
  const today = new Date();
  const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = formatDate(warrantyExpiry);

  if (daysRemaining < 0) {
    return `⚠️ WARRANTY EXPIRED: ${Math.abs(daysRemaining)} days ago (${formattedDate})`;
  } else if (daysRemaining <= 30) {
    return `🔴 WARRANTY CRITICAL: Expires in ${daysRemaining} days (${formattedDate}) - Recommend documenting any issues for warranty claim`;
  } else if (daysRemaining <= 90) {
    return `🟡 WARRANTY EXPIRING SOON: ${daysRemaining} days remaining (${formattedDate})`;
  } else {
    return `✅ WARRANTY ACTIVE: ${daysRemaining} days remaining (expires ${formattedDate})`;
  }
}

// ── Embedding Generation ────────────────────────────────────

export async function generateQueryEmbedding(
  query: string,
  apiKey: string,
  correlationId?: string,
): Promise<{ embedding: number[] | null; gatewayUsed: "primary" | "fallback" }> {
  try {
    const { response, gatewayUsed } = await fetchWithFallback(
      "/embeddings",
      {
        model: EMBEDDING_MODEL,
        input: query,
        dimensions: EMBEDDING_DIMENSION,
      },
      apiKey,
      correlationId,
    );

    if (!response.ok) {
      console.error("Query embedding generation failed:", response.status);
      return { embedding: null, gatewayUsed };
    }

    const data = await response.json();
    return { embedding: data.data?.[0]?.embedding || null, gatewayUsed };
  } catch (error) {
    console.error("Error generating query embedding:", error);
    return { embedding: null, gatewayUsed: "primary" };
  }
}

// ── Query Extraction ────────────────────────────────────────

export function extractQueryForSearch(messages: ChatMessage[]): string {
  const userMessages = messages
    .filter(m => m.role === "user")
    .slice(-3);

  const queryParts: string[] = [];
  for (const msg of userMessages) {
    if (typeof msg.content === "string") {
      queryParts.push(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          queryParts.push(part.text);
        }
      }
    }
  }

  return queryParts.join(" ").slice(0, 2000);
}

// ── Extract text from a user message ────────────────────────

export function extractTextFromMessage(msg: ChatMessage | undefined): string {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      // deno-lint-ignore no-explicit-any
      .filter((c: any) => c.type === "text")
      // deno-lint-ignore no-explicit-any
      .map((c: any) => c.text)
      .join(" ");
  }
  return "";
}

// ── Symptom Detection ───────────────────────────────────────
// Delegates to the shared vocabulary module (single source of truth).
export const detectSymptomsInText = sharedDetectSymptomsInText;

export function extractExcerpt(text: string, keyword: string, contextChars: number): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) return "";

  const start = Math.max(0, index - contextChars);
  const end = Math.min(text.length, index + keyword.length + contextChars);

  let excerpt = text.slice(start, end).trim();
  if (start > 0) excerpt = "..." + excerpt;
  if (end < text.length) excerpt = excerpt + "...";

  return excerpt;
}

// ── Pattern Detection ───────────────────────────────────────

export function detectPatterns(serviceHistory: ServiceJob[]): string[] {
  const patterns: string[] = [];

  if (serviceHistory.length === 0) return patterns;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const symptomTracker: Record<string, SymptomOccurrence> = {};

  for (const [key, config] of Object.entries(SYMPTOM_CATEGORIES)) {
    symptomTracker[key] = {
      category: key,
      label: config.label,
      count: 0,
      occurrences: []
    };
  }

  serviceHistory.forEach(job => {
    const jobText = `${job.title || ''} ${job.description || ''} ${job.notes || ''} ${job.internal_notes || ''}`.toLowerCase();
    const jobDate = formatDate(job.scheduled_date);

    for (const [key, config] of Object.entries(SYMPTOM_CATEGORIES)) {
      const matches = jobText.match(config.keywords);
      if (matches && matches.length > 0) {
        symptomTracker[key].count++;

        const excerpt = extractExcerpt(jobText, matches[0], 50);
        symptomTracker[key].occurrences.push({
          date: jobDate,
          jobTitle: job.title,
          excerpt: excerpt
        });
      }
    }
  });

  const recentJobs = serviceHistory.filter(job =>
    job.scheduled_date && new Date(job.scheduled_date) > sixMonthsAgo
  );

  const jobTypeCounts: Record<string, number> = {};
  recentJobs.forEach(job => {
    if (job.job_type) {
      jobTypeCounts[job.job_type] = (jobTypeCounts[job.job_type] || 0) + 1;
    }
  });

  for (const [_key, data] of Object.entries(symptomTracker)) {
    if (data.count >= 4) {
      const recentOccurrences = data.occurrences.slice(0, 3);
      const dateList = recentOccurrences.map(o => o.date).join(", ");
      patterns.push(
        `🔴 CRITICAL RECURRING ISSUE: This is the ${getOrdinal(data.count)} time "${data.label}" has occurred on this equipment. ` +
        `Recent instances: ${dateList}. ` +
        `This pattern strongly suggests an underlying root cause that needs investigation.`
      );
    }
  }

  for (const [key, data] of Object.entries(symptomTracker)) {
    if (data.count >= 2 && data.count < 4) {
      const config = SYMPTOM_CATEGORIES[key];
      const recentOccurrences = data.occurrences.slice(0, 2);
      const dateList = recentOccurrences.map(o => o.date).join(" and ");
      patterns.push(
        `⚠️ RECURRING ${data.label.toUpperCase()}: This equipment has had ${data.count} service visits involving ${config.description} (${dateList}). ` +
        `Look for common causes.`
      );
    }
  }

  if (jobTypeCounts['Repair'] >= 3) {
    patterns.push(
      `🚨 HIGH REPAIR FREQUENCY: ${jobTypeCounts['Repair']} repair visits in the past 6 months. ` +
      `Consider recommending equipment assessment or replacement evaluation.`
    );
  } else if (jobTypeCounts['Repair'] >= 2) {
    patterns.push(`⚠️ RECURRING REPAIRS: ${jobTypeCounts['Repair']} repair visits in the past 6 months`);
  }

  const escalatingSymptoms = detectEscalatingIssues(serviceHistory);
  if (escalatingSymptoms.length > 0) {
    escalatingSymptoms.forEach(symptom => {
      patterns.push(
        `📈 ESCALATING ISSUE: "${symptom.label}" appears to be occurring more frequently - ` +
        `${symptom.recentCount} times in the last 6 months vs ${symptom.olderCount} time(s) in the prior period.`
      );
    });
  }

  return patterns;
}

export function detectEscalatingIssues(serviceHistory: ServiceJob[]): { label: string; recentCount: number; olderCount: number }[] {
  const escalating: { label: string; recentCount: number; olderCount: number }[] = [];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const recentJobs = serviceHistory.filter(job =>
    job.scheduled_date && new Date(job.scheduled_date) > sixMonthsAgo
  );

  const olderJobs = serviceHistory.filter(job =>
    job.scheduled_date &&
    new Date(job.scheduled_date) <= sixMonthsAgo &&
    new Date(job.scheduled_date) > twelveMonthsAgo
  );

  for (const [_key, config] of Object.entries(SYMPTOM_CATEGORIES)) {
    const recentMatches = recentJobs.filter(job => {
      const jobText = `${job.title || ''} ${job.description || ''} ${job.notes || ''} ${job.internal_notes || ''}`.toLowerCase();
      return config.keywords.test(jobText);
    }).length;

    config.keywords.lastIndex = 0;

    const olderMatches = olderJobs.filter(job => {
      const jobText = `${job.title || ''} ${job.description || ''} ${job.notes || ''} ${job.internal_notes || ''}`.toLowerCase();
      return config.keywords.test(jobText);
    }).length;

    config.keywords.lastIndex = 0;

    if (recentMatches >= 2 && recentMatches > olderMatches * 2) {
      escalating.push({
        label: config.label,
        recentCount: recentMatches,
        olderCount: olderMatches
      });
    }
  }

  return escalating;
}

// ── Parts Prediction ────────────────────────────────────────

export function predictLikelyParts(
  allTenantParts: TenantPartsData[],
  // deno-lint-ignore no-explicit-any
  equipmentParts: any[],
  context: PartsPredictionContext
): PartPrediction[] {
  const predictions: PartPrediction[] = [];
  const partStats = new Map<string, PartUsageStats>();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const part of allTenantParts) {
    const key = part.part_name.toLowerCase().trim();
    const existing = partStats.get(key) || {
      part_name: part.part_name,
      part_number: part.part_number,
      total_usage: 0,
      equipment_type_usage: 0,
      symptom_correlation: 0,
      brand_usage: 0,
      recent_usage: 0,
      last_used: part.created_at
    };

    existing.total_usage += part.quantity;

    if (new Date(part.created_at) > sixMonthsAgo) {
      existing.recent_usage += part.quantity;
    }

    if (new Date(part.created_at) > new Date(existing.last_used)) {
      existing.last_used = part.created_at;
      if (part.part_number) existing.part_number = part.part_number;
    }

    if (context.equipmentType && part.equipment_type?.toLowerCase() === context.equipmentType.toLowerCase()) {
      existing.equipment_type_usage += part.quantity;
    }

    if (context.brand && part.equipment_brand?.toLowerCase() === context.brand.toLowerCase()) {
      existing.brand_usage += part.quantity;
    }

    const jobText = `${part.job_description || ''} ${part.job_notes || ''}`.toLowerCase();
    const jobSymptoms = detectSymptomsInText(jobText);
    const matchingSymptoms = jobSymptoms.filter(s => context.currentSymptoms.includes(s));
    if (matchingSymptoms.length > 0) {
      existing.symptom_correlation += part.quantity * matchingSymptoms.length;
    }

    partStats.set(key, existing);
  }

  const scoredParts: Array<{ stats: PartUsageStats; score: number; reasons: string[] }> = [];

  for (const [key, stats] of partStats) {
    let score = 0;
    const reasons: string[] = [];

    if (stats.symptom_correlation > 0) {
      const symptomScore = Math.min(stats.symptom_correlation * 15, 40);
      score += symptomScore;
      reasons.push(`Used ${stats.symptom_correlation}x for similar symptoms`);
    }

    if (stats.equipment_type_usage > 0) {
      const typeScore = Math.min(stats.equipment_type_usage * 10, 25);
      score += typeScore;
      reasons.push(`Used ${stats.equipment_type_usage}x on ${context.equipmentType}`);
    }

    if (stats.brand_usage > 0) {
      const brandScore = Math.min(stats.brand_usage * 8, 20);
      score += brandScore;
      reasons.push(`Used ${stats.brand_usage}x on ${context.brand} equipment`);
    }

    if (stats.recent_usage > 0) {
      const recencyScore = Math.min(stats.recent_usage * 3, 10);
      score += recencyScore;
    }

    if (stats.total_usage >= 5) {
      score += Math.min(stats.total_usage, 5);
      reasons.push(`Used ${stats.total_usage}x total`);
    }

    const usedOnThisEquipment = equipmentParts.some(
      // deno-lint-ignore no-explicit-any
      (p: any) => p.part_name.toLowerCase().trim() === key
    );
    if (usedOnThisEquipment) {
      score += 20;
      reasons.unshift("Previously used on this equipment");
    }

    if (score >= 15) {
      scoredParts.push({ stats, score, reasons });
    }
  }

  scoredParts.sort((a, b) => b.score - a.score);
  const topParts = scoredParts.slice(0, 5);

  const maxScore = topParts[0]?.score || 100;

  for (const item of topParts) {
    const confidence = Math.min(Math.round((item.score / Math.max(maxScore, 50)) * 100), 95);

    predictions.push({
      part_name: item.stats.part_name,
      part_number: item.stats.part_number,
      confidence,
      reason: item.reasons.slice(0, 2).join("; "),
      usage_count: item.stats.total_usage,
      last_used: item.stats.last_used
    });
  }

  return predictions;
}
