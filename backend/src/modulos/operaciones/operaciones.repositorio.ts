import type { Operacion, Prisma } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import type { Donde } from "../../compartido/repositorios/delegado-prisma";
import { RepositorioDelUsuario } from "../../compartido/repositorios/repositorio-del-usuario";
import type { OperacionConInstrumento } from "./a-motor";

export type NuevaOperacion = Prisma.OperacionUncheckedCreateInput;
export type EdicionOperacion = Pick<
  Prisma.OperacionUncheckedUpdateInput,
  | "tipo"
  | "cuentaId"
  | "instrumentoId"
  | "fechaConcertacion"
  | "cantidad"
  | "precio"
  | "moneda"
  | "tipoCambio"
  | "comision"
  | "derechosMercado"
  | "iva"
  | "otrosGastos"
  | "montoNeto"
  | "notas"
>;

export class OperacionesRepositorio extends RepositorioDelUsuario<
  Operacion,
  NuevaOperacion,
  NuevaOperacion,
  EdicionOperacion
> {
  protected readonly entidad = "la operación";
  protected readonly camposOrdenables = ["fechaConcertacion", "creadoEn", "tipo"] as const;
  protected readonly ordenPorDefecto = "fechaConcertacion";
  protected override readonly nombresOrden = {
    fechaConcertacion: "fecha",
    creadoEn: "fecha de carga",
    tipo: "tipo",
  };

  protected delegado(bd: ClienteBD) {
    return bd.operacion;
  }

  /** Una operación es del usuario si su cartera (no borrada) es suya. */
  protected override alcance(usuarioId: string): Donde {
    return { cartera: { usuarioId, eliminadoEn: null } };
  }

  /** El servicio valida la cartera antes de crear. */
  protected conDueno(_usuarioId: string, datos: NuevaOperacion): NuevaOperacion {
    return datos;
  }

  /**
   * Toda la historia de esas carteras, con el instrumento, para el motor.
   * Defensa en profundidad: filtra también por dueño de la cartera, aunque el llamador ya
   * debería haber validado que esas carteras son de `usuarioId`.
   */
  deCarteras(
    carteraIds: readonly string[],
    usuarioId: string,
    bd: ClienteBD = this.bd,
    instrumentoId?: string,
  ): Promise<OperacionConInstrumento[]> {
    return bd.operacion.findMany({
      where: {
        carteraId: { in: [...carteraIds] },
        cartera: { usuarioId, eliminadoEn: null },
        eliminadoEn: null,
        ...(instrumentoId ? { instrumentoId } : {}),
      },
      include: { instrumento: true },
      orderBy: [{ fechaConcertacion: "asc" }, { creadoEn: "asc" }],
    });
  }
}
