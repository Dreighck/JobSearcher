import { describe, expect, it } from "vitest";
import { parseExtractedJobs } from "./importedJobs";

describe("extracted job JSON import", () => {
  it("normalizes job fields and rejects unsafe or incomplete rows", () => {
    const result = parseExtractedJobs([
      {
        title: " Backend Engineer ",
        company: "Example",
        location: "Remote, US",
        url: "https://careers.example.test/jobs/1",
        description: "Build APIs",
        salaryMin: 150000,
        salaryMax: 190000,
        salaryCurrency: "USD",
      },
      { title: "Unsafe", url: "javascript:alert(1)", description: "no" },
      { title: "Missing description", url: "https://example.test/jobs/2" },
    ]);

    expect(result.jobs).toEqual([{
      title: "Backend Engineer",
      company: "Example",
      location: "Remote, US",
      url: "https://careers.example.test/jobs/1",
      description: "Build APIs",
      salaryMin: 150000,
      salaryMax: 190000,
      salaryCurrency: "USD",
    }]);
    expect(result.rejected).toBe(2);
  });

  it("requires a JSON array and limits unreasonable imports", () => {
    expect(() => parseExtractedJobs({ jobs: [] })).toThrow("must contain an array");
    expect(() => parseExtractedJobs(Array.from({ length: 1001 }, () => ({})))).toThrow("limited to 1,000");
  });
});
