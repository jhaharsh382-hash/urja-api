import express from "express";
import { readFileSync } from "node:fs";
import { routes } from "./routes.js";
import { ApiError, PortalError } from "./errors.js";

export function createApp({ store }) {
  const app = express();
  app.disable("x-powered-by");
  const spec = readFileSync(new URL("../openapi.json", import.meta.url), "utf8");
  app.get("/openapi.json", (_req, res) => res.type("json").send(spec));
  app.get("/docs", (_req, res) => res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Urja Meter API</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #10131a; color: #e8edf7; }
    body { margin: 0; }
    header { padding: 24px max(24px, calc((100% - 1100px) / 2)); border-bottom: 1px solid #303645; }
    header h1 { margin: 0 0 6px; }
    header p { margin: 0; color: #aeb8ca; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .endpoint { border: 1px solid #303645; border-radius: 8px; margin: 12px 0; overflow: hidden; }
    .endpoint summary { cursor: pointer; padding: 14px; background: #191e29; font-weight: 650; }
    .method { display: inline-block; min-width: 52px; color: #70d6ff; }
    .description { padding: 14px; line-height: 1.55; }
    .tag { color: #aeb8ca; font-size: 13px; }
    .error { color: #ff9d9d; }
  </style>
</head>
<body>
  <header>
    <h1>Urja Meter API</h1>
    <p id="description">Loading API documentation...</p>
  </header>
  <main id="endpoints"></main>
  <script>
    fetch('/openapi.json')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load /openapi.json');
        return response.json();
      })
      .then(spec => {
        document.getElementById('description').textContent = spec.info.description || spec.info.title;
        const main = document.getElementById('endpoints');
        main.replaceChildren();

        for (const [path, methods] of Object.entries(spec.paths || {})) {
          for (const [method, operation] of Object.entries(methods)) {
            if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
            const details = document.createElement('details');
            details.className = 'endpoint';
            const summary = document.createElement('summary');
            const methodName = document.createElement('span');
            methodName.className = 'method';
            methodName.textContent = method.toUpperCase();
            summary.append(methodName, document.createTextNode(' ' + path));
            details.append(summary);

            const body = document.createElement('div');
            body.className = 'description';
            const title = document.createElement('strong');
            title.textContent = operation.summary || path;
            body.append(title);
            if (operation.description) {
              const paragraph = document.createElement('p');
              paragraph.textContent = operation.description;
              body.append(paragraph);
            }
            if (operation.tags?.length) {
              const tag = document.createElement('div');
              tag.className = 'tag';
              tag.textContent = operation.tags.join(', ');
              body.append(tag);
            }
            details.append(body);
            main.append(details);
          }
        }
      })
      .catch(error => {
        document.getElementById('description').textContent = error.message;
        document.getElementById('description').className = 'error';
      });
  </script>
</body>
</html>`));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(routes(store));
  app.use((_req, _res, next) => next(new ApiError("Route not found", { status: 404, code: "not_found" })));
  // one place that maps errors to HTTP responses
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError || err instanceof PortalError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error(err);
    res.status(500).json({ error: { code: "internal_error", message: "Unexpected error" } });
  });
  return app;
}
