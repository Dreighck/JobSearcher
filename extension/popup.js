import { autofillSupportedFields } from "./autofill.js";
import { crawlAuthorizedSite, normalizeSiteUrl } from "./job-extractor.js";
import { normalizeProfile } from "./profile.js";

const profileElement = document.querySelector("#profile");
const fileInput = document.querySelector("#profile-file");
const fillButton = document.querySelector("#fill");
const clearButton = document.querySelector("#clear");
const statusElement = document.querySelector("#status");
const siteUrlInput = document.querySelector("#site-url");
const authorizationInput = document.querySelector("#authorization");
const authorizeButton = document.querySelector("#authorize");
const approvedSiteSelect = document.querySelector("#approved-site");
const scanButton = document.querySelector("#scan");
const removeSiteButton = document.querySelector("#remove-site");
const resultsElement = document.querySelector("#results");
const exportJobsButton = document.querySelector("#export-jobs");
let profile = null;
let approvedSites = [];
let extractedJobs = [];

function showProfile(value) {
  profile = value;
  if (!value) {
    profileElement.textContent = "Import a profile JSON file from the Fieldnote app.";
    profileElement.classList.add("empty");
    fillButton.disabled = true;
    clearButton.hidden = true;
    return;
  }
  profileElement.textContent = [
    value.name,
    value.email,
    value.phone,
    value.location,
  ].filter(Boolean).join(" · ");
  profileElement.classList.remove("empty");
  fillButton.disabled = false;
  clearButton.hidden = false;
}

function selectedSite() {
  return approvedSites.find((site) => site.origin === approvedSiteSelect.value) ?? null;
}

function renderSites() {
  approvedSiteSelect.replaceChildren();
  if (!approvedSites.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No approved sites yet";
    approvedSiteSelect.append(empty);
  } else {
    for (const site of approvedSites) {
      const option = document.createElement("option");
      option.value = site.origin;
      option.textContent = `${new URL(site.url).hostname} — ${site.url}`;
      approvedSiteSelect.append(option);
    }
  }
  scanButton.disabled = !approvedSites.length;
  removeSiteButton.disabled = !approvedSites.length;
}

function renderResults() {
  resultsElement.replaceChildren();
  exportJobsButton.hidden = !extractedJobs.length;
  if (!extractedJobs.length) return;

  extractedJobs.forEach((job, index) => {
    const row = document.createElement("label");
    row.className = "result-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = job.selected;
    checkbox.addEventListener("change", () => {
      extractedJobs[index].selected = checkbox.checked;
      exportJobsButton.disabled = !extractedJobs.some((item) => item.selected);
    });
    const content = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = job.title || "Untitled posting";
    const details = document.createElement("span");
    details.textContent = [
      job.company,
      job.location,
      job.salaryMin ? `$${job.salaryMin.toLocaleString()}${job.salaryMax ? `–$${job.salaryMax.toLocaleString()}` : "+"} ${job.salaryCurrency}` : "Salary not disclosed",
      job.url,
    ].filter(Boolean).join(" · ");
    content.append(title, details);
    row.append(checkbox, content);
    resultsElement.append(row);
  });
  exportJobsButton.disabled = !extractedJobs.some((item) => item.selected);
}

chrome.storage.local.get(["profile", "approvedSites"]).then(({ profile: saved, approvedSites: sites }) => {
  approvedSites = Array.isArray(sites) ? sites.filter((site) =>
    site && typeof site.origin === "string" && typeof site.url === "string",
  ) : [];
  renderSites();
  if (saved) {
    try {
      showProfile(normalizeProfile(saved));
    } catch (error) {
      statusElement.textContent = error.message;
    }
  }
});

authorizeButton.addEventListener("click", async () => {
  if (!authorizationInput.checked) {
    statusElement.textContent = "Confirm that you own or are authorized to access this site.";
    return;
  }
  try {
    const site = normalizeSiteUrl(siteUrlInput.value);
    const granted = await chrome.permissions.request({ origins: [`${site.origin}/*`] });
    if (!granted) {
      statusElement.textContent = "Site access was not granted; no pages were fetched.";
      return;
    }
    approvedSites = [
      ...approvedSites.filter((item) => item.origin !== site.origin),
      site,
    ];
    await chrome.storage.local.set({ approvedSites });
    renderSites();
    approvedSiteSelect.value = site.origin;
    authorizationInput.checked = false;
    statusElement.textContent = `Approved ${new URL(site.url).hostname}. Start a scan when ready.`;
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : "Could not approve this site.";
  }
});

scanButton.addEventListener("click", async () => {
  const site = selectedSite();
  if (!site) return;
  scanButton.disabled = true;
  extractedJobs = [];
  renderResults();
  statusElement.textContent = "Checking robots.txt and scanning approved same-origin job pages…";
  try {
    const permission = await chrome.permissions.contains({ origins: [`${site.origin}/*`] });
    if (!permission) throw new Error("Permission for this site was removed. Approve it again to scan.");
    const result = await crawlAuthorizedSite(site.url, site.origin);
    extractedJobs = result.postings.map((job) => ({ ...job, source: new URL(site.url).hostname, selected: true }));
    renderResults();
    const limitNote = result.pageLimitReached ? " Page limit reached." : "";
    const failureNote = result.failures.length ? ` ${result.failures.length} page(s) were skipped or failed; see scan details.` : "";
    statusElement.textContent = `Scanned ${result.scannedPages} page(s); found ${extractedJobs.length} posting(s).${limitNote}${failureNote}`;
    if (result.failures.length || result.skippedByRobots > 0) {
      const details = document.createElement("span");
      details.className = "scan-details";
      details.textContent = [
        ...(result.skippedByRobots > 0 ? [`${result.skippedByRobots} page(s) skipped by robots.txt.`] : []),
        ...result.failures,
      ].join(" · ");
      resultsElement.append(details);
    }
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : "The authorized-site scan failed.";
  } finally {
    scanButton.disabled = !approvedSites.length;
  }
});

removeSiteButton.addEventListener("click", async () => {
  const site = selectedSite();
  if (!site) return;
  const granted = await chrome.permissions.remove({ origins: [`${site.origin}/*`] });
  approvedSites = approvedSites.filter((item) => item.origin !== site.origin);
  await chrome.storage.local.set({ approvedSites });
  renderSites();
  statusElement.textContent = granted
    ? `Removed permission for ${new URL(site.url).hostname}.`
    : "The saved site permission entry was removed.";
});

exportJobsButton.addEventListener("click", () => {
  const selected = extractedJobs.filter((job) => job.selected).map(({ selected: _selected, ...job }) => job);
  if (!selected.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "fieldnote-extracted-jobs.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusElement.textContent = `Exported ${selected.length} selected job(s). Import this JSON in Fieldnote.`;
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const imported = normalizeProfile(JSON.parse(await file.text()));
    await chrome.storage.local.set({ profile: imported });
    showProfile(imported);
    statusElement.textContent = "Profile imported into local extension storage.";
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : "Could not import that profile file.";
  } finally {
    fileInput.value = "";
  }
});

fillButton.addEventListener("click", async () => {
  if (!profile) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusElement.textContent = "Could not access the current tab.";
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: autofillSupportedFields,
      args: [profile],
    });
    const result = results[0]?.result;
    statusElement.textContent = result?.filled
      ? `Filled ${result.filled} blank field${result.filled === 1 ? "" : "s"}. Review before submitting.`
      : result?.reason || "No fields were changed.";
  } catch {
    statusElement.textContent = "Could not run here. Open a LinkedIn or Indeed page and try again.";
  }
});

clearButton.addEventListener("click", async () => {
  await chrome.storage.local.remove("profile");
  showProfile(null);
  statusElement.textContent = "Imported profile deleted from extension storage.";
});
