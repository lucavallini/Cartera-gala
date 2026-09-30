import { Prisma, type RegistroAuditoria } from "../../generado/prisma/client";
import type { AccionAuditoria } from "../../generado/prisma/enums";
import type { ClienteBD } from "../base-datos/cliente";
import { aJson } from "../json";

export interface EntradaAuditoria {
  usuarioId: string;
  entidad: string;
  entidadId: string;
  accion: AccionAuditoria;
  antes: unknown;
  despues: unknown;
}

function columnaJson(valor: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return valor === null || valor === undefined ? Prisma.JsonNull : aJson(valor);
}

/** Tabla técnica de solo agregar: no usa RepositorioBase porque no tiene borrado lógico. */
export class AuditoriaRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  async registrar(entrada: EntradaAuditoria, bd: ClienteBD = this.bd): Promise<void> {
    await bd.registroAuditoria.create({
      data: {
        usuarioId: entrada.usuarioId,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        accion: entrada.accion,
        antes: columnaJson(entrada.antes),
        despues: columnaJson(entrada.despues),
      },
    });
  }

  listarDeEntidad(
    entidad: string,
    entidadId: string,
    bd: ClienteBD = this.bd,
  ): Promise<RegistroAuditoria[]> {
    return bd.registroAuditoria.findMany({
      where: { entidad, entidadId },
      orderBy: { fecha: "asc" },
    });
  }
}
