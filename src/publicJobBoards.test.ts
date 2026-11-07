import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mapArbeitnowJobs,
  mapJobicyJobs,
  mapRemoteOkJobs,
  mapRemotiveJobs,
  mapWeWorkRemotelyFeed,
} from "./publicJobBoards";

class TestDomParser {
  parseFromString(input: string, type: string) {
    if (type === "application/xml") {
      const items = [...input.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
        const content = match[1];
        return {
          querySelector: (selector: string) => {
            const tag = selector.replace(/[^\w:-]/g, "");
            const value = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
            return value ? { textContent: value.replace(/<!\[CDATA\[|\]\]>/g, "") } : null;
          },
        };
      });
      return {
        querySelectorAll: (selector: string) => selector === "item" ? items : [],
        querySelector: () => null,
      };
    }

    return {
      body: {
        textContent: input.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
      },
    };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("public remote job-board feed adapters", () => {
  it("maps Remote OK jobs, application URLs, salary, and source attribution", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const jobs = mapRemoteOkJobs([
      { legal: "Terms notice" },
      {
        id: "42",
        position: "Senior Backend Engineer",
        company: "Example",
        url: "https://remoteok.com/remote-jobs/42",
        apply_url: "https://example.test/jobs/42/apply",
        location: "US only",
        description: "<p>Build services</p>",
        salary_min: 150000,
        salary_max: 200000,
      },
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "Remote OK",
      title: "Senior Backend Engineer",
      url: "https://example.test/jobs/42/apply",
      sourceUrl: "https://remoteok.com/remote-jobs/42",
      salary: { min: 150000, max: 200000, currency: "USD" },
    });
  });

  it("maps Remotive jobs and parses listed compensation", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const [job] = mapRemotiveJobs({ jobs: [{
      id: 12,
      title: "Software Engineer",
      company_name: "Example",
      url: "https://remotive.com/remote-jobs/software-dev/12",
      candidate_required_location: "United States",
      salary: "$150,000 - $180,000",
      description: "<p>Build useful software.</p>",
    }] });
    expect(job).toMatchObject({
      source: "Remotive",
      company: "Example",
      location: "United States",
      salary: { min: 150000, max: 180000, currency: "USD" },
    });
  });

  it("maps Arbeitnow and Jobicy jobs with their provider fields", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const [arbeitnow] = mapArbeitnowJobs({ data: [{
      slug: "example-engineer",
      company_name: "Example",
      title: "Software Engineer",
      description: "<p>Work remotely on APIs</p>",
      remote: true,
      url: "https://www.arbeitnow.com/view/example-engineer",
      location: "United States",
    }] });
    expect(arbeitnow).toMatchObject({
      source: "Arbeitnow",
      company: "Example",
      location: "United States Remote",
      url: "https://www.arbeitnow.com/view/example-engineer",
    });

    const [jobicy] = mapJobicyJobs({ jobs: [{
      id: 99,
      jobTitle: "Backend Developer",
      companyName: "Example",
      url: "https://jobicy.com/jobs/99",
      jobGeo: "USA",
      jobDescription: "<p>Build distributed systems</p>",
      annualSalaryMin: 145000,
      annualSalaryMax: 190000,
      salaryCurrency: "USD",
    }] });
    expect(jobicy).toMatchObject({
      source: "Jobicy",
      description: "Build distributed systems",
      salary: { min: 145000, max: 190000, currency: "USD" },
    });
  });

  it("parses We Work Remotely RSS posts", () => {
    vi.stubGlobal("DOMParser", TestDomParser);
    const [job] = mapWeWorkRemotelyFeed(`
      <rss><channel><item>
        <title>Example Co: Backend Engineer</title>
        <link>https://weworkremotely.com/remote-jobs/example</link>
        <guid>example-1</guid><region>USA Only</region>
        <description><![CDATA[<p>Build distributed systems</p>]]></description>
      </item></channel></rss>
    `);
    expect(job).toMatchObject({
      source: "We Work Remotely",
      company: "Example Co",
      title: "Backend Engineer",
      location: "USA Only",
      description: "Build distributed systems",
    });
  });
});
