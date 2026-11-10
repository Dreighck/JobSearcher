import type { Job } from "./types";

const endpoint = "/api/applications";
const statuses = new Set(["Saved", "Preparing", "Applied", "Interviewing", "Offer", "Closed"]);

function isJob(value: unknown): value is Job {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const job = value as Record<string, unknown>;
  return ["id", "title", "company", "url", "description", "notes", "followUp", "draft", "createdAt", "updatedAt"]
    .every((field) => typeof job[field] === "string")
    && statuses.has(String(job.status))
    && (job.location === undefined || typeof job.location === "string")
    && (job.sourceId === undefined || typeof job.sourceId === "string")
    && (job.source === undefined || typeof job.source === "string")
    && (job.sourceUrl === undefined || typeof job.sourceUrl === "string")
    && (job.salaryMin === undefined || typeof job.salaryMin === "number")
    && (job.salaryMax === undefined || typeof job.salaryMax === "number")
    && (job.salaryCurrency === undefined || typeof job.salaryCurrency === "string");
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const detail = await response.text();
  throw new Error(detail || `Project applications request failed (${response.status}).`);
}

export async function loadProjectApplications(): Promise<Job[]> {
  const response = await fetch(endpoint);
  await checkResponse(response);
  const jobs: unknown = await response.json();
  if (!Array.isArray(jobs) || !jobs.every(isJob)) {
    throw new Error("The project applications file has an invalid format.");
  }
  return jobs;
}

export async function saveProjectApplications(jobs: Job[]): Promise<void> {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jobs),
  });
  await checkResponse(response);
}

export async function clearProjectApplications(): Promise<void> {
  const response = await fetch(endpoint, { method: "DELETE" });
  await checkResponse(response);
}

export function mergeApplicationJobs(projectJobs: Job[], browserJobs: Job[]): Job[] {
  const merged = new Map(projectJobs.map((job) => [job.id, job]));
  for (const browserJob of browserJobs) {
    const projectJob = merged.get(browserJob.id);
    if (!projectJob || browserJob.updatedAt >= projectJob.updatedAt) {
      merged.set(browserJob.id, browserJob);
    }
  }
  return [...merged.values()];
}
