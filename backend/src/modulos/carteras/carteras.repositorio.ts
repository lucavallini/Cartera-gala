import type { Cartera, Prisma } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { RepositorioDelUsuario } from "../../compartido/repositorios/repositorio-del-usuario";

export type NuevaCartera = Omit<Prisma.CarteraUncheckedCreateInput, "usuarioId">;
export type EdicionCartera = Pick<
  Prisma.CarteraUncheckedUpdateInput,
  "nombre" | "descripcion" | "esPrincipal" | "archivada" | "orden"
>;

/** "  Principal " y "principal" son el mismo nombre para el usuario. */
function claveDeNombre(nombre: string): string {
  return nombre.trim().toLocaleLowerCase("es");
}

export class CarterasRepositorio extends RepositorioDelUsuario<
  Cartera,
  NuevaCartera,
  Prisma.CarteraUncheckedCreateInput,
  EdicionCartera
> {
  protected readonly entidad = "la cartera";
  protected readonly camposOrdenables = ["orden", "nombre", "creadoEn"] as const;
  protected readonly ordenPorDefecto = "orden";
  protected override readonly nombresOrden = {
    orden: "orden",
    nombre: "nombre",
    creadoEn: "fecha de carga",
  };

  protected delegado(bd: ClienteBD) {
    return bd.cartera;
  }

  protected conDueno(usuarioId: string, datos: NuevaCartera) {
    return { ...datos, usuarioId };
  }

  /** Cartera del usuario con ese nombre, sin distinguir mayúsculas ni espacios. */
  async buscarPorNombre(
    usuarioId: string,
    nombre: string,
    excluirId?: string,
    bd: ClienteBD = this.bd,
  ): Promise<Cartera | null> {
    const carteras = await bd.cartera.findMany({
      where: { usuarioId, eliminadoEn: null, ...(excluirId ? { id: { not: excluirId } } : {}) },
    });
    const buscada = claveDeNombre(nombre);
    return carteras.find((cartera) => claveDeNombre(cartera.nombre) === buscada) ?? null;
  }

  principalesSalvo(usuarioId: string, id: string, bd: ClienteBD = this.bd): Promise<Cartera[]> {
    return bd.cartera.findMany({
      where: { usuarioId, esPrincipal: true, eliminadoEn: null, id: { not: id } },
    });
  }

  /** Carteras que cuentan para el resumen consolidado: ni borradas ni archivadas. */
  async idsActivas(usuarioId: string, bd: ClienteBD = this.bd): Promise<string[]> {
    const carteras = await bd.cartera.findMany({
      where: { usuarioId, eliminadoEn: null, archivada: false },
      select: { id: true },
    });
    return carteras.map((cartera) => cartera.id);
  }

  /** Posición para una cartera nueva: al final de las del usuario. */
  async siguienteOrden(usuarioId: string, bd: ClienteBD = this.bd): Promise<number> {
    const { _max } = await bd.cartera.aggregate({
      where: { usuarioId, eliminadoEn: null },
      _max: { orden: true },
    });
    return _max.orden === null ? 0 : _max.orden + 1;
  }
}
