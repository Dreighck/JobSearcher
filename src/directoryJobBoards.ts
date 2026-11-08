import directoryUrl from "../jobBoardDirectory.json?url";
import workdayDirectoryUrl from "../workdayJobBoardDirectory.json?url";
import { salaryFromDescription, type FeedStatus, type JobListing, type SalaryRange } from "./jobFeeds";

export type DirectoryPlatform =
  | "ashby"
  | "greenhouse"
  | "lever"
  | "personio"
  | "recruitee"
  | "rippling"
  | "workable"
  | "workday";

export interface DirectoryBoard {
  platform: DirectoryPlatform;
  token: string;
  company: string;
  board_url: string;
  api_url: string;
  open_roles: number;
  count_basis: string;
  region: string;
}

export const jobKeywordPresets = [
  { keyword: "Software", id: "software" },
  { keyword: "Software Engineer", id: "software-engineer" },
  { keyword: "Software Dev", id: "software-dev" },
  { keyword: "Consultant", id: "consultant" },
  { keyword: "Mathematics", id: "mathematics" },
  { keyword: "Software Architect", id: "software-architect" },
  { keyword: "Project Manager", id: "project-manager" },
] as const;

export type JobKeywordPresetId = (typeof jobKeywordPresets)[number]["id"];

const keywordPresetCompanies: Record<(typeof jobKeywordPresets)[number]["id"], string[]> = {
  software: [
    "Microsoft", "Amazon", "Google", "Apple", "Meta", "NVIDIA", "Salesforce", "Adobe", "Oracle", "IBM",
    "Cisco", "Intel", "ServiceNow", "Uber", "Airbnb", "Stripe", "Datadog", "Cloudflare", "GitLab", "Atlassian",
  ],
  "software-engineer": [
    "Google", "Microsoft", "Amazon", "Meta", "Apple", "NVIDIA", "Uber", "Netflix", "Stripe", "Datadog",
    "Cloudflare", "GitHub", "GitLab", "Airbnb", "Coinbase", "Reddit", "Figma", "Discord", "OpenAI", "MongoDB",
  ],
  "software-dev": [
    "Microsoft", "Amazon", "Google", "Oracle", "IBM", "Salesforce", "Adobe", "Cisco", "Intel", "Dell",
    "ServiceNow", "Accenture", "Cognizant", "Infosys", "Tata Consultancy Services", "Wipro", "Capgemini", "EPAM",
  ],
  consultant: [
    "Deloitte", "Accenture", "PwC", "EY", "KPMG", "McKinsey & Company", "Boston Consulting Group", "Bain & Company",
    "Capgemini", "Booz Allen Hamilton", "CGI", "Cognizant", "Infosys", "Tata Consultancy Services", "Wipro", "IBM",
  ],
  mathematics: [
    "Google", "Microsoft", "NVIDIA", "Amazon", "Meta", "Apple", "Jane Street", "Citadel", "Two Sigma",
    "Hudson River Trading", "Bloomberg", "Palantir", "Datadog", "Stripe", "Uber", "Cloudflare",
  ],
  "software-architect": [
    "Microsoft", "Amazon", "Google", "Oracle", "IBM", "Salesforce", "Adobe", "Cisco", "NVIDIA", "Meta",
    "ServiceNow", "Datadog", "Cloudflare", "GitLab", "MongoDB", "Red Hat", "Dell", "Intel",
  ],
  "project-manager": [
    "Amazon", "Microsoft", "Google", "Apple", "Meta", "Deloitte", "Accenture", "IBM", "Salesforce", "Oracle",
    "Cisco", "Adobe", "ServiceNow", "Uber", "Capital One", "JPMorgan Chase", "Walmart", "Target",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function valueText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function plainText(value: string): string {
  return new DOMParser().parseFromString(value, "text/html").body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function validHost(platform: DirectoryPlatform, hostname: string): boolean {
  const host = hostname.toLowerCase();
  switch (platform) {
    case "ashby": return host === "api.ashbyhq.com";
    case "greenhouse": return host === "boards-api.greenhouse.io";
    case "lever": return host === "api.lever.co" || host === "api.eu.lever.co";
    case "personio": return host.endsWith(".jobs.personio.de");
    case "recruitee": return host.endsWith(".recruitee.com");
    case "rippling": return host === "api.rippling.com";
    case "workable": return host === "apply.workable.com";
    case "workday": return host.endsWith(".myworkdayjobs.com");
  }
}

function validBoardHost(platform: DirectoryPlatform, hostname: string): boolean {
  const host = hostname.toLowerCase();
  switch (platform) {
    case "ashby": return host === "jobs.ashbyhq.com";
    case "greenhouse": return host === "job-boards.greenhouse.io" || host === "boards.greenhouse.io";
    case "lever": return host === "jobs.lever.co" || host === "jobs.eu.lever.co";
    case "personio": return host.endsWith(".jobs.personio.de");
    case "recruitee": return host.endsWith(".recruitee.com");
    case "rippling": return host === "ats.rippling.com";
    case "workable": return host === "apply.workable.com";
    case "workday": return host.endsWith(".myworkdayjobs.com");
  }
}

function isDirectoryPlatform(value: unknown): value is DirectoryPlatform {
  return typeof value === "string" && [
    "ashby", "greenhouse", "lever", "personio", "recruitee", "rippling", "workable", "workday",
  ].includes(value);
}

function isDirectoryBoard(value: unknown): value is DirectoryBoard {
  if (!isRecord(value)) return false;
  const platform = value.platform;
  if (!isDirectoryPlatform(platform)) return false;
  try {
    const apiUrl = new URL(String(value.api_url));
    const boardUrl = new URL(String(value.board_url));
    return apiUrl.protocol === "https:" && boardUrl.protocol === "https:" &&
      validHost(platform, apiUrl.hostname) &&
      validBoardHost(platform, boardUrl.hostname) &&
      typeof value.company === "string" && typeof value.token === "string";
  } catch {
    return false;
  }
}

export async function loadJobBoardDirectory(): Promise<DirectoryBoard[]> {
  const response = await fetch(directoryUrl);
  if (!response.ok) throw new Error(`Could not load the company directory (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("The company directory has an unexpected format.");
  return payload.filter(isDirectoryBoard).filter((board) => board.platform !== "workday");
}

export async function loadWorkdayJobBoardDirectory(): Promise<DirectoryBoard[]> {
  const response = await fetch(workdayDirectoryUrl);
  if (!response.ok) throw new Error(`Could not load the Workday directory (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("The Workday directory has an unexpected format.");
  return payload.filter(isDirectoryBoard).filter((board) => board.platform === "workday");
}

export function topDirectoryBoards(boards: DirectoryBoard[], limit = 15): DirectoryBoard[] {
  const maximum = Math.max(0, Math.floor(limit));
  if (maximum === 0) return [];
  const sorted = boards
    .filter((board) => board.platform !== "workday")
    .sort((left, right) =>
      right.open_roles - left.open_roles ||
      left.company.localeCompare(right.company) ||
      left.platform.localeCompare(right.platform),
    );
  const companies = new Set<string>();
  const selected: DirectoryBoard[] = [];
  for (const board of sorted) {
    if (board.platform === "workday") continue;
    const company = board.company.toLowerCase();
    if (companies.has(company)) continue;
    companies.add(company);
    selected.push(board);
    if (selected.length >= maximum) break;
  }
  return selected;
}

export function directoryBoardsForKeywordPreset(
  boards: DirectoryBoard[],
  presetId: (typeof jobKeywordPresets)[number]["id"],
  limit = 30,
): DirectoryBoard[] {
  const maximum = Math.max(0, Math.floor(limit));
  if (maximum === 0) return [];
  const topBoards = topDirectoryBoards(boards, boards.length);
  const byCompany = new Map(topBoards.map((board) => [board.company.toLowerCase(), board]));
  const selected: DirectoryBoard[] = [];
  const included = new Set<string>();
  for (const company of keywordPresetCompanies[presetId]) {
    const board = byCompany.get(company.toLowerCase());
    if (!board || included.has(board.company.toLowerCase())) continue;
    selected.push(board);
    included.add(board.company.toLowerCase());
    if (selected.length >= maximum) return selected;
  }
  for (const board of topBoards) {
    if (included.has(board.company.toLowerCase())) continue;
    selected.push(board);
    included.add(board.company.toLowerCase());
    if (selected.length >= maximum) break;
  }
  return selected;
}

export function searchDirectory(
  boards: DirectoryBoard[],
  query: string,
  platform: DirectoryPlatform | "all",
): DirectoryBoard[] {
  const search = query.trim().toLowerCase();
  return boards.filter((board) =>
    (platform === "all" || board.platform === platform) &&
    (!search || `${board.company} ${board.platform} ${board.region}`.toLowerCase().includes(search)),
  ).sort((left, right) =>
    right.open_roles - left.open_roles ||
    left.company.localeCompare(right.company) ||
    left.platform.localeCompare(right.platform),
  );
}

const searchableDirectoryPlatforms = new Set<string>([
  "greenhouse", "ashby", "lever", "personio", "recruitee", "rippling", "workable",
]);

export function isSearchableDirectoryListing(listing: JobListing): boolean {
  return searchableDirectoryPlatforms.has(listing.provider);
}

export function mergeSelectedDirectoryListings(
  existing: JobListing[],
  incoming: JobListing[],
  selectedBoardKeys: string[],
): JobListing[] {
  const selected = new Set(selectedBoardKeys);
  const merged = [
    ...existing.filter((listing) =>
      !isSearchableDirectoryListing(listing) ||
      selected.has(`${listing.provider}:${listing.board}`),
    ),
    ...incoming,
  ];
  const byUrl = new Map<string, JobListing>();
  for (const listing of merged) byUrl.set(listing.url.toLowerCase(), listing);
  return [...byUrl.values()];
}

function makeListing(
  board: DirectoryBoard,
  id: string,
  title: string,
  url: string,
  location: string,
  description: string,
  publishedAt = "",
  salary: SalaryRange | null = null,
): JobListing {
  return {
    id,
    source: displayCompany(board.company),
    sourceUrl: board.board_url,
    title,
    company: displayCompany(board.company),
    url,
    location,
    description,
    salary,
    publishedAt,
    provider: board.platform,
    board: board.token,
  };
}

export function displayCompany(company: string): string {
  return company.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function salaryFromRecruitee(value: unknown): SalaryRange | null {
  if (!isRecord(value) || !/year|annual/i.test(valueText(value.period))) return null;
  const min = Number(value.min);
  const max = Number(value.max);
  const currency = valueText(value.currency).toUpperCase();
  if (!Number.isFinite(min) || min <= 0 || currency !== "USD") return null;
  return { min, max: Number.isFinite(max) && max > 0 ? max : null, currency };
}

function mapGreenhouse(board: DirectoryBoard, payload: unknown): JobListing[] {
  if (!isRecord(payload) || !Array.isArray(payload.jobs)) throw new Error("Greenhouse returned an unexpected response.");
  return payload.jobs.flatMap((item) => {
    if (!isRecord(item) || !valueText(item.title) || !valueText(item.absolute_url)) return [];
    const description = plainText(valueText(item.content));
    const metadata = asArray(item.metadata).find((field) =>
      isRecord(field) && /salary|compensation|pay range/i.test(valueText(field.name)) && isRecord(field.value),
    );
    const pay = isRecord(metadata) && isRecord(metadata.value) ? metadata.value : null;
    const min = Number(pay?.min_value ?? pay?.minimum);
    const salary = min > 0 && String(pay?.unit ?? pay?.currency ?? "").toUpperCase() === "USD"
      ? { min, max: Number(pay?.max_value ?? pay?.maximum) || null, currency: "USD" }
      : salaryFromDescription(description);
    const location = isRecord(item.location) ? valueText(item.location.name) : "";
    return [makeListing(
      board, String(item.id ?? item.absolute_url), valueText(item.title), valueText(item.absolute_url),
      location, description, valueText(item.first_published), salary,
    )];
  });
}

function mapAshby(board: DirectoryBoard, payload: unknown): JobListing[] {
  if (!isRecord(payload) || !Array.isArray(payload.jobs)) throw new Error("Ashby returned an unexpected response.");
  return payload.jobs.flatMap((item) => {
    if (!isRecord(item) || !valueText(item.title) || !valueText(item.jobUrl)) return [];
    const description = valueText(item.descriptionPlain) || plainText(valueText(item.descriptionHtml));
    const compensation = isRecord(item.compensation) ? item.compensation : null;
    const tiers = compensation && Array.isArray(compensation.compensationTiers) ? compensation.compensationTiers : [];
    const salaryParts = tiers.flatMap((tier) => {
      if (!isRecord(tier) || !Array.isArray(tier.components)) return [];
      return tier.components.flatMap((component) => {
        if (!isRecord(component) || component.compensationType !== "Salary" ||
          component.currencyCode !== "USD" || !/year|annual/i.test(valueText(component.interval))) return [];
        const min = Number(component.minValue);
        const max = Number(component.maxValue);
        return min > 0 ? [{ min, max: max > 0 ? max : null, currency: "USD" }] : [];
      });
    });
    const salary = salaryParts.length ? {
      min: Math.min(...salaryParts.map((part) => part.min)),
      max: Math.max(...salaryParts.map((part) => part.max ?? part.min)),
      currency: "USD",
    } : salaryFromDescription(description);
    const locations = [
      valueText(item.location),
      ...asArray(item.secondaryLocations).map((value) => typeof value === "string" ? value : isRecord(value) ? valueText(value.location) : ""),
    ].filter(Boolean).join("; ");
    const location = item.isRemote ? `Remote: ${locations}` : locations;
    return [makeListing(
      board, String(item.id ?? item.jobUrl), valueText(item.title), valueText(item.jobUrl),
      location, description, valueText(item.publishedAt), salary,
    )];
  });
}

function mapLever(board: DirectoryBoard, payload: unknown): JobListing[] {
  if (!Array.isArray(payload)) throw new Error("Lever returned an unexpected response.");
  return payload.flatMap((item) => {
    if (!isRecord(item) || !valueText(item.text) || !valueText(item.hostedUrl)) return [];
    const categories = isRecord(item.categories) ? item.categories : {};
    const description = valueText(item.descriptionPlain) || plainText(valueText(item.description));
    return [makeListing(
      board, String(item.id ?? item.hostedUrl), valueText(item.text), valueText(item.hostedUrl),
      valueText(categories.location) || valueText(item.workplaceType), description,
      item.createdAt ? (Number.isFinite(Number(item.createdAt))
        ? new Date(Number(item.createdAt)).toISOString()
        : valueText(item.createdAt)) : "",
      salaryFromDescription(description),
    )];
  });
}

function mapWorkable(board: DirectoryBoard, payload: unknown): JobListing[] {
  if (!isRecord(payload) || !Array.isArray(payload.jobs)) throw new Error("Workable returned an unexpected response.");
  return payload.jobs.flatMap((item) => {
    if (!isRecord(item) || !valueText(item.title)) return [];
    const locations = asArray(item.locations).flatMap((location) => {
      if (!isRecord(location)) return [];
      return [[location.city, location.state, location.country].map(valueText).filter(Boolean).join(", ")];
    });
    const location = locations.join("; ") || [item.city, item.state, item.country].map(valueText).filter(Boolean).join(", ");
    const url = valueText(item.url) || valueText(item.application_url) || `${board.board_url}/j/${encodeURIComponent(valueText(item.shortcode))}`;
    return [makeListing(
      board, valueText(item.shortcode) || String(item.code ?? url), valueText(item.title), url,
      item.telecommuting ? `Remote: ${location}` : location, "", valueText(item.published_on),
    )];
  });
}

function mapRecruitee(board: DirectoryBoard, payload: unknown): JobListing[] {
  if (!isRecord(payload) || !Array.isArray(payload.offers)) throw new Error("Recruitee returned an unexpected response.");
  return payload.offers.flatMap((item) => {
    if (!isRecord(item) || !valueText(item.title)) return [];
    const translations = isRecord(item.translations) ? item.translations : {};
    const english = isRecord(translations.en) ? translations.en : {};
    const description = plainText(valueText(item.description) || valueText(english.description));
    const url = valueText(item.careers_url) || `${board.board_url}/o/${encodeURIComponent(valueText(item.slug))}`;
    const location = [
      valueText(item.location),
      ...asArray(item.locations).map((location) => isRecord(location) ? valueText(location.name) : ""),
      valueText(item.country),
    ].filter(Boolean).join(", ");
    const salary = salaryFromRecruitee(item.salary) ?? salaryFromDescription(description);
    return [makeListing(
      board, String(item.id ?? item.slug ?? url), valueText(item.title), url,
      item.remote ? `Remote: ${location}` : item.hybrid ? `Hybrid: ${location}` : location,
      description, valueText(item.published_at), salary,
    )];
  });
}

function mapRippling(board: DirectoryBoard, payload: unknown): JobListing[] {
  if (!Array.isArray(payload)) throw new Error("Rippling returned an unexpected response.");
  return payload.flatMap((item) => {
    if (!isRecord(item) || !valueText(item.name) || !valueText(item.url)) return [];
    const place = isRecord(item.workLocation) ? valueText(item.workLocation.label) : "";
    const location = valueText(item.workplaceType) === "REMOTE" ? `Remote: ${place}` : place;
    return [makeListing(board, String(item.uuid ?? item.url), valueText(item.name), valueText(item.url), location, "")];
  });
}

function mapPersonio(board: DirectoryBoard, xml: string): JobListing[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Personio returned invalid XML.");
  return Array.from(doc.querySelectorAll("position")).flatMap((item) => {
    const title = item.querySelector("name")?.textContent?.trim() ?? "";
    const id = item.querySelector("id")?.textContent?.trim() ?? "";
    if (!title || !id) return [];
    const description = plainText(Array.from(item.querySelectorAll("jobDescription"))
      .map((part) => part.textContent ?? "").join(" "));
    const locations = [
      item.querySelector("office")?.textContent?.trim(),
      ...Array.from(item.querySelectorAll("additionalOffices office")).map((office) => office.textContent?.trim() ?? ""),
    ].filter(Boolean).join("; ");
    const url = `${board.board_url.replace(/\/$/, "")}/job/${encodeURIComponent(id)}?language=en`;
    return [makeListing(
      board, id, title, url, locations, description,
      item.querySelector("createdAt")?.textContent?.trim() ?? "", salaryFromDescription(description),
    )];
  });
}

async function fetchBoard(board: DirectoryBoard): Promise<JobListing[]> {
  if (board.platform === "workday") {
    throw new Error("Workday blocks direct browser requests (CORS). Open the official board link instead.");
  }
  const url = new URL(board.api_url);
  if (board.platform === "ashby") url.searchParams.set("includeCompensation", "true");
  const response = await fetch(url, {
    headers: { Accept: board.platform === "personio" ? "application/xml, text/xml" : "application/json" },
  });
  if (!response.ok) throw new Error(`Board returned HTTP ${response.status}.`);
  switch (board.platform) {
    case "greenhouse": return mapGreenhouse(board, await response.json());
    case "ashby": return mapAshby(board, await response.json());
    case "lever": return mapLever(board, await response.json());
    case "personio": return mapPersonio(board, await response.text());
    case "recruitee": return mapRecruitee(board, await response.json());
    case "rippling": return mapRippling(board, await response.json());
    case "workable": return mapWorkable(board, await response.json());
  }
}

export async function fetchSelectedDirectoryBoards(
  boards: DirectoryBoard[],
): Promise<{ listings: JobListing[]; statuses: FeedStatus[] }> {
  if (boards.length > 100) throw new Error("Fetch no more than 100 directory boards in one batch.");
  const results: Array<{ listings: JobListing[]; status: FeedStatus }> = new Array(boards.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(4, boards.length) }, async () => {
    while (nextIndex < boards.length) {
      const index = nextIndex++;
      const board = boards[index];
      try {
        const listings = await fetchBoard(board);
        results[index] = {
          listings,
          status: { company: displayCompany(board.company), status: "loaded", count: listings.length },
        };
      } catch (error) {
        results[index] = {
          listings: [],
          status: {
            company: displayCompany(board.company),
            status: "failed",
            count: 0,
            error: error instanceof Error ? error.message : "The board could not be loaded.",
          },
        };
      }
    }
  });
  await Promise.all(workers);
  return {
    listings: results.flatMap((result) => result.listings),
    statuses: results.map((result) => result.status),
  };
}
