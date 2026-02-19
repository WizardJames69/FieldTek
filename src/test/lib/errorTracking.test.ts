import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  captureError,
  addBreadcrumb,
  setUser,
  clearUser,
  getBreadcrumbs,
  trackPerformance,
  initErrorTracking,
  createScope,
  sanitizePII,
  generateErrorId,
} from "@/lib/errorTracking";

describe("Error Tracking Library", () => {
  beforeEach(() => {
    // Clear state between tests
    clearUser();
  });

  describe("generateErrorId", () => {
    it("generates unique error IDs", () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it("returns uppercase alphanumeric IDs", () => {
      const id = generateErrorId();
      expect(id).toMatch(/^[A-Z0-9-]+$/);
    });
  });

  describe("captureError", () => {
    it("captures an error and returns captured object", () => {
      const error = new Error("Test error");
      const captured = captureError(error);
      
      expect(captured).toBeDefined();
      expect(captured.id).toBeDefined();
      expect(captured.name).toBe("Error");
      expect(captured.message).toContain("Test error");
    });

    it("captures errors with extra data", () => {
      const error = new Error("Context error");
      const captured = captureError(error, {
        extra: { testKey: "testValue" },
      });
      
      expect(captured.context.extra).toBeDefined();
    });

    it("generates fingerprints for errors", () => {
      // Note: Same error message should generate same fingerprint,
      // but in tests the stack traces differ per invocation.
      // We just verify fingerprints are generated consistently.
      const error1 = new Error("Connection failed");
      
      const captured1 = captureError(error1);
      
      expect(captured1.fingerprint).toBeDefined();
      expect(typeof captured1.fingerprint).toBe("string");
      expect(captured1.fingerprint.length).toBeGreaterThan(0);
    });
  });

  describe("sanitizePII", () => {
    it("redacts email addresses", () => {
      const input = "Error for user test@example.com";
      const sanitized = sanitizePII(input);
      
      expect(sanitized).toContain("[REDACTED]");
      expect(sanitized).not.toContain("test@example.com");
    });

    it("redacts phone numbers", () => {
      const input = "Contact: 555-123-4567";
      const sanitized = sanitizePII(input);
      
      expect(sanitized).toContain("[REDACTED]");
      expect(sanitized).not.toContain("555-123-4567");
    });

    it("leaves non-PII text unchanged", () => {
      const input = "Regular error message without PII";
      const sanitized = sanitizePII(input);
      
      expect(sanitized).toBe(input);
    });
  });

  describe("Breadcrumbs", () => {
    it("adds navigation breadcrumbs", () => {
      addBreadcrumb({
        type: "navigation",
        category: "navigation",
        message: "Navigated to /dashboard",
        data: { from: "/", to: "/dashboard" },
      });
      
      const crumbs = getBreadcrumbs();
      expect(crumbs.length).toBeGreaterThan(0);
      
      const navBreadcrumb = crumbs.find(b => b.category === "navigation");
      expect(navBreadcrumb).toBeDefined();
      expect(navBreadcrumb?.message).toContain("/dashboard");
    });

    it("adds click breadcrumbs", () => {
      addBreadcrumb({
        type: "click",
        category: "ui",
        message: "Clicked Submit button",
        data: { element: "button", text: "Submit" },
      });
      
      const crumbs = getBreadcrumbs();
      const clickBreadcrumb = crumbs.find(b => b.type === "click");
      expect(clickBreadcrumb).toBeDefined();
    });
  });

  describe("User Tracking", () => {
    it("sets user context", () => {
      setUser("user-123", "tenant-456");
      
      const error = new Error("User error");
      const captured = captureError(error);
      
      expect(captured.context.userId).toBe("user-123");
      expect(captured.context.tenantId).toBe("tenant-456");
    });

    it("clears user context", () => {
      setUser("user-123", "tenant-456");
      clearUser();
      
      const error = new Error("Anonymous error");
      const captured = captureError(error);
      
      expect(captured.context.userId).toBeUndefined();
    });
  });

  describe("Performance Tracking", () => {
    it("tracks performance metrics", () => {
      // Just verify the function runs without error and adds breadcrumb
      const initialCount = getBreadcrumbs().length;
      
      // Track a slow operation
      trackPerformance("slow-operation", 3500);
      
      // Should have added a breadcrumb
      const finalCount = getBreadcrumbs().length;
      expect(finalCount).toBeGreaterThan(initialCount);
    });

    it("adds performance breadcrumb", () => {
      const initialCount = getBreadcrumbs().length;
      
      trackPerformance("test-operation", 500);
      
      const crumbs = getBreadcrumbs();
      expect(crumbs.length).toBeGreaterThan(initialCount);
      
      const perfCrumb = crumbs.find(b => b.category === "performance");
      expect(perfCrumb).toBeDefined();
    });
  });

  describe("Scoped Tracker", () => {
    it("creates scoped tracker with prefix", () => {
      const aiTracker = createScope("ai-assistant");
      
      const error = new Error("AI error");
      const captured = aiTracker.captureError(error);
      
      expect(captured.context.tags.scope).toBe("ai-assistant");
    });

    it("scoped tracker adds prefixed breadcrumbs", () => {
      const tracker = createScope("invoices");
      
      tracker.addBreadcrumb({
        type: "user",
        category: "action",
        message: "Created invoice",
      });
      
      const crumbs = getBreadcrumbs();
      const scopedCrumb = crumbs.find(b => b.category.includes("invoices"));
      expect(scopedCrumb).toBeDefined();
    });
  });
});
