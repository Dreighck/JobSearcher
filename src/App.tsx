import { useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth/mammoth.browser";
import { parseJobAlert } from "./alerts";
import { createDraft } from "./drafting";
import { exportJobs } from "./export";
import { parseExtractedJobs } from "./importedJobs";
import { fetchPublicJobBoards } from "./publicJobBoards";
import {
  fetchSelectedDirectoryBoards,
  directoryBoardsForKeywordPreset,
  jobKeywordPresets,
  loadJobBoardDirectory,
  loadWorkdayJobBoardDirectory,
  searchDirectory,
  topDirectoryBoards,
  type DirectoryBoard,
  type DirectoryPlatform,
} from "./directoryJobBoards";
import {
  fetchCompanyFeeds,
  loadListingDetails,
  matchesJobSearch,
  manualOnlyCompanies,
  salaryUndisclosed,
  supportedCompanyFeeds,
  type JobListing,
  type JobSearchFilters,
} from "./jobFeeds";
import { getMatch } from "./matching";
import { deleteAllData, loadData, saveData } from "./storage";
import {
  defaultData,
  type ApplicationStatus,
  type Job,
  type LocalData,
  type Profile,
} from "./types";

type View = "overview" | "discover" | "jobs" | "profile";
const statuses: ApplicationStatus[] = ["Saved", "Preparing", "Applied", "Interviewing", "Offer", "Closed"];

const defaultSearchFilters: JobSearchFilters = {
  keywords: "",
  company: "",
  location: "",
  locationMode: "preferred",
  workArrangement: "any",
  minimumSalary: 140000,
  maximumSalary: null,
  includeUndisclosedSalary: true,
};

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function parseResumeText(text: string): Profile {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? "";
  const name = lines.find((line) => /^[A-Za-z][A-Za-z .'-]{2,45}$/.test(line) && !/@/.test(line)) ?? "";
  const skillVocabulary = [
    "TypeScript", "JavaScript", "React", "Node.js", "Python", "Java", "C#", ".NET",
    "SQL", "Azure", "AWS", "Docker", "Kubernetes", "Git", "HTML", "CSS", "REST",
    "PostgreSQL", "MongoDB", "Agile", "CI/CD",
  ];
  const skills = skillVocabulary.filter((skill) => new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
  const headline = lines.find((line) => /software|developer|engineer|technology/i.test(line) && line !== name) ?? "";
  const location = lines.find((line) => /lafayette|louisiana|remote/i.test(line)) ?? "";
  return {
    name,
    email,
    phone,
    location,
    headline,
    skills: skills.join(", "),
    highlights: "",
  };
}

function App() {
  const [data, setData] = useState<LocalData>(defaultData);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [feedListings, setFeedListings] = useState<JobListing[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [loadingListingId, setLoadingListingId] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<JobSearchFilters>(defaultSearchFilters);
  const [directoryBoards, setDirectoryBoards] = useState<DirectoryBoard[]>([]);
  const [workdayBoards, setWorkdayBoards] = useState<DirectoryBoard[]>([]);
  const [directoryError, setDirectoryError] = useState("");
  const [workdayDirectoryError, setWorkdayDirectoryError] = useState("");
  const [workdayDirectoryLoaded, setWorkdayDirectoryLoaded] = useState(false);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [workdayQuery, setWorkdayQuery] = useState("");
  const [directoryTab, setDirectoryTab] = useState<"searchable" | "workday">("searchable");
  const [keywordPreset, setKeywordPreset] = useState<(typeof jobKeywordPresets)[number]["id"] | "custom">("custom");
  const [directoryPlatform, setDirectoryPlatform] = useState<DirectoryPlatform | "all">("all");
  const [selectedDirectoryKeys, setSelectedDirectoryKeys] = useState<string[]>([]);
  const [directoryVisibleCount, setDirectoryVisibleCount] = useState(40);
  const [processedDirectoryKeys, setProcessedDirectoryKeys] = useState<string[]>([]);
  const [batchCooldown, setBatchCooldown] = useState(0);
  const directoryLoadStarted = useRef(false);
  const workdayDirectoryLoadStarted = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const extractedJobsInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData()
      .then(setData)
      .catch(() => setMessage("Browser storage could not be opened. Check your browser’s local storage settings."))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      saveData(data).catch(() => setMessage("Could not save locally. Check available browser storage."));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [data, ready]);

  useEffect(() => {
    if (view !== "discover" || directoryLoadStarted.current) return;
    directoryLoadStarted.current = true;
    loadJobBoardDirectory()
      .then((boards) => {
        setDirectoryBoards(boards);
      })
      .catch((error: unknown) => setDirectoryError(
        error instanceof Error ? error.message : "The company directory could not be loaded.",
      ));
  }, [view]);

  useEffect(() => {
    if (!directoryBoards.length) return;
    const defaults = keywordPreset === "custom"
      ? topDirectoryBoards(directoryBoards, 30)
      : directoryBoardsForKeywordPreset(directoryBoards, keywordPreset, 30);
    setSelectedDirectoryKeys(defaults.map((board) => `${board.platform}:${board.token}`));
    setProcessedDirectoryKeys([]);
  }, [directoryBoards, keywordPreset]);

  useEffect(() => {
    if (view !== "discover" || directoryTab !== "workday" || workdayDirectoryLoadStarted.current) return;
    workdayDirectoryLoadStarted.current = true;
    loadWorkdayJobBoardDirectory()
      .then((boards) => {
        setWorkdayBoards(boards);
        setWorkdayDirectoryLoaded(true);
      })
      .catch((error: unknown) => setWorkdayDirectoryError(
        error instanceof Error ? error.message : "The Workday directory could not be loaded.",
      ));
  }, [directoryTab, view]);

  useEffect(() => {
    if (batchCooldown <= 0) return;
    const timer = window.setTimeout(() => setBatchCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [batchCooldown]);

  const sortedJobs = useMemo(
    () => [...data.jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.jobs],
  );
  const selectedJob = data.jobs.find((job) => job.id === selectedId) ?? null;
  const counts = {
    active: data.jobs.filter((job) => !["Closed", "Offer"].includes(job.status)).length,
    interviewing: data.jobs.filter((job) => job.status === "Interviewing").length,
    offers: data.jobs.filter((job) => job.status === "Offer").length,
  };
  const filteredListings = feedListings.filter((listing) => matchesJobSearch(listing, searchFilters));
  const salaryQualifiedListings = filteredListings.filter((listing) => !salaryUndisclosed(listing));
  const salaryUnknownListings = filteredListings.filter(salaryUndisclosed);
  const directoryMatches = useMemo(
    () => searchDirectory(directoryBoards, directoryQuery, directoryPlatform),
    [directoryBoards, directoryPlatform, directoryQuery],
  );
  const visibleDirectoryMatches = directoryMatches.slice(0, directoryVisibleCount);
  const workdayMatches = useMemo(
    () => searchDirectory(workdayBoards, workdayQuery, "workday"),
    [workdayBoards, workdayQuery],
  );
  const visibleWorkdayMatches = workdayMatches.slice(0, directoryVisibleCount);
  const pendingDirectoryBoardCount = directoryBoards.filter((board) =>
    board.platform !== "workday" &&
    selectedDirectoryKeys.includes(`${board.platform}:${board.token}`) &&
    !processedDirectoryKeys.includes(`${board.platform}:${board.token}`),
  ).length;

  function updateSearchFilters(changes: Partial<JobSearchFilters>) {
    setSearchFilters((current) => ({ ...current, ...changes }));
  }

  function applyKeywordPreset(value: string) {
    if (value === "custom") {
      setKeywordPreset("custom");
      updateSearchFilters({ keywords: "" });
      return;
    }
    const preset = jobKeywordPresets.find((item) => item.id === value);
    if (!preset) return;
    setKeywordPreset(preset.id);
    updateSearchFilters({ keywords: preset.keyword });
  }

  function updateKeywordQuery(keywords: string) {
    if (keywordPreset !== "custom") setKeywordPreset("custom");
    updateSearchFilters({ keywords });
  }

  function updateProfile(profile: Profile) {
    setData((current) => ({ ...current, profile, profileReady: true }));
  }

  async function importResume(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setMessage("Choose a .docx resume. It will be read only in this browser.");
      return;
    }
    try {
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const extracted = parseResumeText(value);
      setData((current) => ({
        ...current,
        profile: { ...current.profile, ...Object.fromEntries(Object.entries(extracted).filter(([, value]) => value)) },
        profileReady: true,
      }));
      setView("profile");
      setMessage("Resume read locally. Review and correct the suggested profile before using it.");
    } catch {
      setMessage("Could not read that DOCX file. Try another copy or enter your profile manually.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function saveJob(values: Pick<Job, "title" | "company" | "url" | "description">): boolean {
    if (values.url && !safeExternalUrl(values.url)) {
      setMessage("Enter a valid http:// or https:// job link, or leave the URL blank.");
      return false;
    }
    const now = new Date().toISOString();
    if (editingJobId) {
      setData((current) => ({
        ...current,
        jobs: current.jobs.map((job) => job.id === editingJobId ? { ...job, ...values, updatedAt: now } : job),
      }));
      setSelectedId(editingJobId);
      setMessage("Job details updated.");
    } else {
      const job: Job = {
        ...values,
        id: makeId(),
        status: "Saved",
        notes: "",
        followUp: "",
        draft: "",
        createdAt: now,
        updatedAt: now,
      };
      setData((current) => ({ ...current, jobs: [job, ...current.jobs] }));
      setSelectedId(job.id);
      setMessage("Job saved on this device.");
    }
    setShowJobForm(false);
    setEditingJobId(null);
    return true;
  }

  function saveAlert(values: Pick<Job, "title" | "company" | "url" | "description">) {
    if (saveJob(values)) setShowAlertForm(false);
  }

  async function searchCompanyFeeds() {
    setLoadingFeeds(true);
    setMessage("");
    try {
      const [
        { listings: companyListings, statuses: companyStatuses },
        { listings: publicBoardListings, statuses: publicBoardStatuses },
      ] = await Promise.all([fetchCompanyFeeds(), fetchPublicJobBoards()]);
      const seen = new Set<string>();
      const listings = [...companyListings, ...publicBoardListings].filter((listing) => {
        const key = listing.url.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const statuses = [...companyStatuses, ...publicBoardStatuses];
      setFeedListings((current) => {
        const directoryProviders = new Set(["greenhouse", "ashby", "lever", "personio", "recruitee", "rippling", "workable", "workday"]);
        const existingDirectoryListings = current.filter((listing) => directoryProviders.has(listing.provider));
        const byUrl = new Map([...listings, ...existingDirectoryListings].map((listing) => [listing.url.toLowerCase(), listing]));
        return [...byUrl.values()];
      });
      const loaded = statuses.filter((status) => status.status === "loaded").length;
      const failed = statuses.length - loaded;
      setMessage(failed
        ? `Loaded ${loaded} of ${statuses.length} integrated feeds. Some feeds failed; see the listings below for available results.`
        : `Loaded current postings from all ${loaded} integrated feeds. Fetch employer-directory boards separately in batches.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Company feeds could not be loaded: ${error.message}` : "Company feeds could not be loaded.");
    } finally {
      setLoadingFeeds(false);
    }
  }

  function toggleDirectoryBoard(board: DirectoryBoard) {
    const key = `${board.platform}:${board.token}`;
    setProcessedDirectoryKeys((current) => current.filter((value) => value !== key));
    setSelectedDirectoryKeys((current) => {
      if (current.includes(key)) return current.filter((value) => value !== key);
      return [...current, key];
    });
  }

  function selectAllDirectoryMatches() {
    setSelectedDirectoryKeys(directoryMatches.map((board) => `${board.platform}:${board.token}`));
    setProcessedDirectoryKeys([]);
    setMessage(`Selected all ${directoryMatches.length.toLocaleString()} matching directory boards. Fetch results manually in batches of up to 100.`);
  }

  function clearDirectorySelection() {
    setSelectedDirectoryKeys([]);
    setProcessedDirectoryKeys([]);
  }

  async function fetchNextDirectoryBatch() {
    if (batchCooldown > 0) return;
    const selected = directoryBoards.filter((board) =>
      selectedDirectoryKeys.includes(`${board.platform}:${board.token}`) &&
      !processedDirectoryKeys.includes(`${board.platform}:${board.token}`),
    );
    if (!selected.length) {
      setMessage("There are no unsearched selected directory boards.");
      return;
    }
    const skippedBoards = selected.filter((board) => board.platform === "workday");
    const batch = selected.filter((board) => board.platform !== "workday").slice(0, 100);
    if (!batch.length) {
      setProcessedDirectoryKeys((current) => [...current, ...skippedBoards.map((board) => `${board.platform}:${board.token}`)]);
      setMessage("The remaining selected entries use Workday, which cannot be fetched directly from the browser. Open their board links from the directory.");
      return;
    }
    setLoadingFeeds(true);
    setMessage("");
    try {
      const { listings, statuses } = await fetchSelectedDirectoryBoards(batch);
      setProcessedDirectoryKeys((current) => [...current, ...skippedBoards.map((board) => `${board.platform}:${board.token}`), ...batch.map((board) => `${board.platform}:${board.token}`)]);
      setFeedListings((current) => {
        const byUrl = new Map(current.map((listing) => [listing.url.toLowerCase(), listing]));
        for (const listing of listings) byUrl.set(listing.url.toLowerCase(), listing);
        return [...byUrl.values()];
      });
      setBatchCooldown(10);
      setMessage(`Fetched a batch of ${batch.length} directory boards (${statuses.filter((status) => status.status === "loaded").length} succeeded). Skipped ${skippedBoards.length} Workday boards. ${Math.max(0, selected.length - batch.length - skippedBoards.length)} fetchable boards remain; start the next batch manually after the pause.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Directory batch failed: ${error.message}` : "Directory batch failed unexpectedly.");
    } finally {
      setLoadingFeeds(false);
    }
  }

  async function retryDirectoryLoad() {
    if (directoryTab === "workday") {
      setWorkdayDirectoryError("");
      try {
        const boards = await loadWorkdayJobBoardDirectory();
        setWorkdayBoards(boards);
        setWorkdayDirectoryLoaded(true);
        workdayDirectoryLoadStarted.current = true;
      } catch (error) {
        setWorkdayDirectoryError(error instanceof Error ? error.message : "The Workday directory could not be loaded.");
      }
      return;
    }
    setDirectoryError("");
    try {
      const boards = await loadJobBoardDirectory();
      setDirectoryBoards(boards);
      directoryLoadStarted.current = true;
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : "The searchable company directory could not be loaded.");
    }
  }

  async function showListingDetails(listing: JobListing) {
    setLoadingListingId(listing.id);
    try {
      const detailed = await loadListingDetails(listing);
      setFeedListings((current) => current.map((item) =>
        item.source === detailed.source && item.id === detailed.id ? detailed : item,
      ));
      if (detailed.salary && !matchesJobSearch(detailed, searchFilters)) {
        setMessage("Job details loaded. The updated salary or listing details do not match your current search filters.");
      } else if (detailed.salary) {
        setMessage("Job details loaded. The published salary matches your current search range.");
      } else {
        setMessage("Job details loaded, but no salary range was found. It remains in the undisclosed-salary section.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the job details from the official feed.");
    } finally {
      setLoadingListingId(null);
    }
  }

  function saveFeedListing(listing: JobListing) {
    if (!safeExternalUrl(listing.url)) {
      setMessage("This job source returned an invalid application link.");
      return;
    }
    const sourceId = `${listing.source.toLowerCase()}:${listing.id}`;
    if (data.jobs.some((job) => job.sourceId === sourceId)) {
      setMessage("This job is already in your applications.");
      return;
    }
    const now = new Date().toISOString();
    const job: Job = {
      id: makeId(),
      sourceId,
      source: listing.source,
      sourceUrl: listing.sourceUrl,
      title: listing.title,
      company: listing.company,
      url: listing.url,
      location: listing.location,
      salaryMin: listing.salary?.min,
      salaryMax: listing.salary?.max ?? undefined,
      salaryCurrency: listing.salary?.currency,
      description: listing.description,
      status: "Saved",
      notes: "",
      followUp: "",
      draft: "",
      createdAt: now,
      updatedAt: now,
    };
    setData((current) => ({ ...current, jobs: [job, ...current.jobs] }));
    setSelectedId(job.id);
    setView("jobs");
    setMessage(listing.description
      ? "Job saved in your application tracker. Review the official listing and apply yourself."
      : "Job saved without a job description. Open the official listing and add description details if you want to draft a cover letter.");
  }

  async function importExtractedJobs(file?: File) {
    if (!file) return;
    try {
      const { jobs: extracted, rejected } = parseExtractedJobs(JSON.parse(await file.text()));
      const now = new Date().toISOString();
      const existingUrls = new Set(data.jobs.map((job) => job.url));
      const additions = extracted.filter((job) => {
        if (existingUrls.has(job.url)) return false;
        existingUrls.add(job.url);
        return true;
      });
      const imported: Job[] = additions.map((job) => ({
        id: makeId(),
        sourceId: `authorized:${job.url}`,
        source: job.source || "Authorized site import",
        sourceUrl: job.sourcePage,
        title: job.title,
        company: job.company,
        url: job.url,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        description: job.description,
        status: "Saved",
        notes: job.datePosted ? `Posted: ${job.datePosted}${job.employmentType ? ` · ${job.employmentType}` : ""}` : "",
        followUp: "",
        draft: "",
        createdAt: now,
        updatedAt: now,
      }));
      if (imported.length) setData((current) => ({ ...current, jobs: [...imported, ...current.jobs] }));
      setMessage(`Imported ${imported.length} new job(s); skipped ${rejected + (extracted.length - additions.length)} invalid or duplicate listing(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import extracted jobs.");
    } finally {
      if (extractedJobsInput.current) extractedJobsInput.current.value = "";
    }
  }

  function downloadExtensionProfile() {
    const profileFile = new Blob([JSON.stringify({
      name: data.profile.name,
      email: data.profile.email,
      phone: data.profile.phone,
      location: data.profile.location,
    }, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(profileFile);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "fieldnote-autofill-profile.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setMessage("Profile JSON downloaded. Import it into the Fieldnote Autofill extension.");
  }

  function updateJob(id: string, changes: Partial<Job>) {
    setData((current) => ({
      ...current,
      jobs: current.jobs.map((job) => job.id === id ? { ...job, ...changes, updatedAt: new Date().toISOString() } : job),
    }));
  }

  async function removeAll() {
    if (!window.confirm("Delete your saved profile, all jobs, tracking notes, and drafts from this browser? This cannot be undone.")) return;
    await deleteAllData();
    setData(defaultData);
    setSelectedId(null);
    setMessage("All Fieldnote data was deleted from this browser.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setView("overview"); }}>
          <span className="brand-mark">f.</span>
          <span>fieldnote<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          <button className={view === "overview" ? "nav-item active" : "nav-item"} onClick={() => setView("overview")}><span className="nav-icon">⌂</span> Overview</button>
          <button className={view === "discover" ? "nav-item active" : "nav-item"} onClick={() => setView("discover")}><span className="nav-icon">⌕</span> Find jobs</button>
          <button className={view === "jobs" ? "nav-item active" : "nav-item"} onClick={() => setView("jobs")}><span className="nav-icon">▤</span> Applications <span className="nav-count">{data.jobs.length}</span></button>
          <button className={view === "profile" ? "nav-item active" : "nav-item"} onClick={() => setView("profile")}><span className="nav-icon">◎</span> Your profile</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">◈</span>
          <div><strong>Private by design</strong><p>Your resume stays local. Public job feeds load only when you choose to search.</p></div>
          </div>
          <div className="profile-chip">
            <div className="avatar">{data.profile.name ? data.profile.name.slice(0, 1).toUpperCase() : "D"}</div>
            <div><strong>{data.profile.name || "Your workspace"}</strong><small>Local profile</small></div>
            <span className="chip-dot" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {view === "overview" ? "Overview" : view === "discover" ? "Find jobs" : view === "jobs" ? "Applications" : "Your profile"}</div>
          <div className="topbar-actions"><span className="local-indicator"><i /> Saved locally</span><button className="icon-button" title="Export applications as CSV" onClick={() => exportJobs(data.jobs)} aria-label="Export CSV">⇩</button></div>
        </header>
        {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}

        {view === "overview" && (
          <section className="page">
            <div className="welcome-row">
              <div><div className="eyebrow">YOUR JOB SEARCH, GROUNDED</div><h1>A little more <em>clarity.</em></h1><p className="page-subtitle">A private space to find your fit and keep your next move in view.</p></div>
              <div className="welcome-actions"><button className="button button-outline" onClick={() => setShowAlertForm(true)}>Import alert text</button><button className="button button-dark" onClick={() => { setEditingJobId(null); setShowJobForm(true); }}>＋ Add a job</button></div>
            </div>
            <div className="metric-grid">
              <Metric label="Active opportunities" value={counts.active} note="Roles in your pipeline" icon="↗" />
              <Metric label="In conversation" value={counts.interviewing} note="Interviewing right now" icon="◌" />
              <Metric label="Offers received" value={counts.offers} note="Good things happen" icon="✳" />
            </div>
            <div className="section-heading"><div><h2>Recent opportunities</h2><p>Your applications, all in one calm place.</p></div><button className="text-button" onClick={() => setView("jobs")}>View all <span>→</span></button></div>
            {sortedJobs.length ? <div className="job-list">{sortedJobs.slice(0, 4).map((job) => <JobRow key={job.id} job={job} profile={data.profile} onOpen={() => { setSelectedId(job.id); setView("jobs"); }} />)}</div> : <EmptyState onAdd={() => setShowJobForm(true)} />}
            {!data.profileReady && <div className="onboarding-banner"><div className="onboarding-icon">✳</div><div><strong>Start with your experience</strong><p>Import your resume or add a few details to get more relevant match insights.</p></div><button className="button button-outline" onClick={() => setView("profile")}>Set up profile <span>→</span></button></div>}
            <div className="footer-note"><span>✦</span> Applications are always reviewed and submitted by you.</div>
          </section>
        )}

        {view === "profile" && (
          <section className="page narrow-page">
            <div className="eyebrow">ABOUT YOU</div><h1>Your <em>profile.</em></h1>
            <p className="page-subtitle">Import a DOCX resume for local extraction, then check every detail. Nothing is uploaded.</p>
            <div className="privacy-inline"><span>◈</span><div><strong>Processed only in this browser</strong><p>The resume file itself is not saved. Only the profile details below are kept in local browser storage.</p></div></div>
            <div className="import-card">
              <div className="import-symbol">↑</div><div><strong>{data.profileReady ? "Update from a resume" : "Import your resume"}</strong><p>Choose a .docx file. You can edit the extracted fields before using them.</p></div>
              <input ref={fileInput} className="hidden-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => importResume(event.target.files?.[0])} />
              <button className="button button-outline" onClick={() => fileInput.current?.click()}>Choose .docx</button>
            </div>
            <div className="import-card">
              <div className="import-symbol">↗</div><div><strong>Set up application autofill</strong><p>Download your name and contact details for the local Chrome/Edge extension. Review them before importing.</p></div>
              <button className="button button-outline" onClick={downloadExtensionProfile}>Download profile JSON</button>
            </div>
            <div className="form-card">
              <div className="form-card-heading"><div><h2>Profile details</h2><p>Used to personalize matching and cover-letter drafts.</p></div><span className="local-pill">Saved on device</span></div>
              <ProfileForm profile={data.profile} onChange={updateProfile} />
            </div>
            <div className="danger-zone"><div><strong>Delete all local data</strong><p>Remove your profile, applications, notes, and drafts from this browser.</p></div><button className="button button-danger" onClick={removeAll}>Delete all data</button></div>
          </section>
        )}

        {view === "discover" && (
          <section className="page">
            <div className="welcome-row">
              <div><div className="eyebrow">PUBLIC JOB FEEDS</div><h1>Find your <em>next role.</em></h1><p className="page-subtitle">Search public employer and job-board listings, then tune the results to your preferences.</p></div>
              <button className="button button-dark" onClick={searchCompanyFeeds} disabled={loadingFeeds}>{loadingFeeds ? "Loading feeds…" : "Refresh integrated feeds"} <span>↻</span></button>
            </div>
            <div className="privacy-inline"><span>◈</span><div><strong>Public job listings only</strong><p>Search loads public job-board feeds from supported sources. Your resume and profile are not sent. Search filters are applied locally to the listings; you review and submit applications yourself.</p></div></div>
            <div className="form-card search-filter-card">
              <div className="form-card-heading"><div><h2>Search filters</h2><p>Filters update results as you type. Separate keywords with commas to match any term.</p></div><button className="text-button" onClick={() => setSearchFilters(defaultSearchFilters)}>Reset filters</button></div>
              <div className="fields-grid">
                <label>Keyword preset
                  <select value={keywordPreset} onChange={(event) => applyKeywordPreset(event.target.value)}>
                    <option value="custom">Custom keywords (top 30 companies)</option>
                    {jobKeywordPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.keyword}</option>)}
                  </select>
                </label>
                <label className="span-two">Keywords<input type="search" value={searchFilters.keywords} placeholder="e.g. backend, Python, staff engineer" onChange={(event) => updateKeywordQuery(event.target.value)} /></label>
                <label>Company or job board<input type="search" value={searchFilters.company} placeholder="Any company or source" onChange={(event) => updateSearchFilters({ company: event.target.value })} /></label>
                <label>Location preference<select value={searchFilters.locationMode} onChange={(event) => updateSearchFilters({ locationMode: event.target.value as JobSearchFilters["locationMode"] })}><option value="preferred">Remote (not known international) or Louisiana</option><option value="anywhere">Anywhere</option><option value="custom">Specific location</option></select></label>
                {searchFilters.locationMode === "custom" && <label>Location contains<input type="search" value={searchFilters.location} placeholder="e.g. Austin, Texas" onChange={(event) => updateSearchFilters({ location: event.target.value })} /></label>}
                <label>Work arrangement<select value={searchFilters.workArrangement} onChange={(event) => updateSearchFilters({ workArrangement: event.target.value as JobSearchFilters["workArrangement"] })}><option value="any">Any arrangement</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
                <label>Minimum annual salary (USD)<input type="number" min="0" step="5000" value={searchFilters.minimumSalary ?? ""} placeholder="No minimum" onChange={(event) => updateSearchFilters({ minimumSalary: event.target.value ? Number(event.target.value) : null })} /></label>
                <label>Maximum annual salary (USD)<input type="number" min="0" step="5000" value={searchFilters.maximumSalary ?? ""} placeholder="No maximum" onChange={(event) => updateSearchFilters({ maximumSalary: event.target.value ? Number(event.target.value) : null })} /></label>
                <label className="search-checkbox"><input type="checkbox" checked={searchFilters.includeUndisclosedSalary} onChange={(event) => updateSearchFilters({ includeUndisclosedSalary: event.target.checked })} /> Include jobs with undisclosed salary</label>
              </div>
              <p className="search-filter-note">Salary ranges must overlap your selected range. Only disclosed USD salaries can be compared; jobs without a salary are listed separately when included.</p>
            </div>
            <p className="feed-company-names">Integrated feeds: {supportedCompanyFeeds.map((source) => source.company).join(", ")}.</p>
            <div className="directory-panel">
              <div className="directory-tabs" role="tablist" aria-label="Employer board directories">
                <button role="tab" aria-selected={directoryTab === "searchable"} className={directoryTab === "searchable" ? "directory-tab active" : "directory-tab"} onClick={() => setDirectoryTab("searchable")}>
                  Searchable boards <span>{directoryBoards.length.toLocaleString()}</span>
                </button>
                <button role="tab" aria-selected={directoryTab === "workday"} className={directoryTab === "workday" ? "directory-tab active" : "directory-tab"} onClick={() => setDirectoryTab("workday")}>
                  Workday boards <span>{workdayBoards.length.toLocaleString()}</span>
                </button>
              </div>
              {directoryTab === "searchable" ? (
                <>
                  <div className="directory-heading directory-tab-heading">
                    <div><h2>Choose employers to search</h2><p>{directoryBoards.length ? `${directoryBoards.length.toLocaleString()} searchable public boards; 30 companies are selected by default. Choose a keyword preset for a tailored default list, or add and remove companies below.` : directoryError || "Loading the searchable employer directory…"}</p></div>
                    <button className="button button-outline" onClick={fetchNextDirectoryBatch} disabled={loadingFeeds || batchCooldown > 0 || pendingDirectoryBoardCount === 0}>
                      {loadingFeeds ? "Fetching batch…" : batchCooldown > 0 ? `Next batch in ${batchCooldown}s` : `Fetch next batch (${Math.min(100, pendingDirectoryBoardCount)} max)`}
                    </button>
                  </div>
                  <details className="directory-dropdown">
                    <summary>Employer defaults and batch selection <span>{selectedDirectoryKeys.length.toLocaleString()} selected</span></summary>
                    <div className="directory-dropdown-panel">
                  <p className="directory-help">Use the checkboxes to add or remove companies from the current defaults. These selections are also the companies used by Fetch next batch.</p>
                  <div className="directory-controls">
                    <label>Search company, platform, or region
                      <input type="search" value={directoryQuery} onChange={(event) => { setDirectoryQuery(event.target.value); setDirectoryVisibleCount(40); }} placeholder="e.g. NVIDIA, Stripe, healthcare" />
                    </label>
                    <label>Platform
                      <select value={directoryPlatform} onChange={(event) => { setDirectoryPlatform(event.target.value as DirectoryPlatform | "all"); setDirectoryVisibleCount(40); }}>
                        <option value="all">All platforms</option>
                        <option value="ashby">Ashby</option><option value="greenhouse">Greenhouse</option>
                        <option value="lever">Lever</option><option value="personio">Personio</option>
                        <option value="recruitee">Recruitee</option><option value="rippling">Rippling</option>
                        <option value="workable">Workable</option>
                      </select>
                    </label>
                  </div>
                  {directoryError && <p className="directory-error" role="alert">{directoryError} <button className="text-button" onClick={retryDirectoryLoad}>Retry</button></p>}
                  {!directoryQuery.trim() && directoryBoards.length === 0 ? <p className="directory-help">Loading the employer directory…</p> : directoryMatches.length ? (
                    <>
                      <p className="directory-help">{directoryMatches.length.toLocaleString()} matching boards, sorted by listed open roles. “Select all” applies to every match, including entries not currently visible. Fetching is manual and limited to 100 boards per batch with a pause between batches.</p>
                      <div className="directory-selection-actions">
                        <button className="text-button" onClick={selectAllDirectoryMatches}>Select all {directoryMatches.length.toLocaleString()} matches</button>
                        <button className="text-button" onClick={clearDirectorySelection} disabled={selectedDirectoryKeys.length === 0}>Clear selection</button>
                      </div>
                      <div className="directory-results">
                        {visibleDirectoryMatches.map((board) => {
                          const key = `${board.platform}:${board.token}`;
                          return <div className="directory-result" key={key}>
                            <label className="directory-select">
                              <input type="checkbox" checked={selectedDirectoryKeys.includes(key)} onChange={() => toggleDirectoryBoard(board)} />
                              <span><strong>{board.company}</strong><small>{board.platform} · {board.open_roles.toLocaleString()} listed roles{board.count_basis === "vendor" ? " · vendor estimate" : ""}{board.region ? ` · ${board.region}` : ""}</small></span>
                            </label>
                            <a href={board.board_url} target="_blank" rel="noreferrer">Open board ↗</a>
                          </div>;
                        })}
                      </div>
                      {directoryVisibleCount < directoryMatches.length && <button className="button button-outline directory-more" onClick={() => setDirectoryVisibleCount((count) => count + 40)}>Show 40 more ({(directoryMatches.length - directoryVisibleCount).toLocaleString()} remaining)</button>}
                    </>
                  ) : <p className="directory-help">No board matched that search. Try another company name or platform.</p>}
                    </div>
                  </details>
                  {directoryError && !directoryBoards.length && <p className="directory-error" role="alert">{directoryError} <button className="text-button" onClick={retryDirectoryLoad}>Retry</button></p>}
                  {!directoryBoards.length && !directoryError && <p className="directory-help">Loading the local employer directory…</p>}
                </>
              ) : (
                <div className="workday-directory">
                  <div className="directory-heading directory-tab-heading">
                    <div><h2>Workday career sites</h2><p>{workdayBoards.length.toLocaleString()} Workday company boards. Workday doesn’t allow the app to query postings directly; these links open the company’s job postings page.</p></div>
                  </div>
                  <label className="workday-search">Search Workday companies
                    <input type="search" value={workdayQuery} onChange={(event) => { setWorkdayQuery(event.target.value); setDirectoryVisibleCount(40); }} placeholder="Search company name…" />
                  </label>
                  {workdayDirectoryError && <p className="directory-error" role="alert">{workdayDirectoryError} <button className="text-button" onClick={retryDirectoryLoad}>Retry</button></p>}
                  {!workdayDirectoryLoaded && !workdayDirectoryError && <p className="directory-help">Loading the Workday company directory…</p>}
                  {workdayMatches.length ? (
                    <>
                      <p className="directory-help">{workdayMatches.length.toLocaleString()} matching Workday boards. Select a company link to view its current postings on Workday.</p>
                      <div className="directory-results">
                        {visibleWorkdayMatches.map((board) => (
                          <div className="directory-result workday-directory-result" key={`${board.platform}:${board.token}`}>
                            <span className="directory-select"><span><strong>{board.company}</strong><small>Workday · {board.open_roles.toLocaleString()} listed roles{board.count_basis === "vendor" ? " · vendor estimate" : ""}{board.region ? ` · ${board.region}` : ""}</small></span></span>
                            <a href={board.board_url} target="_blank" rel="noreferrer">View job postings ↗</a>
                          </div>
                        ))}
                      </div>
                      {directoryVisibleCount < workdayMatches.length && <button className="button button-outline directory-more" onClick={() => setDirectoryVisibleCount((count) => count + 40)}>Show 40 more ({(workdayMatches.length - directoryVisibleCount).toLocaleString()} remaining)</button>}
                    </>
                  ) : <p className="directory-help">{workdayQuery.trim() ? "No Workday company matched that search." : "Search by company to browse Workday job boards."}</p>}
                </div>
              )}
            </div>
            <div className="section-heading"><div><h2>Jobs matching your filters</h2><p>{salaryQualifiedListings.length} jobs with disclosed USD salary in the selected range.</p></div></div>
            {salaryQualifiedListings.length ? (
              <div className="feed-job-list">{salaryQualifiedListings.map((listing) => (
                <FeedJobCard key={`${listing.source}:${listing.id}`} listing={listing} loading={loadingListingId === listing.id}
                  onLoadDetails={() => showListingDetails(listing)} onSave={() => saveFeedListing(listing)} />
              ))}</div>
            ) : <div className="empty-state"><h3>{feedListings.length ? "No jobs match these filters." : "Refresh public job feeds to search."}</h3><p>Try broadening your keywords, location, role, or salary range. Some feeds may not disclose compensation.</p></div>}
            {searchFilters.includeUndisclosedSalary && (
              <>
                <div className="section-heading salary-unknown-heading"><div><h2>Salary not yet verified</h2><p>{salaryUnknownListings.length} jobs matching the other filters without a salary range in the feed. Load a posting’s details to check its official listing.</p></div></div>
                {salaryUnknownListings.length ? (
                  <div className="feed-job-list">{salaryUnknownListings.map((listing) => (
                    <FeedJobCard key={`${listing.source}:${listing.id}`} listing={listing} loading={loadingListingId === listing.id}
                      onLoadDetails={() => showListingDetails(listing)} onSave={() => saveFeedListing(listing)} />
                  ))}</div>
                ) : <p className="empty-hint">No roles need salary verification right now.</p>}
              </>
            )}
            <details className="manual-company-list"><summary>Other companies (career links and manual import)</summary><p>These companies’ public feeds are not yet integrated. Open their official careers site and use Import alert text or Add a job; the app will not scrape these pages.</p>
              <div>{manualOnlyCompanies.map((company) => <a href={company.url} target="_blank" rel="noreferrer" key={company.company}>{company.company} ↗</a>)}</div>
            </details>
            <p className="footer-note">Feed availability and salary disclosures vary. No login, site scraping, automated form filling, or application submission occurs here.</p>
          </section>
        )}

        {view === "jobs" && (
          <section className="page">
            <div className="welcome-row"><div><div className="eyebrow">YOUR PIPELINE</div><h1>Applications, <em>in focus.</em></h1><p className="page-subtitle">Import selected extracted jobs or job-alert text, then review and apply yourself.</p></div><div className="welcome-actions"><input ref={extractedJobsInput} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => importExtractedJobs(event.target.files?.[0])} /><button className="button button-outline" onClick={() => extractedJobsInput.current?.click()}>Import selected jobs JSON</button><button className="button button-outline" onClick={() => setShowAlertForm(true)}>Import alert text</button><button className="button button-dark" onClick={() => { setEditingJobId(null); setShowJobForm(true); }}>＋ Add a job</button></div></div>
            {selectedJob ? (
              <JobDetail
                key={selectedJob.id}
                job={selectedJob}
                profile={data.profile}
                onChange={(changes) => updateJob(selectedJob.id, changes)}
                onBack={() => setSelectedId(null)}
                onEdit={() => { setEditingJobId(selectedJob.id); setShowJobForm(true); }}
                onDelete={() => {
                  if (window.confirm(`Remove “${selectedJob.title || "this job"}” and its draft?`)) {
                    setData((current) => ({ ...current, jobs: current.jobs.filter((job) => job.id !== selectedJob.id) }));
                    setSelectedId(null);
                  }
                }}
              />
            ) : sortedJobs.length ? (
              <>
                <div className="list-toolbar"><span>{sortedJobs.length} {sortedJobs.length === 1 ? "opportunity" : "opportunities"}</span><button className="text-button" onClick={() => exportJobs(data.jobs)}>Export CSV ↓</button></div>
                <div className="job-list full-list">{sortedJobs.map((job) => <JobRow key={job.id} job={job} profile={data.profile} onOpen={() => setSelectedId(job.id)} />)}</div>
              </>
            ) : <EmptyState onAdd={() => setShowJobForm(true)} />}
            <div className="footer-note"><span>✦</span> Alert text is user-provided. Autofill is user-invoked; you review and submit.</div>
          </section>
        )}
      </main>
      {showJobForm && <JobFormModal
        job={editingJobId ? data.jobs.find((item) => item.id === editingJobId) : undefined}
        onClose={() => { setShowJobForm(false); setEditingJobId(null); }}
        onSave={saveJob}
      />}
      {showAlertForm && <JobAlertModal
        onClose={() => setShowAlertForm(false)}
        onSave={saveAlert}
      />}
    </div>
  );
}

function Metric({ label, value, note, icon }: { label: string; value: number; note: string; icon: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value.toString().padStart(2, "0")}</strong><small>{note}</small></div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><div className="empty-art"><span>✳</span><i>↗</i></div><h3>Your next opportunity starts here.</h3><p>Paste a job description and link to get an explainable match and a draft you can make your own.</p><button className="button button-dark" onClick={onAdd}>＋ Add your first job</button></div>;
}

function JobRow({ job, profile, onOpen }: { job: Job; profile: Profile; onOpen: () => void }) {
  const match = getMatch(job, profile);
  const monogram = (job.company || job.title || "?").slice(0, 1).toUpperCase();
  return <button className="job-row" onClick={onOpen}>
    <div className="company-mark">{monogram}</div><div className="job-primary"><strong>{job.title || "Untitled role"}</strong><span>{job.company || "Company not specified"} <i>·</i> Added {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
    <div className="job-match"><span className={`match-number ${match.score >= 70 ? "good" : ""}`}>{match.score}%</span><small>match</small></div>
    <span className={`status-badge status-${job.status.toLowerCase()}`}>{job.status}</span><span className="row-arrow">→</span>
  </button>;
}

function FeedJobCard({ listing, loading, onLoadDetails, onSave }: {
  listing: JobListing;
  loading: boolean;
  onLoadDetails: () => void;
  onSave: () => void;
}) {
  const salary = listing.salary
    ? `$${listing.salary.min.toLocaleString()}${listing.salary.max ? `–$${listing.salary.max.toLocaleString()}` : "+"} ${listing.salary.currency}`
    : listing.description ? "Salary not disclosed in the public posting" : "Salary not checked yet";
  const officialUrl = safeExternalUrl(listing.url);
  const sourceUrl = safeExternalUrl(listing.sourceUrl ?? "");
  return <article className="feed-job-card">
    <div className="feed-job-head"><div className="company-mark">{listing.company.slice(0, 1)}</div><div className="job-primary"><strong>{listing.title}</strong><span>{listing.company} <i>·</i> {listing.location || "Location not specified"}</span></div></div>
    <div className="feed-source">Source: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{listing.source}</a> : listing.source}</div>
    <div className={listing.salary ? "feed-salary" : "feed-salary unknown"}>{salary}</div>
    {listing.description && <p className="feed-description">{listing.description.slice(0, 220)}{listing.description.length > 220 ? "…" : ""}</p>}
    <div className="feed-job-actions">
      {officialUrl && <a className="button button-outline small-button" href={officialUrl} target="_blank" rel="noreferrer">Official listing ↗</a>}
      {!listing.description && listing.provider === "greenhouse" && <button className="button button-outline small-button" onClick={onLoadDetails} disabled={loading}>{loading ? "Loading…" : "Load details + salary"}</button>}
      <button className="button button-dark small-button" onClick={onSave}>Save to applications</button>
    </div>
  </article>;
}

function ProfileForm({ profile, onChange }: { profile: Profile; onChange: (profile: Profile) => void }) {
  const field = (key: keyof Profile, value: string) => onChange({ ...profile, [key]: value });
  return <div className="fields-grid">
    <label>Full name<input value={profile.name} onChange={(e) => field("name", e.target.value)} placeholder="Your name" /></label>
    <label>Email<input value={profile.email} onChange={(e) => field("email", e.target.value)} placeholder="you@example.com" /></label>
    <label>Phone<input value={profile.phone} onChange={(e) => field("phone", e.target.value)} placeholder="Your phone number" /></label>
    <label>Location<input value={profile.location} onChange={(e) => field("location", e.target.value)} placeholder="Lafayette, Louisiana or Remote" /></label>
    <label>Professional headline<input value={profile.headline} onChange={(e) => field("headline", e.target.value)} placeholder="Software engineer focused on…" /></label>
    <label className="span-two">Skills <span className="field-hint">Separate with commas</span><input value={profile.skills} onChange={(e) => field("skills", e.target.value)} placeholder="TypeScript, React, SQL…" /></label>
    <label className="span-two">Experience highlights<textarea rows={4} value={profile.highlights} onChange={(e) => field("highlights", e.target.value)} placeholder="A few accomplishments or strengths to personalize your draft…" /></label>
  </div>;
}

function JobAlertModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (values: Pick<Job, "title" | "company" | "url" | "description">) => void;
}) {
  const [alertText, setAlertText] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const suggestions = parseJobAlert(alertText);
  const titleValue = title ?? suggestions.title;
  const companyValue = company ?? suggestions.company;
  const urlValue = url ?? suggestions.url;

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="alert-form-title">
      <div className="modal-heading"><div><div className="eyebrow">USER-PROVIDED JOB ALERT</div><h2 id="alert-form-title">Import one listing</h2><p>Paste one listing from an alert email or message. Suggested fields are editable; no website is visited.</p></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!alertText.trim() || !titleValue.trim()) {
          setError("Paste the alert text and provide a job title.");
          return;
        }
        onSave({ title: titleValue.trim(), company: companyValue.trim(), url: urlValue.trim(), description: alertText.trim() });
      }}>
        <div className="fields-grid">
          <label className="span-two">Alert text <textarea rows={7} required value={alertText} onChange={(event) => setAlertText(event.target.value)} placeholder="Paste one job listing from a job-alert email or message…" /></label>
          <label>Job title<input required value={titleValue} onChange={(event) => setTitle(event.target.value)} placeholder="Software Engineer" /></label>
          <label>Company<input value={companyValue} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" /></label>
          <label className="span-two">Job URL <span className="field-hint">Reference only; not fetched</span><input type="url" value={urlValue} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer"><span>◈ Processed and stored locally</span><div><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-dark">Save listing <span>→</span></button></div></div>
      </form>
    </div>
  </div>;
}

function JobFormModal({ job, onClose, onSave }: {
  job?: Job;
  onClose: () => void;
  onSave: (values: Pick<Job, "title" | "company" | "url" | "description">) => void;
}) {
  const [title, setTitle] = useState(job?.title ?? "");
  const [company, setCompany] = useState(job?.company ?? "");
  const [url, setUrl] = useState(job?.url ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [error, setError] = useState("");
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="job-form-title">
      <div className="modal-heading"><div><div className="eyebrow">MANUAL JOB ENTRY</div><h2 id="job-form-title">{job ? "Edit opportunity" : "Add an opportunity"}</h2><p>Paste details you choose to save. The link is a reference only; Fieldnote won’t visit it.</p></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={(event) => { event.preventDefault(); if (!description.trim()) { setError("Add the job description to get an explainable match."); return; } onSave({ title: title.trim(), company: company.trim(), url: url.trim(), description: description.trim() }); }}>
        <div className="fields-grid">
          <label>Job title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Engineer" /></label>
          <label>Company<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" /></label>
          <label className="span-two">Job URL <span className="field-hint">Saved as a reference only; never fetched</span><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://company.example/careers/role" /></label>
          <label className="span-two">Job description<textarea rows={8} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste the description here…" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer"><span>◈ Stored only in your browser</span><div><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-dark">{job ? "Save changes" : "Save job"} <span>→</span></button></div></div>
      </form>
    </div>
  </div>;
}

function JobDetail({ job, profile, onChange, onBack, onEdit, onDelete }: {
  job: Job;
  profile: Profile;
  onChange: (changes: Partial<Job>) => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const match = getMatch(job, profile);
  const [copied, setCopied] = useState(false);
  const draft = job.draft || "";
  function generateDraft() {
    onChange({ draft: createDraft(profile, job) });
  }
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <div className="detail-view">
    <button className="back-link" onClick={onBack}>← All applications</button>
    <div className="detail-header"><div className="company-mark large-mark">{(job.company || job.title || "?").slice(0, 1).toUpperCase()}</div><div className="detail-title"><div className="eyebrow">OPPORTUNITY</div><h2>{job.title || "Untitled role"}</h2><p>{job.company || "Company not specified"} <span>·</span> Added {new Date(job.createdAt).toLocaleDateString()}</p>{job.location && <p>{job.location}</p>}{job.salaryMin !== undefined && <p>Published USD range: ${job.salaryMin.toLocaleString()}{job.salaryMax ? `–$${job.salaryMax.toLocaleString()}` : "+"}</p>}</div><button className="button button-outline" onClick={onEdit}>Edit details</button></div>
    <div className="detail-layout">
      <div className="detail-main">
        <div className="panel match-panel"><div className="panel-title"><div><h3>Why this could fit</h3><p>Transparent signals, not a black box.</p></div><div className="score-circle"><strong>{match.score}</strong><small>/ 100</small></div></div>
          <div className="factor-list">{match.factors.map((factor) => <div className="factor-row" key={factor.label}><div className="factor-head"><strong>{factor.label}</strong><span>{factor.score}%</span></div><div className="progress-track"><div style={{ width: `${factor.score}%` }} /></div><p>{factor.detail}</p></div>)}</div>
          <div className="match-footnote">Role 35% · Skills 35% · Location 20% · Salary 10% <span>$140k is a minimum for confirmed matches; undisclosed pay is shown separately.</span></div>
        </div>
        <div className="panel description-panel">        <div className="panel-title"><div><h3>Job description</h3><p>Manually supplied text</p></div>{safeExternalUrl(job.url) && <a className="button button-outline small-button" href={safeExternalUrl(job.url)!} target="_blank" rel="noreferrer">Open job link ↗</a>}</div><div className="description-text">{job.description}</div></div>
        <div className="panel draft-panel"><div className="panel-title"><div><h3>Cover letter draft</h3><p>Generated locally from your profile and the role. Review and edit before using.</p></div>{draft && <button className="button button-outline small-button" onClick={copyDraft}>{copied ? "Copied ✓" : "Copy draft"}</button>}</div>
          {draft ? <textarea aria-label="Editable cover letter draft" className="draft-editor" value={draft} onChange={(event) => onChange({ draft: event.target.value })} /> : <div className="draft-empty"><span>✳</span><p>A thoughtful first draft, built from your profile. Make it yours.</p><button className="button button-dark" onClick={generateDraft}>Generate a draft <span>→</span></button></div>}
          {draft && <div className="draft-actions"><span>✎ Your draft is saved locally as you edit.</span><button className="text-button" onClick={generateDraft}>Regenerate draft ↻</button></div>}
        </div>
      </div>
      <aside className="detail-aside">
        <div className="panel tracking-panel"><div className="eyebrow">YOUR TRACKER</div><h3>Keep it moving.</h3><label>Status<select value={job.status} onChange={(event) => onChange({ status: event.target.value as ApplicationStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>Follow-up date<input type="date" value={job.followUp} onChange={(event) => onChange({ followUp: event.target.value })} /></label><label>Notes<textarea rows={5} value={job.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="A reminder, contact, or next step…" /></label>        {safeExternalUrl(job.url) && <a className="apply-link" href={safeExternalUrl(job.url)!} target="_blank" rel="noreferrer">Review and apply yourself <span>↗</span></a>}<p className="manual-note">Fieldnote never logs in or submits applications for you.</p></div>
        <button className="delete-job" onClick={onDelete}>Remove this opportunity</button>
      </aside>
    </div>
  </div>;
}

export default App;
