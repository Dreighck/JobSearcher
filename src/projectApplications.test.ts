import { describe, expect, it } from "vitest";
import { mergeApplicationJobs } from "./projectApplications";
import type { Job } from "./types";

function job(id: string, updatedAt: string, notes = ""): Job {
  return {
    id,
    title: "Software Engineer",
    company: "Example Co",
    url: "https://example.test/jobs/1",
    description: "",
    status: "Saved",
    notes,
    followUp: "",
    draft: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  };
}

describe("project application merging", () => {
  it("keeps applications from both stores and prefers the most recently updated copy", () => {
    const merged = mergeApplicationJobs(
      [job("same", "2026-01-02T00:00:00.000Z", "project"), job("project-only", "2026-01-01T00:00:00.000Z")],
      [job("same", "2026-01-03T00:00:00.000Z", "browser"), job("browser-only", "2026-01-04T00:00:00.000Z")],
    );

    expect(merged).toHaveLength(3);
    expect(merged.find((application) => application.id === "same")?.notes).toBe("browser");
    expect(merged.map((application) => application.id)).toEqual(["same", "project-only", "browser-only"]);
  });
});
