import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
      },
    },
  ],
});
