import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSelectedDirectoryBoards,
  loadJobBoardDirectory,
  selectDirectoryBoards,
  searchDirectory,
  topDirectoryBoards,
  type DirectoryBoard,
  type DirectoryPlatform,
} from "./directoryJobBoards";

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
    expect(selectDirectoryBoards(entries, 2).map((entry) => entry.company)).toEqual(["large", "medium"]);
    expect(topDirectoryBoards(entries, 0)).toEqual([]);
    expect(selectDirectoryBoards(entries, 0)).toEqual([]);
  });

  it("only loads directory entries with HTTPS URLs on the declared provider hosts", async () => {
    const valid = board("greenhouse", "stripe", "stripe");
    const invalid = { ...valid, api_url: "https://attacker.example/jobs" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([valid, invalid])));
    await expect(loadJobBoardDirectory()).resolves.toEqual([valid]);
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

  it("rejects directory searches above the 15-board limit", async () => {
    await expect(fetchSelectedDirectoryBoards(Array.from({ length: 16 }, (_, index) =>
      board("greenhouse", `company-${index}`, `board-${index}`),
    ))).rejects.toThrow("no more than 15");
  });
});
