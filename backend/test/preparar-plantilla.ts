import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTORIO_TEST = path.dirname(fileURLToPath(import.meta.url));
const DIRECTORIO_BACKEND = path.resolve(DIRECTORIO_TEST, "..");

/** Base migrada una sola vez; cada test la copia para trabajar aislado. */
export const RUTA_PLANTILLA = path.join(DIRECTORIO_TEST, ".plantilla.db");

export default function prepararPlantilla(): void {
  rmSync(RUTA_PLANTILLA, { force: true });
  execSync("npx prisma migrate deploy", {
    cwd: DIRECTORIO_BACKEND,
    env: { ...process.env, DATABASE_URL: `file:${RUTA_PLANTILLA}` },
    stdio: "pipe",
  });
}
