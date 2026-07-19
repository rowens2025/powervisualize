import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Scalar-rendered API reference for the MLB sports semantic layer. Served as HTML
 * from the API (so the SPA router doesn't intercept it) and points Scalar at the
 * generated OpenAPI spec at /api/sports/openapi.
 */
const HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MLB Sports Semantic Layer — API Reference</title>
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <script id="api-reference" data-url="/api/sports/openapi"></script>
    <script>
      var configuration = { theme: 'purple', darkMode: true, hideDownloadButton: false };
      document.getElementById('api-reference').dataset.configuration = JSON.stringify(configuration);
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(HTML);
}
