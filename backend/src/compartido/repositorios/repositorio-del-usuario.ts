import type { Pagina } from "@cartera/contratos";
import type { ClienteBD } from "../base-datos/cliente";
import type { OpcionesListado } from "../paginacion";
import type { Donde } from "./delegado-prisma";
import { RepositorioBase } from "./repositorio-base";

/**
 * Repositorio de datos que pertenecen a un usuario. Todas sus operaciones públicas exigen
 * el `usuarioId` y filtran por él: no hay forma de leer o tocar datos ajenos por olvido.
 */
export abstract class RepositorioDelUsuario<
  TModelo extends { id: string },
  TNuevo,
  TCrear,
  TEditar,
> extends RepositorioBase<TModelo, TCrear, TEditar> {
  /** Condición que limita a los registros del usuario. Por defecto, la columna `usuarioId`. */
  protected alcance(usuarioId: string): Donde {
    return { usuarioId };
  }

  /** Completa los datos de un registro nuevo con su dueño. */
  protected abstract conDueno(usuarioId: string, datos: TNuevo): TCrear;

  buscar(usuarioId: string, id: string, bd?: ClienteBD): Promise<TModelo | null> {
    return this.buscarEn(this.alcance(usuarioId), id, bd);
  }

  obtener(usuarioId: string, id: string, bd?: ClienteBD): Promise<TModelo> {
    return this.obtenerEn(this.alcance(usuarioId), id, bd);
  }

  listar(usuarioId: string, opciones: OpcionesListado, bd?: ClienteBD): Promise<Pagina<TModelo>> {
    return this.listarEn(this.alcance(usuarioId), opciones, bd);
  }

  crear(usuarioId: string, datos: TNuevo, bd?: ClienteBD): Promise<TModelo> {
    return this.crearEn(this.conDueno(usuarioId, datos), bd);
  }

  editar(usuarioId: string, id: string, datos: TEditar, bd?: ClienteBD): Promise<TModelo> {
    return this.editarEn(this.alcance(usuarioId), id, datos, bd);
  }

  borrar(usuarioId: string, id: string, bd?: ClienteBD): Promise<TModelo> {
    return this.borrarEn(this.alcance(usuarioId), id, bd);
  }
}
