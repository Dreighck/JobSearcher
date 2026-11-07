export interface ParsedJobAlert {
  title: string;
  company: string;
  url: string;
}

const genericLine = /\b(linkedin|indeed|job alert|jobs matching|new jobs|view job|apply now|see all jobs|unsubscribe)\b/i;

export function parseJobAlert(text: string): ParsedJobAlert {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const titleIndex = lines.findIndex((line) =>
    line.length <= 120 && !/^https?:\/\//i.test(line) && !genericLine.test(line),
  );
  const title = titleIndex >= 0 ? lines[titleIndex] : "";
  const company = titleIndex >= 0
    ? lines.slice(titleIndex + 1).find((line) =>
      line.length <= 120 && !/^https?:\/\//i.test(line) && !genericLine.test(line),
    ) ?? ""
    : "";
  const url = text.match(/https?:\/\/[^\s<>]+/i)?.[0].replace(/[.,;:!?)\]]+$/, "") ?? "";
  return { title, company, url };
}
