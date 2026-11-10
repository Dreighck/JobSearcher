import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Connect, Plugin } from "vite";
import react from "@vitejs/plugin-react";

const applicationStatuses = new Set(["Saved", "Preparing", "Applied", "Interviewing", "Offer", "Closed"]);
const maxRequestBytes = 10 * 1024 * 1024;

function isLoopbackRequest(request: Connect.IncomingMessage): boolean {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "");
}

function isApplication(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const job = value as Record<string, unknown>;
  return ["id", "title", "company", "url", "description", "notes", "followUp", "draft", "createdAt", "updatedAt"]
    .every((field) => typeof job[field] === "string")
    && typeof job.id === "string"
    && job.id.length > 0
    && applicationStatuses.has(String(job.status))
    && (job.location === undefined || typeof job.location === "string")
    && (job.sourceId === undefined || typeof job.sourceId === "string")
    && (job.source === undefined || typeof job.source === "string")
    && (job.sourceUrl === undefined || typeof job.sourceUrl === "string")
    && (job.salaryMin === undefined || typeof job.salaryMin === "number")
    && (job.salaryMax === undefined || typeof job.salaryMax === "number")
    && (job.salaryCurrency === undefined || typeof job.salaryCurrency === "string");
}

async function readRequestBody(request: Connect.IncomingMessage): Promise<string> {
  let body = "";
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxRequestBytes) throw new Error("Request body exceeds the 10 MB limit.");
    body += chunk;
  }
  return body;
}

function applicationsMiddleware(root: string): Connect.NextHandleFunction {
  const folder = resolve(root, "applications");
  const file = resolve(folder, "applications.json");

  return (request, response, next) => {
    if (new URL(request.url ?? "/", "http://localhost").pathname !== "/api/applications") {
      next();
      return;
    }
    if (!isLoopbackRequest(request)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Applications storage is available only to local clients.");
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        try {
          const contents = await readFile(file, "utf8");
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          response.end(contents);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          response.end("[]");
        }
        return;
      }

      if (request.method === "PUT") {
        let applications: unknown;
        try {
          applications = JSON.parse(await readRequestBody(request));
        } catch (error) {
          response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          response.end(error instanceof SyntaxError ? "Request body must be valid JSON." : (error as Error).message);
          return;
        }
        if (!Array.isArray(applications) || !applications.every(isApplication)) {
          response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          response.end("Request body must be an array of valid applications.");
          return;
        }

        await mkdir(folder, { recursive: true });
        const temporaryFile = resolve(folder, `.applications-${randomUUID()}.tmp`);
        await writeFile(temporaryFile, `${JSON.stringify(applications, null, 2)}\n`, "utf8");
        await rename(temporaryFile, file);
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "DELETE") {
        try {
          await unlink(file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        response.writeHead(204);
        response.end();
        return;
      }

      response.writeHead(405, { Allow: "GET, PUT, DELETE", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed.");
    })().catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Could not access project applications.");
    });
  };
}

function projectApplicationsPlugin(): Plugin {
  return {
    name: "project-applications-storage",
    configureServer(server) {
      server.middlewares.use(applicationsMiddleware(server.config.root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(applicationsMiddleware(server.config.root));
    },
  };
}

export default defineConfig({
  plugins: [react(), projectApplicationsPlugin()],
  server: {
    host: true,
    allowedHosts: true,
    strictPort: false,
  },
});
