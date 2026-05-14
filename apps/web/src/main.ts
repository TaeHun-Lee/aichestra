import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { renderDashboardHtml } from "./render.ts";
import { createStagingSignoffRouteHandler } from "./staging-signoffs.ts";

export function createWebServer() {
  const handleStagingSignoffRoute = createStagingSignoffRouteHandler();
  return createServer((request, response) => {
    void (async () => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (await handleStagingSignoffRoute(request, response, url)) {
      return;
    }
    if (url.pathname === "/" || url.pathname === "/tasks" || url.pathname === "/registries") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(await renderDashboardHtml());
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    })();
  });
}

function isMain(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

if (isMain()) {
  const port = Number(process.env.AICHESTRA_WEB_PORT ?? "3001");
  createWebServer().listen(port, "127.0.0.1", () => {
    console.log(`aichestra-web listening on http://127.0.0.1:${port}`);
  });
}
