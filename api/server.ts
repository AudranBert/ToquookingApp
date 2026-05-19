import http from "node:http";
import { URL } from "node:url";
import { importRecipeFromSourceUrl } from "./recipeImportCore";
import { fetchProxiedImage } from "./imageProxyCore";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (requestUrl.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/api/import") {
      const sourceUrl = requestUrl.searchParams.get("url") ?? "";
      const result = await importRecipeFromSourceUrl(sourceUrl);
      sendJson(response, sourceUrl ? 200 : 400, result);
      return;
    }

    if (requestUrl.pathname === "/api/image") {
      const imageUrl = requestUrl.searchParams.get("url") ?? "";
      const result = await fetchProxiedImage(imageUrl);

      response.statusCode = result.status;
      response.setHeader("content-type", result.contentType);
      response.setHeader("cache-control", "public, max-age=86400");

      if (!result.body) {
        response.end();
        return;
      }

      const reader = result.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response.write(Buffer.from(value));
      }
      response.end();
      return;
    }

    sendJson(response, 404, { error: "Not Found" });
  } catch (error) {
    console.error("API server error", error);
    sendJson(response, 500, { error: "Internal Server Error" });
  }
});

server.listen(port, host, () => {
  console.log(`Toquooking API listening on http://${host}:${port}`);
});
