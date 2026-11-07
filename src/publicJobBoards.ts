import { salaryFromDescription } from "./jobFeeds";
import type { FeedStatus, JobListing, SalaryRange } from "./jobFeeds";

export const supportedPublicJobBoards = [
  { company: "Remote OK", id: "remoteok", url: "https://remoteok.com/api", sourceUrl: "https://remoteok.com" },
  { company: "Remotive", id: "remotive", url: "https://remotive.com/api/remote-jobs", sourceUrl: "https://remotive.com/remote-jobs" },
  { company: "Arbeitnow", id: "arbeitnow", url: "https://www.arbeitnow.com/api/job-board-api", sourceUrl: "https://www.arbeitnow.com" },
  { company: "Jobicy", id: "jobicy", url: "https://jobicy.com/api/v2/remote-jobs?count=100", sourceUrl: "https://jobicy.com" },
  { company: "We Work Remotely", id: "weworkremotely", url: "https://weworkremotely.com/remote-jobs.rss", sourceUrl: "https://weworkremotely.com/remote-jobs" },
] as const;

interface RemoteOkJob {
  id?: string;
  slug?: string;
  position?: string;
  company?: string;
  description?: string;
  location?: string;
  tags?: string[];
  url?: string;
  apply_url?: string;
  date?: string;
  salary_min?: string | number;
  salary_max?: string | number;
}

interface RemotiveJob {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: string;
}

interface JobicyJob {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobDescription?: string;
  jobExcerpt?: string;
  pubDate?: string;
  annualSalaryMin?: number;
  annualSalaryMax?: number;
  salaryCurrency?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arrayText(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function number(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replace(/[,$\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function salaryFromText(value: string): SalaryRange | null {
  if (/\b(?:hour|hourly|month|monthly|week|weekly|day|daily)\b/i.test(value)) return null;
  const match = value.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?\s*(?:-|to|–|—)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/);
  if (!match) return null;
  const amount = (numberPart: string, suffix: string | undefined) => {
    const parsed = Number(numberPart.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) return null;
    const scale = suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;
    return parsed * scale;
  };
  const min = amount(match[1], match[2]);
  const max = amount(match[3], match[4] ?? match[2]);
  return min === null ? null : { min, max, currency: "USD" };
}

function salaryRange(minValue: unknown, maxValue: unknown, currency = "USD"): SalaryRange | null {
  const min = number(minValue);
  if (min === null) return null;
  const max = number(maxValue);
  return { min, max, currency: currency.toUpperCase() };
}

function plainText(value: string): string {
  const doc = new DOMParser().parseFromString(value, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function makeListing(
  feed: (typeof supportedPublicJobBoards)[number],
  id: string,
  title: string,
  company: string,
  url: string,
  location: string,
  description: string,
  publishedAt: string,
  salary: SalaryRange | null,
): JobListing {
  return {
    id,
    source: feed.company,
    sourceUrl: feed.sourceUrl,
    title,
    company,
    url,
    location,
    description,
    publishedAt,
    salary,
    provider: feed.id,
    board: feed.id,
  };
}

export function mapRemoteOkJobs(value: unknown): JobListing[] {
  if (!Array.isArray(value)) throw new Error("Remote OK returned an unexpected response.");
  const feed = supportedPublicJobBoards.find((item) => item.id === "remoteok")!;
  return value.filter((entry): entry is RemoteOkJob => isRecord(entry) && Boolean(entry.position && entry.url))
    .map((job) => {
      const description = plainText(text(job.description));
      const directSalary = salaryRange(job.salary_min, job.salary_max);
      const listing = makeListing(
        feed,
        String(job.id ?? job.slug ?? job.url),
        text(job.position),
        text(job.company),
        text(job.apply_url) || text(job.url),
        text(job.location) || arrayText(job.tags).filter((tag) => /remote/i.test(tag)).join(", ") || "Remote",
        description,
        text(job.date),
        directSalary ?? salaryFromDescription(description),
      );
      listing.sourceUrl = text(job.url) || feed.sourceUrl;
      return listing;
    });
}

export function mapRemotiveJobs(value: unknown): JobListing[] {
  if (!isRecord(value) || !Array.isArray(value.jobs)) throw new Error("Remotive returned an unexpected response.");
  const feed = supportedPublicJobBoards.find((item) => item.id === "remotive")!;
  return (value.jobs as RemotiveJob[]).flatMap((job) => {
    const url = text(job.url);
    const title = text(job.title);
    if (!url || !title) return [];
    const description = plainText(text(job.description));
    return [makeListing(
      feed,
      String(job.id ?? url),
      title,
      text(job.company_name),
      url,
      text(job.candidate_required_location) || "Remote",
      description,
      text(job.publication_date),
      salaryFromText(text(job.salary)) ?? salaryFromDescription(description),
    )];
  });
}

export function mapArbeitnowJobs(value: unknown): JobListing[] {
  if (!isRecord(value) || !Array.isArray(value.data)) throw new Error("Arbeitnow returned an unexpected response.");
  const feed = supportedPublicJobBoards.find((item) => item.id === "arbeitnow")!;
  return (value.data as ArbeitnowJob[]).flatMap((job) => {
    const url = text(job.url);
    const title = text(job.title);
    if (!url || !title) return [];
    const description = plainText(text(job.description));
    return [makeListing(
      feed,
      text(job.slug) || url,
      title,
      text(job.company_name),
      url,
      job.remote ? `${text(job.location)} Remote`.trim() : text(job.location),
      description,
      text(job.created_at),
      salaryFromDescription(description),
    )];
  });
}

export function mapJobicyJobs(value: unknown): JobListing[] {
  if (!isRecord(value) || !Array.isArray(value.jobs)) throw new Error("Jobicy returned an unexpected response.");
  const feed = supportedPublicJobBoards.find((item) => item.id === "jobicy")!;
  return (value.jobs as JobicyJob[]).flatMap((job) => {
    const url = text(job.url);
    const title = text(job.jobTitle);
    if (!url || !title) return [];
    const description = plainText(text(job.jobDescription) || text(job.jobExcerpt));
    const directSalary = salaryRange(job.annualSalaryMin, job.annualSalaryMax, text(job.salaryCurrency) || "USD");
    return [makeListing(
      feed,
      String(job.id ?? url),
      title,
      text(job.companyName),
      url,
      text(job.jobGeo) || "Remote",
      description,
      text(job.pubDate),
      directSalary ?? salaryFromDescription(description),
    )];
  });
}

export function mapWeWorkRemotelyFeed(xml: string): JobListing[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("We Work Remotely returned invalid RSS.");
  const feed = supportedPublicJobBoards.find((item) => item.id === "weworkremotely")!;
  return Array.from(document.querySelectorAll("item")).flatMap((item) => {
    const url = item.querySelector("link")?.textContent?.trim() ?? "";
    const titleValue = item.querySelector("title")?.textContent?.trim() ?? "";
    if (!url || !titleValue) return [];
    const separator = titleValue.indexOf(":");
    const company = separator > 0 ? titleValue.slice(0, separator).trim() : "";
    const title = separator > 0 ? titleValue.slice(separator + 1).trim() : titleValue;
    const description = plainText(item.querySelector("description")?.textContent ?? "");
    const location = [
      item.querySelector("region")?.textContent?.trim(),
      item.querySelector("state")?.textContent?.trim(),
      item.querySelector("country")?.textContent?.trim(),
    ].filter(Boolean).join(", ") || "Remote";
    return [makeListing(
      feed,
      item.querySelector("guid")?.textContent?.trim() || url,
      title,
      company,
      url,
      location,
      description,
      item.querySelector("pubDate")?.textContent?.trim() ?? "",
      salaryFromDescription(description),
    )];
  });
}

function isRemoteOkPayload(value: unknown): value is RemoteOkJob[] {
  return Array.isArray(value);
}

export async function fetchPublicJobBoards(): Promise<{ listings: JobListing[]; statuses: FeedStatus[] }> {
  const responses = await Promise.all(supportedPublicJobBoards.map(async (feed) => {
    try {
      const response = await fetch(feed.url, { headers: { Accept: feed.id === "weworkremotely" ? "application/rss+xml, application/xml" : "application/json" } });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
      let listings: JobListing[];
      if (feed.id === "weworkremotely") {
        listings = mapWeWorkRemotelyFeed(await response.text());
      } else {
        const payload: unknown = await response.json();
        if (feed.id === "remoteok") {
          if (!isRemoteOkPayload(payload)) throw new Error("Remote OK returned an unexpected response.");
          listings = mapRemoteOkJobs(payload);
        } else if (feed.id === "remotive") {
          listings = mapRemotiveJobs(payload);
        } else if (feed.id === "arbeitnow") {
          listings = mapArbeitnowJobs(payload);
        } else if (feed.id === "jobicy") {
          listings = mapJobicyJobs(payload);
        } else {
          throw new Error("No parser is configured for this public job board.");
        }
      }
      return {
        listings,
        status: { company: feed.company, status: "loaded" as const, count: listings.length },
      };
    } catch (error) {
      return {
        listings: [],
        status: {
          company: feed.company,
          status: "failed" as const,
          count: 0,
          error: error instanceof Error ? error.message : "The feed could not be loaded.",
        },
      };
    }
  }));
  return {
    listings: responses.flatMap((response) => response.listings),
    statuses: responses.map((response) => response.status),
  };
}
