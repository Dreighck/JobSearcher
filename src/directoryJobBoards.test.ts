import { afterEach, describe, expect, it, vi } from "vitest";
import {
  directoryBoardsForKeywordPreset,
  fetchSelectedDirectoryBoards,
  mergeSelectedDirectoryListings,
  loadJobBoardDirectory,
  loadWorkdayJobBoardDirectory,
  searchDirectory,
  topDirectoryBoards,
  type DirectoryBoard,
  type DirectoryPlatform,
} from "./directoryJobBoards";
import type { JobListing } from "./jobFeeds";

function board(platform: DirectoryPlatform, company = "example", token = "example"): DirectoryBoard {
  const apiUrl: Record<DirectoryPlatform, string> = {
    ashby: `https://api.ashbyhq.com/posting-api/job-board/${token}`,
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`,
    lever: `https://api.lever.co/v0/postings/${token}?mode=json`,
    personio: `https://${token}.jobs.personio.de/xml`,
    recruitee: `https://${token}.recruitee.com/api/offers/`,
    rippling: `https://api.rippling.com/platform/api/ats/v1/board/${token}/jobs`,
    workable: `https://apply.workable.com/api/v1/widget/accounts/${token}`,
    workday: `https://${token}.wd1.myworkdayjobs.com/wday/cxs/${token}/External/jobs`,
  };
  const boardUrl: Record<DirectoryPlatform, string> = {
    ashby: `https://jobs.ashbyhq.com/${token}`,
    greenhouse: `https://job-boards.greenhouse.io/${token}`,
    lever: `https://jobs.lever.co/${token}`,
    personio: `https://${token}.jobs.personio.de`,
    recruitee: `https://${token}.recruitee.com`,
    rippling: `https://ats.rippling.com/${token}`,
    workable: `https://apply.workable.com/${token}`,
    workday: `https://${token}.wd1.myworkdayjobs.com/External`,
  };
  return {
    platform,
    token,
    company,
    api_url: apiUrl[platform],
    board_url: boardUrl[platform],
    open_roles: 1,
    count_basis: "observed",
    region: "",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("job board directory", () => {
  it("searches directory entries by company, provider, and region", () => {
    const entries = [
      { ...board("workday", "nvidia"), region: "US" },
      { ...board("ashby", "stripe"), region: "US" },
      { ...board("lever", "example"), region: "EU" },
    ];
    expect(searchDirectory(entries, "nvidia", "all").map((entry) => entry.company)).toEqual(["nvidia"]);
    expect(searchDirectory(entries, "ashby", "ashby").map((entry) => entry.company)).toEqual(["stripe"]);
    expect(searchDirectory(entries, "EU", "all").map((entry) => entry.company)).toEqual(["example"]);
  });

  it("preselects the highest-role fetchable boards with one board per employer", () => {
    const entries = [
      { ...board("workday", "blocked"), open_roles: 50000 },
      { ...board("greenhouse", "large"), open_roles: 250 },
      { ...board("ashby", "large", "large-secondary"), open_roles: 200 },
      { ...board("lever", "medium"), open_roles: 100 },
    ];
    expect(topDirectoryBoards(entries, 2).map((entry) => entry.company)).toEqual(["large", "medium"]);
    expect(topDirectoryBoards(entries, 0)).toEqual([]);
  });

  it("uses curated preset employers first and fills defaults to 30 with overall leaders", () => {
    const entries = [
      board("greenhouse", "Google", "google"),
      board("ashby", "Microsoft", "microsoft"),
      ...Array.from({ length: 30 }, (_, index) =>
        ({ ...board("greenhouse", `Company ${index}`, `company-${index}`), open_roles: 100 - index }),
      ),
      board("workday", "Workday only", "workday"),
    ];
    const selected = directoryBoardsForKeywordPreset(entries, "software-engineer");

    expect(selected).toHaveLength(30);
    expect(selected.slice(0, 2).map((entry) => entry.company)).toEqual(["Google", "Microsoft"]);
    expect(selected.every((entry) => entry.platform !== "workday")).toBe(true);
    expect(new Set(selected.map((entry) => entry.company.toLowerCase())).size).toBe(30);
  });

  it("keeps listings only for selected directory boards and deduplicates URLs", () => {
    const listing = (provider: JobListing["provider"], boardName: string, url: string): JobListing => ({
      id: `${provider}-${boardName}`,
      source: boardName,
      title: "Software Engineer",
      company: boardName,
      url,
      location: "Remote: United States",
      description: "",
      salary: null,
      publishedAt: "",
      provider,
      board: boardName,
    });
    const current = [
      listing("greenhouse", "selected", "https://jobs.test/selected"),
      listing("ashby", "removed", "https://jobs.test/removed"),
      listing("remoteok", "Remote OK", "https://jobs.test/public"),
    ];
    const incoming = [
      listing("greenhouse", "selected", "https://jobs.test/selected"),
      listing("lever", "new", "https://jobs.test/new"),
    ];

    expect(mergeSelectedDirectoryListings(current, incoming, [
      "greenhouse:selected", "lever:new",
    ])).toEqual([
      current[0],
      current[2],
      incoming[1],
    ]);
  });

  it("only loads directory entries with HTTPS URLs on the declared provider hosts", async () => {
    const valid = board("greenhouse", "stripe", "stripe");
    const invalid = { ...valid, api_url: "https://attacker.example/jobs" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([valid, invalid])));
    await expect(loadJobBoardDirectory()).resolves.toEqual([valid]);
  });

  it("keeps Workday entries out of the searchable directory and loads them separately", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json([board("greenhouse", "searchable"), board("workday", "workday-co")]))
      .mockResolvedValueOnce(Response.json([board("greenhouse", "searchable"), board("workday", "workday-co")]));
    vi.stubGlobal("fetch", fetch);
    await expect(loadJobBoardDirectory()).resolves.toMatchObject([{ company: "searchable", platform: "greenhouse" }]);
    await expect(loadWorkdayJobBoardDirectory()).resolves.toMatchObject([{ company: "workday-co", platform: "workday" }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("maps selected public board feeds and keeps Workday browse-only", async () => {
    const xmlPosition = {
      querySelector: (selector: string) => {
        const values: Record<string, string> = {
          name: "Software Engineer",
          id: "p-1",
          office: "Berlin",
          createdAt: "2026-01-01",
          jobDescription: "Build products",
        };
        return values[selector] ? { textContent: values[selector] } : null;
      },
      querySelectorAll: () => [],
    };
    vi.stubGlobal("DOMParser", class {
      parseFromString(input: string, type: string) {
        return type === "application/xml"
          ? { querySelector: () => null, querySelectorAll: (selector: string) => selector === "position" ? [xmlPosition] : [] }
          : { body: { textContent: input } };
      }
    });

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("greenhouse.io")) return Response.json({ jobs: [{
        id: 1, title: "Greenhouse Engineer", absolute_url: "https://jobs.test/gh", location: { name: "Remote" },
      }] });
      if (url.includes("ashbyhq.com")) return Response.json({ jobs: [{
        id: "a1", title: "Ashby Engineer", jobUrl: "https://jobs.test/ashby", location: "Remote",
      }] });
      if (url.includes("lever.co")) return Response.json([{
        id: "l1", text: "Lever Engineer", hostedUrl: "https://jobs.test/lever",
        categories: { location: "Remote" }, descriptionPlain: "Build services",
      }]);
      if (url.includes("personio.de")) return new Response("<workzag-jobs/>", { status: 200 });
      if (url.includes("recruitee.com")) return Response.json({ offers: [{
        id: 1, title: "Recruitee Engineer", careers_url: "https://jobs.test/recruitee", description: "Build software",
      }] });
      if (url.includes("rippling.com")) return Response.json([{
        uuid: "r1", name: "Rippling Engineer", url: "https://jobs.test/rippling",
      }]);
      if (url.includes("workable.com")) return Response.json({ jobs: [{
        title: "Workable Engineer", shortcode: "w1", url: "https://jobs.test/workable",
      }] });
      return Response.json({});
    }));

    const boards = ([
      "greenhouse", "ashby", "lever", "personio", "recruitee", "rippling", "workable", "workday",
    ] as DirectoryPlatform[]).map((platform) => board(platform));
    const result = await fetchSelectedDirectoryBoards(boards);

    expect(result.listings.map((job) => job.provider)).toEqual([
      "greenhouse", "ashby", "lever", "personio", "recruitee", "rippling", "workable",
    ]);
    expect(result.statuses.filter((status) => status.status === "loaded")).toHaveLength(7);
    expect(result.statuses.find((status) => status.company === "Example" && status.status === "failed")?.error)
      .toContain("CORS");
    expect(result.listings.find((job) => job.provider === "personio")).toMatchObject({
      title: "Software Engineer",
      location: "Berlin",
    });
  });

  it("rejects directory batches above the 100-board limit", async () => {
    const fetch = vi.fn(async () => Response.json({ jobs: [] }));
    vi.stubGlobal("fetch", fetch);
    const hundredBoards = Array.from({ length: 100 }, (_, index) =>
      board("greenhouse", `company-${index}`, `board-${index}`),
    );
    const result = await fetchSelectedDirectoryBoards(hundredBoards);
    expect(result.listings).toEqual([]);
    expect(result.statuses).toHaveLength(100);
    expect(result.statuses.every((status) => status.status === "loaded")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(100);
    await expect(fetchSelectedDirectoryBoards(Array.from({ length: 101 }, (_, index) =>
      board("greenhouse", `company-${index}`, `board-${index}`),
    ))).rejects.toThrow("no more than 100");
  });
});
