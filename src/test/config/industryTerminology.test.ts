import { describe, it, expect } from "vitest";
import { getIndustryTerminology } from "@/config/industryTerminology";

// P4 terminology polish: the header quick action, the Service Requests
// conversion button/toast/banner, and the Service Requests subtitle all compose
// their copy from `t('job')` / `t('jobs')`. These assertions lock the exact
// user-facing strings each surface renders per industry, so HVAC reads
// "Service Call" while the default ("general") still reads "Job" and a third
// industry (electrical → "Work Order") proves non-HVAC terminology isn't broken.
describe("industry terminology — job labels backing P4 UI copy", () => {
  // Mirrors src/components/layout/Header.tsx quick action: `New {t('job')}`.
  const headerNewLabel = (industry: Parameters<typeof getIndustryTerminology>[0]) =>
    `New ${getIndustryTerminology(industry).job}`;

  // Mirrors src/components/requests/RequestDetailSheet.tsx: `Convert to {t('job')}`.
  const convertLabel = (industry: Parameters<typeof getIndustryTerminology>[0]) =>
    `Convert to ${getIndustryTerminology(industry).job}`;

  // Mirrors the converted toast/banner: `converted to a {t('job').toLowerCase()}`.
  const convertedCopy = (industry: Parameters<typeof getIndustryTerminology>[0]) =>
    `This request has been converted to a ${getIndustryTerminology(industry).job.toLowerCase()}.`;

  // Mirrors src/pages/ServiceRequests.tsx subtitle: `... into {t('jobs').toLowerCase()}`.
  const subtitle = (industry: Parameters<typeof getIndustryTerminology>[0]) =>
    `Submitted by customers — review and convert them into ${getIndustryTerminology(industry).jobs.toLowerCase()}`;

  it("HVAC renders Service Call copy across the header, convert button, banner and subtitle", () => {
    expect(headerNewLabel("hvac")).toBe("New Service Call");
    expect(convertLabel("hvac")).toBe("Convert to Service Call");
    expect(convertedCopy("hvac")).toBe("This request has been converted to a service call.");
    expect(subtitle("hvac")).toBe(
      "Submitted by customers — review and convert them into service calls",
    );
  });

  it("default (general) terminology still renders Job copy", () => {
    expect(headerNewLabel("general")).toBe("New Job");
    expect(headerNewLabel(null)).toBe("New Job");
    expect(headerNewLabel(undefined)).toBe("New Job");
    expect(convertLabel("general")).toBe("Convert to Job");
    expect(convertedCopy("general")).toBe("This request has been converted to a job.");
    expect(subtitle("general")).toBe(
      "Submitted by customers — review and convert them into jobs",
    );
  });

  it("a non-HVAC industry (electrical) keeps its own Work Order terminology", () => {
    expect(headerNewLabel("electrical")).toBe("New Work Order");
    expect(convertLabel("electrical")).toBe("Convert to Work Order");
    expect(convertedCopy("electrical")).toBe(
      "This request has been converted to a work order.",
    );
  });
});
