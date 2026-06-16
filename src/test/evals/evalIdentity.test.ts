import { describe, it, expect } from "vitest";

// The eval harness/provisioner must have a DEDICATED identity that does NOT
// overlap with the Playwright E2E suite. Sharing the tenant name / admin email
// caused E2E global-teardown to delete the eval tenant and the eval
// provisioner/baseline to invalidate the E2E admin's session (Assistant API
// 401s). These offline assertions pin the decoupled identity so a regression
// back to the E2E identity fails `npm run test` / CI without any backend.
import {
  EVAL_TENANT_NAME,
  EVAL_TENANT_SLUG_PREFIX,
  EVAL_TENANT_INDUSTRY,
  EVAL_ADMIN_EMAIL,
  EVAL_ADMIN_PASSWORD,
  EVAL_ADMIN_FULL_NAME,
} from "../../../evals/evalIdentity";

// The E2E suite's identity (e2e/helpers/test-data.ts) — the eval identity must
// never equal any of these.
const E2E_TENANT_NAME = "E2E Test Company";
const E2E_ADMIN_EMAIL = "e2e-admin@fieldtek-test.dev";

describe("eval identity — durable and dedicated", () => {
  it("uses the dedicated Sentinel eval tenant name", () => {
    expect(EVAL_TENANT_NAME).toBe("Sentinel Eval Company");
  });

  it("uses the dedicated Sentinel slug prefix", () => {
    expect(EVAL_TENANT_SLUG_PREFIX).toBe("sentinel-eval-company");
  });

  it("uses the dedicated Sentinel eval admin email", () => {
    expect(EVAL_ADMIN_EMAIL).toBe("sentinel-eval-admin@fieldtek-test.dev");
  });

  it("defines a non-empty admin password and full name", () => {
    expect(typeof EVAL_ADMIN_PASSWORD).toBe("string");
    expect(EVAL_ADMIN_PASSWORD.length).toBeGreaterThan(0);
    expect(EVAL_ADMIN_FULL_NAME.length).toBeGreaterThan(0);
  });

  it("keeps the HVAC fixture industry", () => {
    expect(EVAL_TENANT_INDUSTRY).toBe("hvac");
  });
});

describe("eval identity — never the E2E identity (decoupled)", () => {
  it("tenant name is NOT the E2E tenant name", () => {
    expect(EVAL_TENANT_NAME).not.toBe(E2E_TENANT_NAME);
  });

  it("admin email is NOT the E2E admin email", () => {
    expect(EVAL_ADMIN_EMAIL).not.toBe(E2E_ADMIN_EMAIL);
  });

  it("slug prefix is NOT the E2E slug prefix", () => {
    expect(EVAL_TENANT_SLUG_PREFIX).not.toBe("e2e-test-company");
  });
});
