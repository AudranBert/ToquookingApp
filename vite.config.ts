import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fetchProxiedImage } from "./api/imageProxyCore";
import { importRecipeFromSourceUrl } from "./api/recipeImportCore";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "toque-local-import-api",
      configureServer(server) {
        server.middlewares.use("/api/import", async (request, response) => {
          const requestUrl = new URL(request.url ?? "", "http://localhost");
          const sourceUrl = requestUrl.searchParams.get("url") ?? "";
          const result = await importRecipeFromSourceUrl(sourceUrl);

          response.statusCode = sourceUrl ? 200 : 400;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify(result));
        });
        server.middlewares.use("/api/image", async (request, response) => {
          const requestUrl = new URL(request.url ?? "", "http://localhost");
          const imageUrl = requestUrl.searchParams.get("url") ?? "";
          const result = await fetchProxiedImage(imageUrl);

          response.statusCode = result.status;
          response.setHeader("content-type", result.contentType);
          response.setHeader("cache-control", "public, max-age=86400");

          if (result.body) {
            const reader = result.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              response.write(Buffer.from(value));
            }
            response.end();
            return;
          }

          response.end();
        });
      },
    },
  ],
});
