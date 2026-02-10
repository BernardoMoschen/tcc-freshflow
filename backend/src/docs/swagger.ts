import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createSwaggerMiddleware() {
  const specPath = join(__dirname, "openapi.yaml");
  const spec = load(readFileSync(specPath, "utf8")) as Record<string, unknown>;

  return {
    serve: swaggerUi.serve,
    setup: swaggerUi.setup(spec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "FreshFlow API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
        docExpansion: "list",
      },
    }),
  };
}
