import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";

// Load env from repo root so worker CLIs share the app's configuration.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(process.cwd(), ".env") });
config({ path: join(here, "../../../.env") });
