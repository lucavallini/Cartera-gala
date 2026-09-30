import type { Pagina } from "@cartera/contratos";
import type { ClienteBD } from "../base-datos/cliente";
import { ErrorNoEncontrado, ErrorValidacion } from "../errores";
import { construirPagina, type OpcionesListado } from "../paginacion";
import type { DelegadoPrisma, Donde } from "./delegado-prisma";

/**
 * Base de los repositorios de entidades con borrado lógico (columna `eliminadoEn`).
 * Centraliza búsqueda, paginación, orden validado, alta, edición y borrado lógico.
 * Cada operación recibe un `alcance` (condición extra) que las subclases fijan.
 */
export abstract class RepositorioBase<TModelo extends { id: string }, TCrear, TEditar> {
  /** Nombre con artículo para los mensajes: "la cartera". */
  protected abstract readonly entidad: string;
  protected abstract readonly camposOrdenables: readonly string[];
  protected abstract readonly ordenPorDefecto: string;
  /**
   * Nombre llano de cada campo de `camposOrdenables`, para el mensaje de error.
   * Si un campo no está acá, se muestra tal cual (cada repositorio puede completarlo).
   */
  protected readonly nombresOrden: Readonly<Record<string, string>> = {};

  constructor(protected readonly bd: ClienteBD) {}

  protected abstract delegado(bd: ClienteBD): DelegadoPrisma<TModelo, TCrear, TEditar>;

  protected buscarEn(alcance: Donde, id: string, bd: ClienteBD = this.bd): Promise<TModelo | null> {
    return Promise.resolve(
      this.delegado(bd).findFirst({ where: { ...alcance, id, eliminadoEn: null } }),
    );
  }

  protected async obtenerEn(alcance: Donde, id: string, bd: ClienteBD = this.bd): Promise<TModelo> {
    const encontrado = await this.buscarEn(alcance, id, bd);
    if (!encontrado) throw new ErrorNoEncontrado(this.entidad);
    return encontrado;
  }

  protected async listarEn(
    alcance: Donde,
    opciones: OpcionesListado,
    bd: ClienteBD = this.bd,
  ): Promise<Pagina<TModelo>> {
    const orden = opciones.orden ?? this.ordenPorDefecto;
    if (!this.camposOrdenables.includes(orden)) {
      const nombres = this.camposOrdenables.map((campo) => this.nombresOrden[campo] ?? campo);
      throw new ErrorValidacion("No se puede ordenar por ese campo.", [
        { campo: "orden", mensaje: `Valores posibles: ${nombres.join(", ")}.` },
      ]);
    }
    // El alcance va después de los filtros para que un filtro nunca lo pise.
    const where: Donde = { ...opciones.filtros, ...alcance, eliminadoEn: null };
    const delegado = this.delegado(bd);
    const [items, total] = await Promise.all([
      delegado.findMany({
        where,
        // El id desempata: sin él, los valores repetidos no tienen orden estable entre páginas.
        orderBy: [{ [orden]: opciones.direccion }, { id: "asc" }],
        skip: (opciones.pagina - 1) * opciones.porPagina,
        take: opciones.porPagina,
      }),
      delegado.count({ where }),
    ]);
    return construirPagina(items, total, opciones);
  }

  protected crearEn(datos: TCrear, bd: ClienteBD = this.bd): Promise<TModelo> {
    return Promise.resolve(this.delegado(bd).create({ data: datos }));
  }

  protected async editarEn(
    alcance: Donde,
    id: string,
    datos: TEditar,
    bd: ClienteBD = this.bd,
  ): Promise<TModelo> {
    await this.obtenerEn(alcance, id, bd);
    return this.delegado(bd).update({ where: { id }, data: datos });
  }

  protected async borrarEn(alcance: Donde, id: string, bd: ClienteBD = this.bd): Promise<TModelo> {
    await this.obtenerEn(alcance, id, bd);
    return this.delegado(bd).update({ where: { id }, data: { eliminadoEn: new Date() } });
  }
}
