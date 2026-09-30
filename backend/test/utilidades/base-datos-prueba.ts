import { randomUUID } from "node:crypto";
import { copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "../../src/generado/prisma/client";
import { crearClienteBD } from "../../src/compartido/base-datos/cliente";
import { RUTA_PLANTILLA } from "../preparar-plantilla";

export interface BasePrueba {
  bd: PrismaClient;
  cerrar: () => Promise<void>;
}

export async function crearBasePrueba(): Promise<BasePrueba> {
  const ruta = path.join(tmpdir(), `cartera-prueba-${randomUUID()}.db`);
  copyFileSync(RUTA_PLANTILLA, ruta);
  const bd = crearClienteBD(`file:${ruta}`);
  return {
    bd,
    cerrar: async () => {
      await bd.$disconnect();
      rmSync(ruta, { force: true });
    },
  };
}
