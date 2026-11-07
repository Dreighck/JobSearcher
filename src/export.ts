import type { Job } from "./types";

const columns: (keyof Job)[] = [
  "title", "company", "url", "source", "location", "salaryMin", "salaryMax", "salaryCurrency", "status", "notes", "followUp", "createdAt", "updatedAt",
];

function quote(value: unknown): string {
  const text = String(value ?? "");
  const protectedText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

export function exportJobs(jobs: Job[]): void {
  const csv = [
    columns.join(","),
    ...jobs.map((job) => columns.map((column) => quote(job[column])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fieldnote-applications.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
