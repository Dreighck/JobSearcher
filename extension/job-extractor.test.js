import { afterEach, describe, expect, it, vi } from "vitest";
import {
  candidateLinks,
  crawlAuthorizedSite,
  extractJobPostings,
  isAllowedByRobots,
  normalizeSiteUrl,
} from "./job-extractor.js";

class TestDomParser {
  parseFromString(input) {
    const scripts = [...input.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((match) => ({ textContent: match[1] }));
    const anchors = [...input.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({
        getAttribute: () => match[1],
        textContent: match[2].replace(/<[^>]*>/g, ""),
      }));
    const bodyText = input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return {
      body: { textContent: bodyText },
      querySelectorAll: (selector) => selector === 'script[type="application/ld+json"]'
        ? scripts
        : selector === "a[href]" ? anchors : [],
      querySelector: () => null,
      title: "",
    };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("authorized public job extraction", () => {
  it("only accepts public HTTPS sites and rejects job boards outside scope", () => {
    expect(normalizeSiteUrl("https://careers.example.test/jobs#engineering")).toEqual({
      origin: "https://careers.example.test",
      url: "https://careers.example.test/jobs",
    });
    expect(() => normalizeSiteUrl("http://careers.example.test/jobs")).toThrow("public HTTPS");
    expect(() => normalizeSiteUrl("https://www.linkedin.com/jobs")).toThrow("LinkedIn and Indeed");
    expect(() => normalizeSiteUrl("https://indeed.com/jobs")).toThrow("LinkedIn and Indeed");
  });

  it("respects robots allow/disallow rules, including wildcards and specific overrides", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /private",
      "Disallow: /jobs/draft*",
      "Allow: /jobs/draft/public",
      "User-agent: ExampleBot",
      "Disallow: /",
    ].join("\n");
    expect(isAllowedByRobots(robots, "https://careers.example.test/jobs/open")).toBe(true);
    expect(isAllowedByRobots(robots, "https://careers.example.test/private/jobs")).toBe(false);
    expect(isAllowedByRobots(robots, "https://careers.example.test/jobs/draft/internal")).toBe(false);
    expect(isAllowedByRobots(robots, "https://careers.example.test/jobs/draft/public")).toBe(true);
  });

  it("extracts job posting fields from Schema.org JSON-LD", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Software Engineer",
      url: "https://careers.example.test/jobs/123",
      description: "<p>Build reliable APIs</p>",
      hiringOrganization: { name: "Example Corp" },
      jobLocation: { address: { addressLocality: "Lafayette", addressRegion: "Louisiana" } },
      baseSalary: {
        currency: "USD",
        value: { minValue: 150000, maxValue: 190000, unitText: "YEAR" },
      },
      datePosted: "2026-11-01",
      employmentType: "FULL_TIME",
    })}</script>`;

    expect(extractJobPostings(html, "https://careers.example.test/jobs/123")).toEqual([{
      title: "Senior Software Engineer",
      company: "Example Corp",
      location: "Lafayette, Louisiana",
      description: "Build reliable APIs",
      url: "https://careers.example.test/jobs/123",
      salaryMin: 150000,
      salaryMax: 190000,
      salaryCurrency: "USD",
      datePosted: "2026-11-01",
      employmentType: "FULL_TIME",
      sourcePage: "https://careers.example.test/jobs/123",
    }]);
  });

  it("only queues same-origin links that look like job pages", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const html = [
      '<a href="/jobs/123">Backend Engineer</a>',
      '<a href="https://other.example.test/jobs/456">External role</a>',
      '<a href="/about">About us</a>',
    ].join("");
    expect(candidateLinks(html, "https://careers.example.test/careers", "https://careers.example.test"))
      .toEqual(["https://careers.example.test/jobs/123"]);
  });

  it("does not mistake hourly salary for the annual minimum", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Software Engineer",
      url: "https://careers.example.test/jobs/123",
      description: "Role description",
      baseSalary: {
        currency: "USD",
        value: { minValue: 150, maxValue: 200, unitText: "HOUR" },
      },
    })}</script>`;
    expect(extractJobPostings(html, "https://careers.example.test/jobs/123")[0].salaryMin).toBeNull();
  });

  it("stops when the site presents an access challenge and does not continue crawling", async () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const requests = [];
    const fetchPage = async (url) => {
      requests.push(url);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /", { status: 200 });
      return new Response("<html>Verify you are human</html>", {
        status: 200,
        headers: { "content-type": "text/html", "x-test-url": url },
      });
    };
    const result = await crawlAuthorizedSite(
      "https://careers.example.test/jobs",
      "https://careers.example.test",
      fetchPage,
    );
    expect(result.postings).toEqual([]);
    expect(result.failures[0]).toContain("access challenge detected");
    expect(requests).toHaveLength(2);
  });

  it("does not fetch paths disallowed by robots.txt", async () => {
    const requests = [];
    const fetchPage = async (url) => {
      requests.push(url);
      if (url.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nDisallow: /careers", { status: 200 });
      }
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    };
    const result = await crawlAuthorizedSite(
      "https://careers.example.test/careers",
      "https://careers.example.test",
      fetchPage,
    );
    expect(result.scannedPages).toBe(0);
    expect(result.skippedByRobots).toBe(1);
    expect(requests).toEqual(["https://careers.example.test/robots.txt"]);
  });
});
