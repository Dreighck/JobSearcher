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
  provider: "greenhouse" | "ashby" | "remoteok" | "remotive" | "arbeitnow" | "jobicy" | "weworkremotely";
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
  minimumSalary: number | null;
  maximumSalary: number | null;
  includeUndisclosedSalary: boolean;
}

export const supportedCompanyFeeds = [
  { company: "Stripe", url: "https://stripe.com/jobs", provider: "greenhouse", board: "stripe" },
  { company: "GitLab", url: "https://about.gitlab.com/jobs/", provider: "greenhouse", board: "gitlab" },
  { company: "Elastic", url: "https://jobs.elastic.co/", provider: "greenhouse", board: "elastic" },
  { company: "Datadog", url: "https://careers.datadoghq.com/", provider: "greenhouse", board: "datadog" },
  { company: "Cloudflare", url: "https://www.cloudflare.com/careers/jobs/", provider: "greenhouse", board: "cloudflare" },
  { company: "MongoDB", url: "https://www.mongodb.com/company/careers", provider: "greenhouse", board: "mongodb" },
  { company: "Render", url: "https://render.com/careers", provider: "ashby", board: "render" },
  { company: "Linear", url: "https://linear.app/careers", provider: "ashby", board: "linear" },
  { company: "Ramp", url: "https://ramp.com/careers", provider: "ashby", board: "ramp" },
  { company: "OpenAI", url: "https://openai.com/careers/search/", provider: "ashby", board: "openai" },
  { company: "Notion", url: "https://www.notion.com/careers", provider: "ashby", board: "notion" },
  { company: "Anthropic", url: "https://www.anthropic.com/careers", provider: "ashby", board: "anthropic" },
  { company: "ElevenLabs", url: "https://elevenlabs.io/careers", provider: "ashby", board: "elevenlabs" },
  { company: "PostHog", url: "https://posthog.com/careers", provider: "ashby", board: "posthog" },
  { company: "Cursor", url: "https://cursor.com/careers", provider: "ashby", board: "cursor" },
  { company: "Replit", url: "https://replit.com/careers", provider: "ashby", board: "replit" },
  { company: "Perplexity", url: "https://www.perplexity.ai/careers", provider: "ashby", board: "perplexity" },
  { company: "Mistral AI", url: "https://mistral.ai/careers", provider: "ashby", board: "mistral" },
  { company: "Modal", url: "https://modal.com/careers", provider: "ashby", board: "modal" },
  { company: "Coinbase", url: "https://www.coinbase.com/careers", provider: "greenhouse", board: "coinbase" },
  { company: "Figma", url: "https://www.figma.com/careers/", provider: "greenhouse", board: "figma" },
  { company: "Discord", url: "https://discord.com/jobs", provider: "greenhouse", board: "discord" },
  { company: "Duolingo", url: "https://careers.duolingo.com/", provider: "greenhouse", board: "duolingo" },
  { company: "Reddit", url: "https://www.redditinc.com/careers", provider: "greenhouse", board: "reddit" },
  { company: "Canva", url: "https://www.canva.com/careers/", provider: "greenhouse", board: "canva" },
  { company: "Spotify", url: "https://www.lifeatspotify.com/jobs", provider: "lever", board: "spotify" },
  { company: "Palantir", url: "https://www.palantir.com/careers/", provider: "lever", board: "palantir" },
  { company: "Lyft", url: "https://www.lyft.com/careers", provider: "lever", board: "lyft" },
  { company: "Asana", url: "https://asana.com/jobs", provider: "lever", board: "asana" },
  { company: "Twitch", url: "https://www.twitch.tv/jobs/en/", provider: "lever", board: "twitch" },
  { company: "Plaid", url: "https://plaid.com/careers/", provider: "lever", board: "plaid" },
] as const;

export const manualOnlyCompanies = [
  { company: "Atlassian", url: "https://www.atlassian.com/company/careers" },
  { company: "CrowdStrike", url: "https://www.crowdstrike.com/careers/" },
  { company: "Confluent", url: "https://careers.confluent.io/" },
  { company: "Automattic", url: "https://automattic.com/work-with-us/" },
  { company: "Red Hat", url: "https://www.redhat.com/en/jobs" },
  { company: "HubSpot", url: "https://www.hubspot.com/careers" },
  { company: "NVIDIA", url: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite" },
  { company: "BOK Financial", url: "https://jobs.bokf.com/" },
  { company: "Adobe", url: "https://careers.adobe.com/" },
  { company: "Salesforce", url: "https://careers.salesforce.com/" },
  { company: "Dell Technologies", url: "https://jobs.dell.com/" },
  { company: "Mastercard", url: "https://careers.mastercard.com/" },
  { company: "Target", url: "https://corporate.target.com/careers" },
  { company: "T-Mobile", url: "https://www.t-mobile.com/careers" },
  { company: "Visa", url: "https://corporate.visa.com/en/careers.html" },
  { company: "Intuit", url: "https://careers.intuit.com/" },
  { company: "Netflix", url: "https://jobs.netflix.com/" },
  { company: "Pinterest", url: "https://www.pinterestcareers.com/" },
] as const;

interface GreenhouseMetadata {
  name?: string;
  value_type?: string;
  value?: unknown;
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  metadata?: GreenhouseMetadata[] | null;
  first_published?: string | null;
  content?: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
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

interface AshbyResponse {
  jobs: AshbyJob[];
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

function mapGreenhouseJob(job: GreenhouseJob, board: string, company: string): JobListing {
  return {
    id: String(job.id),
    source: company,
    title: job.title,
    company,
    url: job.absolute_url,
    location: job.location?.name ?? "",
    description: job.content ? stripHtml(job.content) : "",
    salary: salaryFromMetadata(job.metadata) ?? (job.content ? salaryFromDescription(stripHtml(job.content)) : null),
    publishedAt: job.first_published ?? "",
    provider: "greenhouse",
    board,
  };
}

function mapAshbyJob(job: AshbyJob, board: string, company: string): JobListing {
  const description = job.descriptionPlain ?? (job.descriptionHtml ? stripHtml(job.descriptionHtml) : "");
  const locations = [
    job.location,
    ...(job.secondaryLocations ?? []).map((location) =>
      typeof location === "string" ? location : location.location ?? "",
    ),
  ].filter(Boolean).join("; ");
  const salary = job.shouldDisplayCompensationOnJobPostings === false
    ? null
    : salaryFromAshbyCompensation(job.compensation);
  return {
    id: job.id,
    source: company,
    title: job.title,
    company,
    url: job.jobUrl,
    location: job.isRemote ? `Remote: ${locations}` : locations,
    description,
    salary,
    publishedAt: job.publishedAt ?? "",
    provider: "ashby",
    board,
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

function isGreenhouseResponse(value: unknown): value is GreenhouseResponse {
  return isRecord(value) && Array.isArray(value.jobs);
}

function isAshbyResponse(value: unknown): value is AshbyResponse {
  return isRecord(value) && Array.isArray(value.jobs);
}

export async function fetchCompanyFeeds(): Promise<{ listings: JobListing[]; statuses: FeedStatus[] }> {
  const responses = await Promise.all(supportedCompanyFeeds.map(async (source) => {
    try {
      const endpoint = source.provider === "greenhouse"
        ? `https://boards-api.greenhouse.io/v1/boards/${source.board}/jobs`
        : `https://api.ashbyhq.com/posting-api/job-board/${source.board}?includeCompensation=true`;
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
      const payload: unknown = await response.json();

      if (source.provider === "greenhouse") {
        if (!isGreenhouseResponse(payload)) throw new Error("Feed response had an unexpected format.");
        const jobs = payload.jobs.map((job) => mapGreenhouseJob(job, source.board, source.company));
        return { listings: jobs, status: { company: source.company, status: "loaded" as const, count: jobs.length } };
      }

      if (!isAshbyResponse(payload)) throw new Error("Feed response had an unexpected format.");
      const jobs = payload.jobs.map((job) => mapAshbyJob(job, source.board, source.company));
      return { listings: jobs, status: { company: source.company, status: "loaded" as const, count: jobs.length } };
    } catch (error) {
      return {
        listings: [],
        status: {
          company: source.company,
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

export function matchesJobSearch(job: JobListing, filters: JobSearchFilters): boolean {

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
