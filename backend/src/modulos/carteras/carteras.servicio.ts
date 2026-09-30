import type {
  CarteraDto,
  CrearCarteraEntrada,
  EditarCarteraEntrada,
  Pagina,
} from "@cartera/contratos";
import type { Cartera, Prisma, PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { ServicioAuditado } from "../../compartido/auditoria/servicio-auditado";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { ErrorConflicto, ErrorValidacion } from "../../compartido/errores";
import type { ServicioCrud } from "../../compartido/http/controlador-crud";
import { mapearPagina } from "../../compartido/paginacion";
import type { ConsultaCarteras } from "./carteras.esquemas";
import type { CarterasRepositorio, EdicionCartera, NuevaCartera } from "./carteras.repositorio";

function aCarteraDto(cartera: Cartera): CarteraDto {
  return {
    id: cartera.id,
    nombre: cartera.nombre,
    descripcion: cartera.descripcion,
    esPrincipal: cartera.esPrincipal,
    archivada: cartera.archivada,
    orden: cartera.orden,
    creadoEn: cartera.creadoEn.toISOString(),
    actualizadoEn: cartera.actualizadoEn.toISOString(),
  };
}

export class CarterasServicio
  extends ServicioAuditado<
    Cartera,
    NuevaCartera,
    Prisma.CarteraUncheckedCreateInput,
    EdicionCartera
  >
  implements ServicioCrud<CarteraDto, CrearCarteraEntrada, EditarCarteraEntrada, ConsultaCarteras>
{
  protected readonly entidadAuditada = "Cartera";

  constructor(
    bd: PrismaClient,
    private readonly carteras: CarterasRepositorio,
    auditoria: AuditoriaRepositorio,
  ) {
    super(bd, carteras, auditoria);
  }

  async listar(usuarioId: string, consulta: ConsultaCarteras): Promise<Pagina<CarteraDto>> {
    const { incluirArchivadas, ...listado } = consulta;
    const filtros = incluirArchivadas ? {} : { archivada: false };
    return mapearPagina(
      await this.carteras.listar(usuarioId, { ...listado, filtros }),
      aCarteraDto,
    );
  }

  idsActivas(usuarioId: string): Promise<string[]> {
    return this.carteras.idsActivas(usuarioId);
  }

  async obtener(usuarioId: string, id: string): Promise<CarteraDto> {
    return aCarteraDto(await this.carteras.obtener(usuarioId, id));
  }

  async crear(usuarioId: string, entrada: CrearCarteraEntrada): Promise<CarteraDto> {
    const creada = await this.crearAuditadoCon(usuarioId, async (tx) => {
      await this.asegurarNombreLibre(tx, usuarioId, entrada.nombre);
      return {
        nombre: entrada.nombre,
        descripcion: entrada.descripcion ?? null,
        orden: await this.carteras.siguienteOrden(usuarioId, tx),
      };
    });
    return aCarteraDto(creada);
  }

  async editar(usuarioId: string, id: string, entrada: EditarCarteraEntrada): Promise<CarteraDto> {
    if (entrada.esPrincipal === false) {
      throw new ErrorValidacion("Para cambiar la cartera principal, marcá otra como principal.", [
        { campo: "esPrincipal", mensaje: "Marcá otra cartera como principal." },
      ]);
    }
    const pasaAPrincipal = entrada.esPrincipal === true;
    const datos: EdicionCartera = {
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      orden: entrada.orden,
      // Una cartera principal nunca queda archivada.
      archivada: pasaAPrincipal ? false : entrada.archivada,
      esPrincipal: entrada.esPrincipal,
    };
    const editada = await this.editarAuditado(usuarioId, id, datos, async (tx, actual) => {
      if (entrada.nombre !== undefined) {
        await this.asegurarNombreLibre(tx, usuarioId, entrada.nombre, id);
      }
      if (entrada.archivada === true && (pasaAPrincipal || actual?.esPrincipal)) {
        throw new ErrorConflicto(
          "No podés archivar tu cartera principal. Marcá otra como principal primero.",
        );
      }
      if (pasaAPrincipal) await this.quitarPrincipalAnterior(tx, usuarioId, id);
    });
    return aCarteraDto(editada);
  }

  async borrar(usuarioId: string, id: string): Promise<void> {
    await this.borrarAuditado(usuarioId, id, async (_tx, actual) => {
      if (actual?.esPrincipal) {
        throw new ErrorConflicto(
          "No podés borrar tu cartera principal. Marcá otra como principal primero.",
        );
      }
    });
  }

  /** Desmarca la principal anterior dejando su propio registro de auditoría. */
  private async quitarPrincipalAnterior(tx: ClienteBD, usuarioId: string, nuevaId: string) {
    for (const anterior of await this.carteras.principalesSalvo(usuarioId, nuevaId, tx)) {
      await this.editarYAuditar(tx, usuarioId, anterior, { esPrincipal: false });
    }
  }

  private async asegurarNombreLibre(
    tx: ClienteBD,
    usuarioId: string,
    nombre: string,
    excluirId?: string,
  ) {
    const existente = await this.carteras.buscarPorNombre(usuarioId, nombre, excluirId, tx);
    if (existente) {
      throw new ErrorConflicto(`Ya tenés una cartera llamada "${existente.nombre}".`);
    }
  }
}
