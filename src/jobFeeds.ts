import type { JobLevel } from "./types";

export interface SalaryRange {
  min: number;
  max: number | null;
  currency: string;
}

export interface JobListing {
  id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  location: string;
  description: string;
  salary: SalaryRange | null;
  publishedAt: string;
  provider:
    | "greenhouse" | "ashby" | "remoteok" | "remotive" | "arbeitnow" | "jobicy" | "weworkremotely"
    | "lever" | "personio" | "recruitee" | "rippling" | "workable" | "workday";
  board: string;
  sourceUrl?: string;
}

export interface FeedStatus {
  company: string;
  status: "loaded" | "failed";
  count: number;
  error?: string;
}

export interface JobSearchFilters {
  keywords: string;
  company: string;
  location: string;
  locationMode: "preferred" | "anywhere" | "custom";
  workArrangement: "any" | "remote" | "hybrid" | "onsite";
  datePosted: "any" | "24h" | "7d" | "30d";
  minimumSalary: number | null;
  maximumSalary: number | null;
  includeUndisclosedSalary: boolean;
}

export type JobListingSort =
  | "relevance"
  | "newest"
  | "salary-high"
  | "salary-low"
  | "company";

export type JobPostedDateRange = JobSearchFilters["datePosted"];

export function composeJobSearchKeyword(level: JobLevel, customLevel: string, keyword: string): string {
  const prefix = level === "custom" ? customLevel.trim() : level;
  return [prefix, keyword.trim()].filter(Boolean).join(" ");
}

function listingRelevance(job: JobListing, keywords: string): number {
  const terms = keywords.split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
  if (!terms.length) return 0;
  const title = job.title.toLowerCase();
  const company = job.company.toLowerCase();
  const description = job.description.toLowerCase();
  const location = job.location.toLowerCase();
  const source = job.source.toLowerCase();
  return terms.reduce((score, term) =>
    score +
    (title.includes(term) ? 8 : 0) +
    (company.includes(term) ? 4 : 0) +
    (description.includes(term) ? 1 : 0) +
    (location.includes(term) ? 1 : 0) +
    (source.includes(term) ? 1 : 0), 0);
}

function publishedTimestamp(value: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function sortJobListings(
  listings: JobListing[],
  sort: JobListingSort,
  keywords: string,
): JobListing[] {
  return [...listings].sort((left, right) => {
    if (sort === "relevance") {
      const scoreDifference = listingRelevance(right, keywords) - listingRelevance(left, keywords);
      if (scoreDifference) return scoreDifference;
    } else if (sort === "newest") {
      const leftDate = publishedTimestamp(left.publishedAt);
      const rightDate = publishedTimestamp(right.publishedAt);
      if (leftDate !== rightDate) {
        if (leftDate === null) return 1;
        if (rightDate === null) return -1;
        return rightDate - leftDate;
      }
    } else if (sort === "salary-high" || sort === "salary-low") {
      const leftSalary = left.salary?.min ?? null;
      const rightSalary = right.salary?.min ?? null;
      if (leftSalary !== rightSalary) {
        if (leftSalary === null) return 1;
        if (rightSalary === null) return -1;
        return sort === "salary-high" ? rightSalary - leftSalary : leftSalary - rightSalary;
      }
    } else {
      const companyOrder = left.company.localeCompare(right.company);
      if (companyOrder) return companyOrder;
    }

    const leftDate = publishedTimestamp(left.publishedAt);
    const rightDate = publishedTimestamp(right.publishedAt);
    if (leftDate !== rightDate) {
      if (leftDate === null) return 1;
      if (rightDate === null) return -1;
      return rightDate - leftDate;
    }
    return left.company.localeCompare(right.company) || left.title.localeCompare(right.title);
  });
}

interface GreenhouseMetadata {
  name?: string;
  value_type?: string;
  value?: unknown;
}

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  isRemote?: boolean;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  secondaryLocations?: Array<string | { location?: string }>;
  shouldDisplayCompensationOnJobPostings?: boolean;
  compensation?: {
    compensationTiers?: Array<{
      components?: Array<{
        compensationType?: string;
        interval?: string;
        currencyCode?: string | null;
        minValue?: number | null;
        maxValue?: number | null;
      }>;
    }>;
  };
}

interface GreenhousePayInputRange {
  min_cents?: number;
  max_cents?: number;
  currency_type?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replace(/[,$\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function salaryFromMetadata(metadata: GreenhouseMetadata[] | null | undefined): SalaryRange | null {
  for (const item of metadata ?? []) {
    if (!/salary|compensation|pay transparency|pay range/i.test(item.name ?? "")) continue;
    if (!isRecord(item.value)) continue;
    const min = numberValue(item.value.min_value ?? item.value.minimum);
    const max = numberValue(item.value.max_value ?? item.value.maximum);
    const currency = String(item.value.unit ?? item.value.currency ?? "").toUpperCase();
    if (min !== null && currency === "USD") return { min, max, currency };
  }
  return null;
}

function stripHtml(value: string): string {
  const decoded = value
    .replace(/&amp;lt;/gi, "&lt;")
    .replace(/&amp;gt;/gi, "&gt;")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
  return decoded.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function salaryFromDescription(text: string): SalaryRange | null {
  const relevant = text.match(/(?:salary|compensation|base pay|base salary|pay range|annual pay)[^$]{0,80}\$\s*([\d,]+)(?:\s*(?:-|to|–|—)\s*\$?\s*([\d,]+))?/i);
  if (!relevant) return null;
  const min = numberValue(relevant[1]);
  const max = numberValue(relevant[2]);
  return min === null ? null : { min, max, currency: "USD" };
}

export function salaryFromPayInputRanges(value: unknown): SalaryRange | null {
  if (!Array.isArray(value)) return null;
  const ranges = value.filter((item): item is GreenhousePayInputRange =>
    isRecord(item) && item.currency_type === "USD",
  ).flatMap((item) => {
    const minCents = numberValue(item.min_cents);
    if (minCents === null) return [];
    const maxCents = numberValue(item.max_cents);
    return [{ min: minCents / 100, max: maxCents === null ? null : maxCents / 100 }];
  });
  if (!ranges.length) return null;
  return {
    min: Math.min(...ranges.map((range) => range.min)),
    max: Math.max(...ranges.map((range) => range.max ?? range.min)),
    currency: "USD",
  };
}

export function salaryFromAshbyCompensation(
  compensation: AshbyJob["compensation"],
): SalaryRange | null {
  const tiers = compensation?.compensationTiers ?? [];
  const ranges = tiers.flatMap((tier) => (tier.components ?? []).flatMap((component) => {
    if (component.compensationType !== "Salary" || component.currencyCode !== "USD" ||
      !/YEAR|ANNUAL/i.test(component.interval ?? "")) return [];
    const min = numberValue(component.minValue);
    if (min === null) return [];
    const max = numberValue(component.maxValue);
    return [{ min, max }];
  }));
  if (!ranges.length) return null;
  return {
    min: Math.min(...ranges.map((range) => range.min)),
    max: Math.max(...ranges.map((range) => range.max ?? range.min)),
    currency: "USD",
  };
}

export function isTargetRole(job: JobListing): boolean {
  return /software|backend|full[- ]?stack|platform|infrastructure|developer|engineer/i.test(job.title);
}

export function isTargetLocation(job: JobListing): boolean {
  const location = job.location.toLowerCase();
  const remote = /\bremote\b/.test(location) && !/\b(canada|mexico|india|australia|united kingdom|uk|europe|germany|france)\b/.test(location);
  const lafayette = /lafayette/.test(location) || /louisiana/.test(location);
  return remote || lafayette;
}

export function confirmedSalaryAtLeast(job: JobListing, minimum = 140000): boolean {
  return job.salary?.currency === "USD" && job.salary.min >= minimum;
}

export function salaryUndisclosed(job: JobListing): boolean {
  return !job.salary;
}

export function matchesJobSearch(job: JobListing, filters: JobSearchFilters, now = Date.now()): boolean {

  if (filters.locationMode === "preferred" && !isTargetLocation(job)) return false;
  if (filters.locationMode === "custom" &&
    (!filters.location.trim() || !job.location.toLowerCase().includes(filters.location.trim().toLowerCase()))) return false;

  if (filters.company.trim()) {
    const companyQuery = filters.company.trim().toLowerCase();
    if (!job.company.toLowerCase().includes(companyQuery) &&
      !job.source.toLowerCase().includes(companyQuery)) return false;
  }

  if (filters.keywords.trim()) {
    const searchableText = `${job.title} ${job.company} ${job.location} ${job.description} ${job.source}`.toLowerCase();
    const terms = filters.keywords.split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
    if (!terms.some((term) => searchableText.includes(term))) return false;
  }

  if (filters.workArrangement !== "any") {
    const location = job.location.toLowerCase();
    const isRemote = /\bremote\b/.test(location);
    const isHybrid = /\bhybrid\b/.test(location);
    const isOnsite = /\b(on[- ]?site|in[- ]office|office[- ]based)\b/.test(location);
    if (filters.workArrangement === "remote" && !isRemote) return false;
    if (filters.workArrangement === "hybrid" && !isHybrid) return false;
    if (filters.workArrangement === "onsite" && !isOnsite) return false;
  }

  if (filters.datePosted !== "any") {
    const postedAt = publishedTimestamp(job.publishedAt);
    if (postedAt === null) return false;
    const rangeMs = filters.datePosted === "24h"
      ? 24 * 60 * 60 * 1000
      : filters.datePosted === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
    if (postedAt < now - rangeMs || postedAt > now) return false;
  }

  if (!job.salary) return filters.includeUndisclosedSalary;
  if (job.salary.currency !== "USD") return false;
  if (filters.minimumSalary !== null && (job.salary.max ?? job.salary.min) < filters.minimumSalary) return false;
  if (filters.maximumSalary !== null && job.salary.min > filters.maximumSalary) return false;
  return true;
}

export async function loadListingDetails(listing: JobListing): Promise<JobListing> {
  if (listing.description) return listing;
  if (listing.provider !== "greenhouse") throw new Error("This posting did not include a job description in its public feed.");

  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${listing.board}/jobs/${encodeURIComponent(listing.id)}?pay_transparency=true`;
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load the posting details (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.content !== "string") {
    throw new Error("The official feed did not provide a job description.");
  }
  const description = stripHtml(payload.content);
  const metadata = Array.isArray(payload.metadata) ? payload.metadata as GreenhouseMetadata[] : undefined;
  return {
    ...listing,
    description,
    salary: listing.salary ?? salaryFromMetadata(metadata) ??
      salaryFromPayInputRanges(payload.pay_input_ranges) ?? salaryFromDescription(description),
  };
}
