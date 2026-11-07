import { describe, expect, it } from "vitest";
import {
  confirmedSalaryAtLeast,
  isTargetLocation,
  isTargetRole,
  salaryFromDescription,
  salaryFromAshbyCompensation,
  salaryFromPayInputRanges,
  salaryUndisclosed,
  fetchCompanyFeeds,
  matchesJobSearch,
  type JobListing,
  type JobSearchFilters,
} from "./jobFeeds";

function listing(overrides: Partial<JobListing> = {}): JobListing {
  return {
    id: "123",
    source: "Example",
    title: "Senior Software Engineer",
    company: "Example",
    url: "https://example.test/jobs/123",
    location: "Remote: United States",
    description: "",
    salary: { min: 145000, max: 180000, currency: "USD" },
    publishedAt: "",
    provider: "greenhouse",
    board: "example",
    ...overrides,
  };
}

const defaultFilters: JobSearchFilters = {
  keywords: "",
  company: "",
  location: "",
  locationMode: "preferred",
  workArrangement: "any",
  minimumSalary: 140000,
  maximumSalary: null,
  includeUndisclosedSalary: true,

};

describe("authorized job feed filters", () => {
  it("extracts a disclosed USD salary range from job text", () => {
    expect(salaryFromDescription("The annual salary range is $142,000–$180,000 USD."))
      .toEqual({ min: 142000, max: 180000, currency: "USD" });
  });

  it("uses the lowest published Greenhouse pay range across locations", () => {
    expect(salaryFromPayInputRanges([
      { min_cents: 14000000, max_cents: 18000000, currency_type: "USD" },
      { min_cents: 13000000, max_cents: 16000000, currency_type: "USD" },
      { min_cents: 20000000, max_cents: 24000000, currency_type: "CAD" },
    ])).toEqual({ min: 130000, max: 180000, currency: "USD" });
  });

  it("uses annual USD salary tiers from the Ashby posting feed", () => {
    expect(salaryFromAshbyCompensation({
      compensationTiers: [
        { components: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 145000, maxValue: 190000 }] },
        { components: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 130000, maxValue: 170000 }] },
        { components: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "CAD", minValue: 200000, maxValue: 240000 }] },
      ],
    })).toEqual({ min: 130000, max: 190000, currency: "USD" });
    expect(salaryFromAshbyCompensation({
      compensationTiers: [{ components: [{ compensationType: "Salary", interval: "1 HOUR", currencyCode: "USD", minValue: 100, maxValue: 150 }] }],
    })).toBeNull();
  });

  it("maps Ashby listings to their configured company and board", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      const board = url.split("job-board/")[1]?.split("?")[0] ?? "";
      return new Response(JSON.stringify(url.includes("greenhouse.io")
        ? { jobs: [] }
        : { jobs: [{
          id: board,
          title: "Software Engineer",
          location: "Remote: United States",
          jobUrl: `https://jobs.ashbyhq.com/${board}/${board}`,
        }] }), { status: 200 });
    };

    try {
      const { listings } = await fetchCompanyFeeds();
      const linear = listings.find((job) => job.company === "Linear");
      expect(linear).toMatchObject({
        source: "Linear",
        company: "Linear",
        provider: "ashby",
        board: "linear",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requires the published minimum to meet the $140,000 floor", () => {
    expect(confirmedSalaryAtLeast(listing())).toBe(true);
    expect(confirmedSalaryAtLeast(listing({ salary: { min: 139000, max: 155000, currency: "USD" } }))).toBe(false);
    expect(confirmedSalaryAtLeast(listing({ salary: null }))).toBe(false);
    expect(salaryUndisclosed(listing({ salary: null }))).toBe(true);
  });

  it("keeps the role and location filters aligned with the user's preferences", () => {
    expect(isTargetRole(listing())).toBe(true);
    expect(isTargetRole(listing({ title: "Account Executive" }))).toBe(false);
    expect(isTargetLocation(listing({ location: "Remote: United States" }))).toBe(true);
    expect(isTargetLocation(listing({ location: "Lafayette, Louisiana" }))).toBe(true);
    expect(isTargetLocation(listing({ location: "Remote: United Kingdom" }))).toBe(false);
  });

  it("applies keyword, employer, work arrangement, and adjustable salary filters", () => {
    const job = listing({
      title: "Staff Backend Engineer",
      company: "Example Systems",
      description: "Build reliable services with TypeScript and PostgreSQL.",
      location: "Remote: United States",
      salary: { min: 150000, max: 190000, currency: "USD" },
    });
    expect(matchesJobSearch(job, {
      ...defaultFilters,
      keywords: "python, typescript",
      company: "example",
      minimumSalary: 160000,
      maximumSalary: 180000,
    })).toBe(true);
    expect(matchesJobSearch(job, { ...defaultFilters, keywords: "designer, python" })).toBe(false);
    expect(matchesJobSearch(job, { ...defaultFilters, company: "other company" })).toBe(false);
    expect(matchesJobSearch(job, { ...defaultFilters, workArrangement: "hybrid" })).toBe(false);
    expect(matchesJobSearch(job, { ...defaultFilters, minimumSalary: 195000 })).toBe(false);
  });

  it("allows location and role scope changes and explicitly controls undisclosed salary results", () => {
    const executive = listing({
      title: "Director of Product",
      location: "New York, NY",
      salary: null,
    });
    expect(matchesJobSearch(executive, {
      ...defaultFilters,
      locationMode: "anywhere",
    })).toBe(true);
    expect(matchesJobSearch(executive, {
      ...defaultFilters,
      locationMode: "anywhere",
      includeUndisclosedSalary: false,
    })).toBe(false);
    expect(matchesJobSearch(executive, {
      ...defaultFilters,
      locationMode: "custom",
      location: "Boston",
    })).toBe(false);
  });
});
