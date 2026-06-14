import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import { JobChecklistResults } from "@/components/jobs/JobChecklistResults";

// The shared setup mock's from() chain has no .order(); override it here with a
// from().select().eq().order() chain that resolves to our fixture rows.
const { mockOrder } = vi.hoisted(() => ({ mockOrder: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: (...args: unknown[]) => mockOrder(...args),
        }),
      }),
    }),
  },
}));

const rows = [
  {
    id: "1",
    stage_name: "Maintenance",
    checklist_item: "Drill Step 1 - Inspect air filter",
    completed: false,
    completed_at: null,
    notes: null,
  },
  {
    id: "2",
    stage_name: "Maintenance",
    checklist_item: "Drill Step 2 - Check refrigerant lines",
    completed: true,
    completed_at: "2026-06-14T19:27:49.021Z",
    notes: "Drill going well so far",
  },
  {
    id: "3",
    stage_name: "Maintenance",
    checklist_item: "Drill Step 3 - Test thermostat response",
    completed: false,
    completed_at: null,
    notes: null,
  },
];

describe("JobChecklistResults", () => {
  beforeEach(() => {
    mockOrder.mockReset();
  });

  it("shows progress, the completed item, its timestamp, and the synced note", async () => {
    mockOrder.mockResolvedValue({ data: rows, error: null });
    render(<JobChecklistResults jobId="job-1" />);

    // Prominent, discoverable verification heading
    expect(await screen.findByText("Checklist Verification")).toBeInTheDocument();
    // Progress badge "1/3 done"
    expect(screen.getByText(/1\/3 done/)).toBeInTheDocument();
    // Exactly which item was checked off + its note + a completion timestamp
    expect(
      screen.getByText("Drill Step 2 - Check refrigerant lines")
    ).toBeInTheDocument();
    expect(screen.getByText("Drill going well so far")).toBeInTheDocument();
    expect(screen.getByText(/^Completed/)).toBeInTheDocument();
    // Incomplete items still listed
    expect(
      screen.getByText("Drill Step 1 - Inspect air filter")
    ).toBeInTheDocument();
  });

  it("renders nothing when the job has no checklist rows", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    const { container } = render(<JobChecklistResults jobId="job-empty" />);
    await waitFor(() => expect(mockOrder).toHaveBeenCalled());
    expect(
      container.querySelector('[data-testid="job-checklist-results"]')
    ).toBeNull();
  });
});
