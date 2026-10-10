import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getActivityDefinition } from "@/lib/activities/registry";

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), assignments: vi.fn(), classes: vi.fn(), roster: vi.fn(), progress: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/server/classes", () => ({ deleteOwnedClass: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.user },
  from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }),
}) }));
vi.mock("@/lib/db/activities", () => ({ listActivityCatalog: mocks.catalog }));
vi.mock("@/lib/db/class_activities", () => ({ getClassActivities: mocks.assignments }));
vi.mock("@/lib/db/classes", () => ({ listActiveClassesForTeacher: mocks.classes }));
vi.mock("@/app/admin/assignments/AssignmentForm", () => ({ default: () => <p>New assignment form</p> }));
vi.mock("@/app/admin/assignments/actions", () => ({ saveAssignment: vi.fn() }));

import AdminPage from "@/app/admin/page";

const classId = "11111111-1111-4111-8111-111111111111";
const activity = { id: "activity", title: "Activity title", type: "lewis_diagram", order_index: 1, description: "Description", category: "Lewis" };
const assignment = { id: "assignment", class_id: classId, activity_id: activity.id, opens_at: null, closes_at: null, created_at: "2026-09-01T12:00:00Z" };
const render = async () => renderToStaticMarkup(await AdminPage({ searchParams: Promise.resolve({ classId }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "teacher" } }, error: null });
  mocks.roster.mockResolvedValue({ data: [], error: null });
  mocks.progress.mockResolvedValue({ data: [], error: null });
  mocks.classes.mockResolvedValue({ data: [{ id: classId, name: "Chemistry", section: "A", class_code: "ABC123" }], error: null });
  mocks.catalog.mockResolvedValue({ data: [activity], error: null });
  mocks.assignments.mockResolvedValue({ data: [], error: null });
});

describe("teacher catalog safety states", () => {


  it("blocks assigning when existing assignments could not be loaded", async () => {
    mocks.assignments.mockResolvedValue({ data: null, error: { message: "private error" } });
    const html = await render();
    expect(html).toContain("Assigned activities could not be loaded");
    expect(html).not.toContain("New assignment form");
    expect(html).not.toContain("This class has no assigned activities");
  });

  it("blocks assigning when the catalog could not be loaded", async () => {
    mocks.catalog.mockResolvedValue({ data: null, error: { message: "private error" } });
    const html = await render();
    expect(html).toContain("activity catalog could not be loaded");
    expect(html).not.toContain("New assignment form");
  });


  it("allows the assignment form after a confirmed empty assignment-list read", async () => {
    const html = await render();
    expect(html).toContain("New assignment form");
    expect(html).toContain("This class has no assigned activities");
  });

  it.each([
    "bohr_model_intro", "bohr_model_stability", "measurement_ruler_tenths", "measurement_ruler_hundredths",
  ])("labels existing %s assignments with their support restriction", async (type) => {
    mocks.catalog.mockResolvedValue({ data: [{ ...activity, type }], error: null });
    mocks.assignments.mockResolvedValue({ data: [assignment], error: null });
    const html = await render();
    expect(html).toContain("Activity title");
    expect(html).toContain("New assignments unavailable");
    expect(html).toContain(getActivityDefinition(type)?.newAssignmentBlockReason);
  });

  it("retains a useful unavailable label when an existing assignment has no catalog entry", async () => {
    mocks.catalog.mockResolvedValue({ data: [], error: null });
    mocks.assignments.mockResolvedValue({ data: [assignment], error: null });
    const html = await render();
    expect(html).toContain("Assigned activity");
    expect(html).toContain("This activity is unavailable in the current catalog");
  });
});
