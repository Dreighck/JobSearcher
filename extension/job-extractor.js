const jobLinkPattern = /job|career|opening|position|requisition|role/i;
const blockedHosts = new Set(["linkedin.com", "indeed.com"]);
const maxPages = 30;
const maxDepth = 2;
const crawlDelayMs = 700;

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

export function normalizeSiteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid website URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Use a public HTTPS URL without embedded credentials.");
  }
  if ([...blockedHosts].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error("LinkedIn and Indeed are not supported. Use an authorized public site.");
  }
  url.hash = "";
  return { origin: url.origin, url: url.href };
}

function toPlainText(value) {
  const document = new DOMParser().parseFromString(String(value ?? ""), "text/html");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function locationText(jobLocation, applicantLocation) {
  const values = [];
  for (const entry of Array.isArray(jobLocation) ? jobLocation : [jobLocation]) {
    if (!isRecord(entry)) continue;
    const address = isRecord(entry.address) ? entry.address : entry;
    for (const field of ["name", "streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]) {
      if (typeof address[field] === "string" && address[field].trim()) values.push(address[field].trim());
    }
  }
  const applicants = Array.isArray(applicantLocation) ? applicantLocation : [applicantLocation];
  for (const entry of applicants) {
    if (typeof entry === "string") values.push(entry);
    else if (isRecord(entry)) {
      const address = isRecord(entry.address) ? entry.address : entry;
      for (const field of ["name", "addressLocality", "addressRegion", "addressCountry"]) {
        if (typeof address[field] === "string" && address[field].trim()) values.push(address[field].trim());
      }
    }
  }
  return [...new Set(values)].join(", ");
}

function salaryRange(baseSalary) {
  if (!isRecord(baseSalary)) return null;
  const currency = typeof baseSalary.currency === "string" ? baseSalary.currency.toUpperCase() : "";
  const value = isRecord(baseSalary.value) ? baseSalary.value : baseSalary;
  const interval = value.unitText ?? baseSalary.unitText;
  if (typeof interval !== "string" || !/year|annual/i.test(interval)) return null;
  const min = Number(value.minValue ?? value.value ?? value.maxValue);
  const max = Number(value.maxValue ?? value.value ?? value.minValue);
  if (!Number.isFinite(min) || min <= 0) return null;
  return {
    salaryMin: min,
    salaryMax: Number.isFinite(max) && max > 0 ? max : null,
    salaryCurrency: currency,
  };
}

function salaryFromText(text) {
  const match = text.match(/(?:salary|compensation|base pay|base salary|pay range|annual pay)[^$]{0,80}\$\s*([\d,]+)(?:\s*(?:-|to|–|—)\s*\$?\s*([\d,]+))?/i);
  if (!match) return null;
  const min = Number(match[1].replace(/,/g, ""));
  const max = match[2] ? Number(match[2].replace(/,/g, "")) : null;
  if (!Number.isFinite(min) || min <= 0) return null;
  return {
    salaryMin: min,
    salaryMax: Number.isFinite(max) && max > 0 ? max : null,
    salaryCurrency: "USD",
  };
}

function jobPostingTypes(value) {
  const types = Array.isArray(value) ? value : [value];
  return types.some((type) => typeof type === "string" && type.split("/").pop()?.toLowerCase() === "jobposting");
}

function mainEntityUrl(value, fallbackUrl) {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value["@id"] === "string") return value["@id"];
  return fallbackUrl;
}

function visitJsonLd(value, pageUrl, results) {
  if (Array.isArray(value)) {
    for (const item of value) visitJsonLd(item, pageUrl, results);
    return;
  }
  if (!isRecord(value)) return;
  if (jobPostingTypes(value["@type"])) {
    const organization = isRecord(value.hiringOrganization) ? value.hiringOrganization : {};
    const url = typeof value.applicationUrl === "string"
      ? value.applicationUrl
      : typeof value.url === "string" ? value.url : mainEntityUrl(value.mainEntityOfPage, pageUrl);
    const range = salaryRange(value.baseSalary);
    results.push({
      title: typeof value.title === "string" ? value.title.trim() : "",
      company: typeof organization.name === "string" ? organization.name.trim() : "",
      location: locationText(value.jobLocation, value.applicantLocationRequirements) ||
        (String(value.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE" ? "Remote" : ""),
      description: toPlainText(value.description),
      url,
      salaryMin: range?.salaryMin ?? null,
      salaryMax: range?.salaryMax ?? null,
      salaryCurrency: range?.salaryCurrency ?? "",
      datePosted: typeof value.datePosted === "string" ? value.datePosted : "",
      employmentType: Array.isArray(value.employmentType)
        ? value.employmentType.join(", ")
        : String(value.employmentType ?? ""),
      sourcePage: pageUrl,
    });
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key !== "@context" && typeof nested === "object" && nested !== null) {
      visitJsonLd(nested, pageUrl, results);
    }
  }
}

export function extractJobPostings(html, pageUrl) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const results = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visitJsonLd(JSON.parse(script.textContent ?? ""), pageUrl, results);
    } catch {
      // Ignore malformed structured-data blocks and continue checking the page.
    }
  }

  if (!results.length) {
    const page = new URL(pageUrl);
    if (jobLinkPattern.test(page.pathname)) {
      const title = document.querySelector("h1")?.textContent?.trim() || document.title.trim();
      const description = document.querySelector("main")?.textContent ??
        document.querySelector("article")?.textContent ??
        document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
      if (title && description.trim()) {
        const plainDescription = description.replace(/\s+/g, " ").trim().slice(0, 20000);
        const salary = salaryFromText(plainDescription);
        results.push({
          title,
          company: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() ?? "",
          location: "",
          description: plainDescription,
          url: pageUrl,
          salaryMin: salary?.salaryMin ?? null,
          salaryMax: salary?.salaryMax ?? null,
          salaryCurrency: salary?.salaryCurrency ?? "",
          datePosted: "",
          employmentType: "",
          sourcePage: pageUrl,
        });
      }
    }
  }

  return results.filter((job) => job.title && job.url);
}

export function candidateLinks(html, pageUrl, allowedOrigin) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const links = new Set();
  for (const anchor of document.querySelectorAll("a[href]")) {
    try {
      const target = new URL(anchor.getAttribute("href"), pageUrl);
      if (target.origin !== allowedOrigin || !/^https?:$/.test(target.protocol)) continue;
      if (!jobLinkPattern.test(`${target.pathname} ${anchor.textContent ?? ""}`)) continue;
      target.hash = "";
      links.add(target.href);
    } catch {
      continue;
    }
  }
  return [...links];
}

export function isAllowedByRobots(robotsText, url) {
  const groups = [];
  let current = null;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim().toLowerCase();
    if (directive === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (current && (directive === "allow" || directive === "disallow") && value) {
      current.rules.push({ directive, value });
    }
  }
  const rules = groups.filter((group) => group.agents.includes("*")).flatMap((group) => group.rules);
  const parsedUrl = new URL(url);
  const path = `${parsedUrl.pathname}${parsedUrl.search}`.toLowerCase();
  const matching = rules.filter((rule) => {
    const source = rule.value.endsWith("$")
      ? `${rule.value.slice(0, -1).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
      : rule.value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${source}`).test(path);
  }).sort((a, b) => {
    const specificityA = a.value.replace(/[*$]/g, "").length;
    const specificityB = b.value.replace(/[*$]/g, "").length;
    if (specificityA !== specificityB) return specificityB - specificityA;
    return a.directive === "allow" ? -1 : 1;
  });
  return !matching.length || matching[0].directive === "allow";
}

function looksLikeChallenge(html) {
  return /captcha|verify you are human|unusual traffic|access denied|robot check/i.test(html.slice(0, 12000));
}

export async function crawlAuthorizedSite(startUrl, allowedOrigin, fetchPage = fetch) {
  const normalized = normalizeSiteUrl(startUrl);
  if (normalized.origin !== allowedOrigin) throw new Error("The start URL must match the approved site origin.");

  const robotsUrl = `${allowedOrigin}/robots.txt`;
  let robotsText = "";
  try {
    const robotsResponse = await fetchPage(robotsUrl, { credentials: "omit", redirect: "error" });
    if (robotsResponse.status !== 404) {
      if (!robotsResponse.ok) throw new Error(`Could not check robots.txt (HTTP ${robotsResponse.status}); no pages were fetched.`);
      robotsText = await robotsResponse.text();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("robots.txt")) throw error;
    throw new Error("Could not check robots.txt; no pages were fetched.");
  }

  const queue = [{ url: normalized.url, depth: 0 }];
  const visited = new Set();
  const postings = new Map();
  const failures = [];
  let skippedByRobots = 0;
  let scannedPages = 0;

  while (queue.length && visited.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;
    visited.add(current.url);
    if (!isAllowedByRobots(robotsText, current.url)) {
      skippedByRobots += 1;
      continue;
    }
    if (visited.size > 1) await new Promise((resolve) => setTimeout(resolve, crawlDelayMs));
    scannedPages += 1;

    try {
      const response = await fetchPage(current.url, {
        credentials: "omit",
        redirect: "error",
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
      if (!response.ok) {
        failures.push(`${current.url}: HTTP ${response.status}`);
        if ([401, 403, 429].includes(response.status) || response.status >= 500) break;
        continue;
      }
      const finalUrl = new URL(response.url || current.url);
      if (finalUrl.origin !== allowedOrigin || !/^https?:$/.test(finalUrl.protocol)) {
        failures.push(`${current.url}: redirected outside the approved origin`);
        continue;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) continue;
      const html = await response.text();
      if (looksLikeChallenge(html)) {
        failures.push(`${current.url}: access challenge detected; crawl stopped`);
        break;
      }

      for (const job of extractJobPostings(html, finalUrl.href)) {
        const key = job.url;
        if (!postings.has(key)) postings.set(key, job);
      }
      if (current.depth < maxDepth) {
        for (const url of candidateLinks(html, finalUrl.href, allowedOrigin)) {
          if (!visited.has(url) && queue.length + visited.size < maxPages) {
            queue.push({ url, depth: current.depth + 1 });
          }
        }
      }
    } catch (error) {
      failures.push(`${current.url}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  return {
    postings: [...postings.values()],
    scannedPages,
    skippedByRobots,
    failures: failures.slice(0, 10),
    pageLimitReached: queue.length > 0 && visited.size >= maxPages,
  };
}
