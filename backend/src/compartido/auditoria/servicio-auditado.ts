import type { PrismaClient } from "../../generado/prisma/client";
import type { ClienteBD } from "../base-datos/cliente";
import type { RepositorioDelUsuario } from "../repositorios/repositorio-del-usuario";
import type { AuditoriaRepositorio } from "./auditoria.repositorio";

/**
 * Trabajo extra que corre dentro de la misma transacción, antes del cambio principal:
 * validaciones que tienen que leer datos actuales y cambios en otros registros.
 * Recibe el registro tal como estaba (null al crear).
 */
export type PasoPrevio<TModelo = unknown> = (
  tx: ClienteBD,
  actual: TModelo | null,
) => Promise<void>;

/**
 * Base de los servicios de entidades editables por el usuario. Cada alta, edición o borrado
 * se hace en una transacción junto con su registro en RegistroAuditoria.
 */
export abstract class ServicioAuditado<TModelo extends { id: string }, TNuevo, TCrear, TEditar> {
  /** Nombre de la entidad en la auditoría: "Cartera", "Cuenta", … */
  protected abstract readonly entidadAuditada: string;

  constructor(
    protected readonly bd: PrismaClient,
    protected readonly repositorio: RepositorioDelUsuario<TModelo, TNuevo, TCrear, TEditar>,
    protected readonly auditoria: AuditoriaRepositorio,
  ) {}

  protected crearAuditado(
    usuarioId: string,
    datos: TNuevo,
    pasoPrevio?: PasoPrevio<TModelo>,
  ): Promise<TModelo> {
    return this.crearAuditadoCon(usuarioId, async (tx) => {
      await pasoPrevio?.(tx, null);
      return datos;
    });
  }

  /** Como crearAuditado, pero los datos se arman dentro de la transacción (validan y leen ahí). */
  protected crearAuditadoCon(
    usuarioId: string,
    preparar: (tx: ClienteBD) => Promise<TNuevo>,
  ): Promise<TModelo> {
    return this.bd.$transaction(async (tx) => {
      const creado = await this.repositorio.crear(usuarioId, await preparar(tx), tx);
      await this.auditoria.registrar(
        {
          usuarioId,
          entidad: this.entidadAuditada,
          entidadId: creado.id,
          accion: "CREAR",
          antes: null,
          despues: creado,
        },
        tx,
      );
      return creado;
    });
  }

  protected editarAuditado(
    usuarioId: string,
    id: string,
    datos: TEditar,
    pasoPrevio?: PasoPrevio<TModelo>,
  ): Promise<TModelo> {
    return this.bd.$transaction(async (tx) => {
      const antes = await this.repositorio.obtener(usuarioId, id, tx);
      await pasoPrevio?.(tx, antes);
      return this.editarYAuditar(tx, usuarioId, antes, datos);
    });
  }

  /** Edita un registro ya leído y deja su auditoría, dentro de una transacción en curso. */
  protected async editarYAuditar(
    tx: ClienteBD,
    usuarioId: string,
    antes: TModelo,
    datos: TEditar,
  ): Promise<TModelo> {
    const despues = await this.repositorio.editar(usuarioId, antes.id, datos, tx);
    await this.auditoria.registrar(
      {
        usuarioId,
        entidad: this.entidadAuditada,
        entidadId: antes.id,
        accion: "EDITAR",
        antes,
        despues,
      },
      tx,
    );
    return despues;
  }

  protected borrarAuditado(
    usuarioId: string,
    id: string,
    pasoPrevio?: PasoPrevio<TModelo>,
  ): Promise<void> {
    return this.bd.$transaction(async (tx) => {
      const antes = await this.repositorio.obtener(usuarioId, id, tx);
      await pasoPrevio?.(tx, antes);
      await this.repositorio.borrar(usuarioId, id, tx);
      await this.auditoria.registrar(
        {
          usuarioId,
          entidad: this.entidadAuditada,
          entidadId: id,
          accion: "BORRAR",
          antes,
          despues: null,
        },
        tx,
      );
    });
  }
}
