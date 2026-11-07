import { describe, expect, it } from "vitest";
import { createDraft } from "./drafting";
import { parseJobAlert } from "./alerts";
import { getMatch } from "./matching";
import type { Job, Profile } from "./types";

const profile: Profile = {
  name: "Jordan Example",
  email: "jordan@example.test",
  phone: "555-0101",
  location: "Lafayette, Louisiana",
  headline: "Software engineer building accessible web products",
  skills: "TypeScript, React",
  highlights: "Built and maintained customer-facing applications.",
};

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Software Engineer",
    company: "Example Co",
    url: "https://example.test/jobs/1",
    description: "Remote role using TypeScript and React. Salary: $140,000–$160,000.",
    status: "Saved",
    notes: "",
    followUp: "",
    draft: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("explainable job matching", () => {
  it("recognizes preferred role, listed skills, remote work, and the salary floor", () => {
    const result = getMatch(job(), profile);
    expect(result.score).toBe(100);
    expect(result.factors.map((factor) => factor.score)).toEqual([100, 100, 100, 100]);
    expect(result.factors[1].detail).toContain("TypeScript, React");
  });

  describe("job alert import", () => {
    it("suggests the listing title, company, and URL from pasted alert text", () => {
      const parsed = parseJobAlert(
        "LinkedIn Job Alert\nSoftware Engineer\nExample Co\nRemote\nhttps://www.linkedin.com/jobs/view/123?trk=email\nApply now",
      );
      expect(parsed).toEqual({
        title: "Software Engineer",
        company: "Example Co",
        url: "https://www.linkedin.com/jobs/view/123?trk=email",
      });
    });
  });

  it("does not mark below-floor or undisclosed salaries as qualifying", () => {
    const result = getMatch(
      job({ title: "Application Specialist", description: "On-site role using TypeScript. Salary: $90,000." }),
      profile,
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.factors[3].score).toBe(0);
    expect(result.factors[3].detail).toContain("below your $140k floor");
    expect(result.factors[2].detail).toContain("not explicit");
  });

  it("treats undisclosed salary as unconfirmed rather than a $140k+ match", () => {
    const result = getMatch(
      job({ description: "Remote role using TypeScript and React." }),
      profile,
    );
    expect(result.factors[3].score).toBe(0);
    expect(result.factors[3].detail).toContain("shown separately");
  });

  it("creates an editable-friendly local draft from profile and job text", () => {
    const draft = createDraft(profile, job());
    expect(draft).toContain("Jordan Example");
    expect(draft).toContain("Example Co");
    expect(draft).toContain("TypeScript, React");
    expect(draft).toContain(profile.highlights);
  });
});
