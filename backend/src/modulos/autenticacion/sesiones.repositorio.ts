import type { Sesion } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";

export interface NuevaSesion {
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  userAgent: string | null;
  ip: string | null;
}

/** Tabla técnica: no usa RepositorioBase porque las sesiones se revocan, no se borran. */
export class SesionesRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  crear(datos: NuevaSesion, bd: ClienteBD = this.bd): Promise<Sesion> {
    return bd.sesion.create({ data: datos });
  }

  buscarPorHash(tokenHash: string, bd: ClienteBD = this.bd): Promise<Sesion | null> {
    return bd.sesion.findUnique({ where: { tokenHash } });
  }

  /**
   * Marca la sesión como reemplazada solo si seguía viva. Devuelve false si otro pedido
   * la rotó antes: así dos refrescos simultáneos no pueden dejar dos sesiones vivas.
   */
  async marcarReemplazada(
    id: string,
    reemplazadaPorId: string,
    ahora: Date,
    bd: ClienteBD = this.bd,
  ): Promise<boolean> {
    const { count } = await bd.sesion.updateMany({
      where: { id, revocadaEn: null },
      data: { revocadaEn: ahora, reemplazadaPorId },
    });
    return count === 1;
  }

  async revocar(id: string, ahora: Date, bd: ClienteBD = this.bd): Promise<void> {
    await bd.sesion.updateMany({ where: { id, revocadaEn: null }, data: { revocadaEn: ahora } });
  }

  /** Revoca la sesión y todas las que la fueron reemplazando. */
  async revocarCadenaDesde(id: string, ahora: Date, bd: ClienteBD = this.bd): Promise<void> {
    const visitadas = new Set<string>();
    let actual: string | null = id;
    while (actual && !visitadas.has(actual)) {
      visitadas.add(actual);
      const sesion: Sesion | null = await bd.sesion.findUnique({ where: { id: actual } });
      if (!sesion) return;
      await this.revocar(sesion.id, ahora, bd);
      actual = sesion.reemplazadaPorId;
    }
  }

  async revocarOtrasDelUsuario(
    usuarioId: string,
    exceptoId: string | null,
    ahora: Date,
    bd: ClienteBD = this.bd,
  ): Promise<void> {
    await bd.sesion.updateMany({
      where: { usuarioId, revocadaEn: null, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
      data: { revocadaEn: ahora },
    });
  }
}
