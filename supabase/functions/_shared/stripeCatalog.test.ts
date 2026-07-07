import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  type BillingPeriod,
  FOUNDING_COUPON_ID,
  getPriceId,
  getStripeMode,
  getTierPrices,
  isLivePlaceholder,
  isPaidTier,
  PAID_TIERS,
  type PaidTier,
  productToTier,
} from "./stripeCatalog.ts";

// stripeCatalog.ts is side-effect-free; mode is passed explicitly in every
// test so no test depends on the ambient STRIPE_SECRET_KEY env var.

const PERIODS: readonly BillingPeriod[] = ["monthly", "yearly"];

// The six Sandbox product IDs and their expected tiers — pinned so a mapping
// edit that scrambles tiers fails a test, not a real tenant.
const SANDBOX_PRODUCTS: Record<string, PaidTier> = {
  "prod_TnJRvBGtJmXOKk": "starter",
  "prod_TnJRx1P7LOKR8k": "growth",
  "prod_TnJS2o21anjuku": "professional",
  "prod_TnJYHeFoo7ZMKr": "starter",
  "prod_TnJYlRK2IgK6yl": "growth",
  "prod_TnJYbiX5D0hesT": "professional",
};

// ── mode selection ──────────────────────────────────────────────

Deno.test("live secret key selects live mode", () => {
  assertEquals(getStripeMode("sk_live_abc123"), "live");
});

Deno.test("live restricted key selects live mode", () => {
  assertEquals(getStripeMode("rk_live_abc123"), "live");
});

Deno.test("test/sandbox secret key selects sandbox mode", () => {
  assertEquals(getStripeMode("sk_test_abc123"), "sandbox");
  assertEquals(getStripeMode("rk_test_abc123"), "sandbox");
});

Deno.test("missing, empty, or unknown key defaults safely to sandbox", () => {
  assertEquals(getStripeMode(undefined), "sandbox");
  assertEquals(getStripeMode(""), "sandbox");
  assertEquals(getStripeMode("not-a-stripe-key"), "sandbox");
  // A live key must never be selected by accident from a partial match
  assertEquals(getStripeMode("xsk_live_abc"), "sandbox");
});

// ── catalog completeness ────────────────────────────────────────

Deno.test("sandbox catalog has a real price for every tier and period", () => {
  const prices = getTierPrices("sandbox");
  const seen = new Set<string>();
  for (const tier of PAID_TIERS) {
    for (const period of PERIODS) {
      const id = prices[tier][period];
      assert(id.startsWith("price_"), `${tier}/${period} should be a price ID, got ${id}`);
      assert(!isLivePlaceholder(id), `${tier}/${period} must not be a placeholder in sandbox`);
      seen.add(id);
    }
  }
  assertEquals(seen.size, 6, "all six sandbox price IDs must be distinct");
});

Deno.test("live catalog covers every tier and period (placeholders until PR-STRIPE-2)", () => {
  const prices = getTierPrices("live");
  const seen = new Set<string>();
  for (const tier of PAID_TIERS) {
    for (const period of PERIODS) {
      const id = prices[tier][period];
      assert(id.length > 0, `${tier}/${period} live entry must exist`);
      seen.add(id);
    }
  }
  assertEquals(seen.size, 6, "all six live price entries must be distinct");
});

Deno.test("sandbox product map covers all three tiers in both periods", () => {
  const tierCounts = new Map<PaidTier, number>();
  for (const [productId, expectedTier] of Object.entries(SANDBOX_PRODUCTS)) {
    assertEquals(productToTier(productId, "sandbox"), expectedTier);
    tierCounts.set(expectedTier, (tierCounts.get(expectedTier) ?? 0) + 1);
  }
  for (const tier of PAID_TIERS) {
    assertEquals(tierCounts.get(tier), 2, `${tier} needs a monthly and a yearly product`);
  }
});

// ── price selection ─────────────────────────────────────────────

Deno.test("sandbox mode returns the existing Sandbox price IDs unchanged", () => {
  assertEquals(getPriceId("starter", "monthly", "sandbox"), "price_1SpiodJZanOkZUMQ1U3Wc8nJ");
  assertEquals(getPriceId("starter", "yearly", "sandbox"), "price_1Spiv5JZanOkZUMQRjHs1PXx");
  assertEquals(getPriceId("growth", "monthly", "sandbox"), "price_1SpiorJZanOkZUMQdG0vsg7D");
  assertEquals(getPriceId("growth", "yearly", "sandbox"), "price_1SpivVJZanOkZUMQRITnNHCo");
  assertEquals(getPriceId("professional", "monthly", "sandbox"), "price_1SpipAJZanOkZUMQ4hvNutoN");
  assertEquals(getPriceId("professional", "yearly", "sandbox"), "price_1SpivhJZanOkZUMQpGSV3o5z");
});

Deno.test("live mode with placeholder price IDs fails loudly instead of checking out", () => {
  for (const tier of PAID_TIERS) {
    for (const period of PERIODS) {
      assertThrows(
        () => getPriceId(tier, period, "live"),
        Error,
        "not configured",
      );
    }
  }
});

// ── product → tier mapping ──────────────────────────────────────

Deno.test("unknown product ID maps to null, never silently to starter", () => {
  assertEquals(productToTier("prod_DoesNotExist", "sandbox"), null);
  assertEquals(productToTier("prod_DoesNotExist", "live"), null);
  assertEquals(productToTier("", "sandbox"), null);
  assertEquals(productToTier(undefined, "sandbox"), null);
  assertEquals(productToTier(null, "sandbox"), null);
});

Deno.test("sandbox product IDs do not resolve in live mode (catalogs are isolated)", () => {
  for (const productId of Object.keys(SANDBOX_PRODUCTS)) {
    assertEquals(productToTier(productId, "live"), null);
  }
});

// ── coupon and tier helpers ─────────────────────────────────────

Deno.test("founding coupon ID is WQMyNyRo for both modes", () => {
  assertEquals(FOUNDING_COUPON_ID, "WQMyNyRo");
});

Deno.test("isPaidTier accepts exactly the three paid tiers", () => {
  for (const tier of PAID_TIERS) assert(isPaidTier(tier));
  assert(!isPaidTier("trial"));
  assert(!isPaidTier("enterprise"));
  assert(!isPaidTier(""));
  assert(!isPaidTier(undefined));
  assert(!isPaidTier(42));
});
