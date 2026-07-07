// Single source of truth for Stripe price IDs, product→tier mapping, and the
// founding-member coupon, shared by create-checkout, stripe-webhook, and
// check-subscription. Before this module existed the product→tier map was
// duplicated across two functions and the price map lived in a third — three
// places that had to be edited in lockstep for the Live migration.
//
// Mode is derived from the STRIPE_SECRET_KEY prefix, never from a separate
// env var: a `STRIPE_MODE` variable could drift out of sync with the key and
// silently pair Live charges with Sandbox IDs (or vice versa). With prefix
// detection, swapping the one secret swaps the whole catalog atomically.
//
// Live IDs are placeholders until the Live catalog is created in the Stripe
// dashboard (PR-STRIPE-2 fills them in). Placeholder behavior is fail-safe:
// getPriceId throws (checkout fails loudly instead of charging against a
// wrong price) and productToTier returns null (callers must not downgrade).

export type StripeMode = "live" | "sandbox";
export type PaidTier = "starter" | "growth" | "professional";
export type BillingPeriod = "monthly" | "yearly";

export const PAID_TIERS: readonly PaidTier[] = ["starter", "growth", "professional"];

// Same explicit coupon ID in Sandbox and Live: the Live coupon must be created
// with this custom ID ("Founding Member - 50% Off First Year", 50% off for
// 12 months) so no code change is needed at the Live flip.
export const FOUNDING_COUPON_ID = "WQMyNyRo";

const LIVE_PLACEHOLDER = "__LIVE_PLACEHOLDER__";

type TierPrices = Record<PaidTier, Record<BillingPeriod, string>>;

const SANDBOX_TIER_PRICES: TierPrices = {
  starter: {
    monthly: "price_1SpiodJZanOkZUMQ1U3Wc8nJ",
    yearly: "price_1Spiv5JZanOkZUMQRjHs1PXx",
  },
  growth: {
    monthly: "price_1SpiorJZanOkZUMQdG0vsg7D",
    yearly: "price_1SpivVJZanOkZUMQRITnNHCo",
  },
  professional: {
    monthly: "price_1SpipAJZanOkZUMQ4hvNutoN",
    yearly: "price_1SpivhJZanOkZUMQpGSV3o5z",
  },
};

// PR-STRIPE-2: replace with the real Live price IDs once the Live catalog
// exists in the Stripe dashboard.
const LIVE_TIER_PRICES: TierPrices = {
  starter: {
    monthly: `${LIVE_PLACEHOLDER}price_starter_monthly`,
    yearly: `${LIVE_PLACEHOLDER}price_starter_yearly`,
  },
  growth: {
    monthly: `${LIVE_PLACEHOLDER}price_growth_monthly`,
    yearly: `${LIVE_PLACEHOLDER}price_growth_yearly`,
  },
  professional: {
    monthly: `${LIVE_PLACEHOLDER}price_professional_monthly`,
    yearly: `${LIVE_PLACEHOLDER}price_professional_yearly`,
  },
};

const SANDBOX_PRODUCT_TO_TIER: Record<string, PaidTier> = {
  // Monthly products
  "prod_TnJRvBGtJmXOKk": "starter",
  "prod_TnJRx1P7LOKR8k": "growth",
  "prod_TnJS2o21anjuku": "professional",
  // Yearly products
  "prod_TnJYHeFoo7ZMKr": "starter",
  "prod_TnJYlRK2IgK6yl": "growth",
  "prod_TnJYbiX5D0hesT": "professional",
};

// PR-STRIPE-2: replace with the real Live product IDs.
const LIVE_PRODUCT_TO_TIER: Record<string, PaidTier> = {
  [`${LIVE_PLACEHOLDER}prod_starter_monthly`]: "starter",
  [`${LIVE_PLACEHOLDER}prod_growth_monthly`]: "growth",
  [`${LIVE_PLACEHOLDER}prod_professional_monthly`]: "professional",
  [`${LIVE_PLACEHOLDER}prod_starter_yearly`]: "starter",
  [`${LIVE_PLACEHOLDER}prod_growth_yearly`]: "growth",
  [`${LIVE_PLACEHOLDER}prod_professional_yearly`]: "professional",
};

/**
 * Derive the catalog mode from the Stripe secret key prefix. `sk_live_`
 * (and restricted `rk_live_`) keys select the Live catalog; everything else —
 * `sk_test_`, sandbox keys, missing/empty — selects Sandbox. Defaulting to
 * Sandbox is the safe direction: a misconfigured key can never route a
 * request at Live prices.
 */
export function getStripeMode(
  secretKey: string | undefined = Deno.env.get("STRIPE_SECRET_KEY"),
): StripeMode {
  if (secretKey?.startsWith("sk_live_") || secretKey?.startsWith("rk_live_")) {
    return "live";
  }
  return "sandbox";
}

export function isPaidTier(tier: unknown): tier is PaidTier {
  return typeof tier === "string" && (PAID_TIERS as readonly string[]).includes(tier);
}

export function isLivePlaceholder(id: string): boolean {
  return id.startsWith(LIVE_PLACEHOLDER);
}

export function getTierPrices(mode: StripeMode = getStripeMode()): TierPrices {
  return mode === "live" ? LIVE_TIER_PRICES : SANDBOX_TIER_PRICES;
}

/**
 * Price ID for a paid tier + billing period in the given mode. Throws if the
 * Live catalog is still on placeholder IDs — a checkout must fail loudly
 * rather than be created against an unconfigured or wrong price.
 */
export function getPriceId(
  tier: PaidTier,
  period: BillingPeriod,
  mode: StripeMode = getStripeMode(),
): string {
  const priceId = getTierPrices(mode)[tier][period];
  if (isLivePlaceholder(priceId)) {
    console.error(
      `[STRIPE-CATALOG] Live Stripe key detected but Live price IDs are still placeholders (${tier}/${period}). ` +
        `Fill in LIVE_TIER_PRICES in _shared/stripeCatalog.ts (PR-STRIPE-2) before enabling Live checkout.`,
    );
    throw new Error(
      "Live Stripe price IDs are not configured yet — checkout is disabled in live mode until the Live catalog is set up",
    );
  }
  return priceId;
}

/**
 * Map a Stripe product ID to a subscription tier, or null when unknown.
 * Callers MUST treat null as "do not change the tenant's tier" — the old
 * behavior of silently defaulting unknown products to "starter" could
 * downgrade a paying Growth/Professional tenant on a mapping gap.
 */
export function productToTier(
  productId: string | undefined | null,
  mode: StripeMode = getStripeMode(),
): PaidTier | null {
  if (!productId) return null;
  const map = mode === "live" ? LIVE_PRODUCT_TO_TIER : SANDBOX_PRODUCT_TO_TIER;
  const tier = map[productId] ?? null;
  if (!tier) {
    console.warn(
      `[STRIPE-CATALOG] Unknown Stripe product ID "${productId}" in ${mode} mode — not mapping to any tier`,
    );
  }
  return tier;
}
