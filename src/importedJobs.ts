export interface ExtractedJob {
  title: string;
  company: string;
  url: string;
  location: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  datePosted?: string;
  employmentType?: string;
  source?: string;
  sourcePage?: string;
}

export function parseExtractedJobs(value: unknown): { jobs: ExtractedJob[]; rejected: number } {
  if (!Array.isArray(value)) {
    throw new Error("The selected JSON must contain an array of extracted job listings.");
  }
  if (value.length > 1000) {
    throw new Error("Import is limited to 1,000 listings per file.");
  }

  const jobs: ExtractedJob[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const description = typeof record.description === "string" ? record.description.trim() : "";
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      continue;
    }
    if (!title || !description || !["http:", "https:"].includes(parsedUrl.protocol)) continue;

    const salaryMin = typeof record.salaryMin === "number" && Number.isFinite(record.salaryMin) && record.salaryMin > 0
      ? record.salaryMin : undefined;
    const salaryMax = typeof record.salaryMax === "number" && Number.isFinite(record.salaryMax) && record.salaryMax > 0
      ? record.salaryMax : undefined;
    jobs.push({
      title: title.slice(0, 300),
      company: typeof record.company === "string" ? record.company.trim().slice(0, 300) : "",
      url: parsedUrl.href,
      location: typeof record.location === "string" ? record.location.trim().slice(0, 500) : "",
      description: description.slice(0, 20000),
      ...(salaryMin ? { salaryMin } : {}),
      ...(salaryMax ? { salaryMax } : {}),
      ...(typeof record.salaryCurrency === "string" ? { salaryCurrency: record.salaryCurrency.slice(0, 8) } : {}),
      ...(typeof record.datePosted === "string" ? { datePosted: record.datePosted.slice(0, 80) } : {}),
      ...(typeof record.employmentType === "string" ? { employmentType: record.employmentType.slice(0, 120) } : {}),
      ...(typeof record.source === "string" ? { source: record.source.slice(0, 300) } : {}),
      ...(typeof record.sourcePage === "string" ? { sourcePage: record.sourcePage.slice(0, 2000) } : {}),
    });
  }
  return { jobs, rejected: value.length - jobs.length };
}
