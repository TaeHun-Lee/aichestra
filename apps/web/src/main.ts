import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { renderDashboardHtml } from "./render.ts";
import { createStagingSignoffRouteHandler } from "./staging-signoffs.ts";

const staticContentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function staticAssetUrl(pathname: string): URL | undefined {
  if (!pathname.startsWith("/assets/") || pathname.includes("..")) return undefined;
  return new URL(`../dist${pathname}`, import.meta.url);
}

function staticContentType(pathname: string): string {
  const match = /\.[^.]+$/.exec(pathname);
  return match ? staticContentTypes[match[0]] ?? "application/octet-stream" : "application/octet-stream";
}

async function trySendStaticAsset(pathname: string, response: ServerResponse): Promise<boolean> {
  const assetUrl = staticAssetUrl(pathname);
  if (!assetUrl) return false;
  try {
    const body = await readFile(assetUrl);
    response.writeHead(200, { "content-type": staticContentType(pathname) });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

async function trySendReactDashboard(response: ServerResponse): Promise<boolean> {
  try {
    const body = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

export function createWebServer() {
  const handleStagingSignoffRoute = createStagingSignoffRouteHandler();
  return createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (await handleStagingSignoffRoute(request, response, url)) {
          return;
        }
        if (url.pathname === "/health") {
          response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ service: "aichestra-web", status: "ok" }));
          return;
        }
        if (await trySendStaticAsset(url.pathname, response)) {
          return;
        }
        if (url.pathname === "/" || url.pathname === "/tasks" || url.pathname === "/registries") {
          if (await trySendReactDashboard(response)) {
            return;
          }
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end(await renderDashboardHtml());
          return;
        }

        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        if (!response.headersSent) {
          response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        }
        response.end("Dashboard render failed. Check web-dev.err.log for details.");
      }
    })();
  });
}

function isMain(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMain()) {
  const host = process.env.AICHESTRA_WEB_HOST ?? "127.0.0.1";
  const port = Number(process.env.AICHESTRA_WEB_PORT ?? "3001");
  createWebServer().listen(port, host, () => {
    console.log(`aichestra-web listening on http://${host}:${port}`);
  });
}
