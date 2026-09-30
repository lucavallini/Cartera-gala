import type {
  CrearCuentaEntrada,
  CuentaDto,
  EditarCuentaEntrada,
  Pagina,
} from "@cartera/contratos";
import type { Cuenta, Prisma, PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { ServicioAuditado } from "../../compartido/auditoria/servicio-auditado";
import type { ServicioCrud } from "../../compartido/http/controlador-crud";
import { mapearPagina } from "../../compartido/paginacion";
import type { ConsultaCuentas } from "./cuentas.esquemas";
import type { CuentasRepositorio, EdicionCuenta, NuevaCuenta } from "./cuentas.repositorio";

function aCuentaDto(cuenta: Cuenta): CuentaDto {
  return {
    id: cuenta.id,
    broker: cuenta.broker,
    numeroComitente: cuenta.numeroComitente,
    alias: cuenta.alias,
    creadoEn: cuenta.creadoEn.toISOString(),
    actualizadoEn: cuenta.actualizadoEn.toISOString(),
  };
}

export class CuentasServicio
  extends ServicioAuditado<Cuenta, NuevaCuenta, Prisma.CuentaUncheckedCreateInput, EdicionCuenta>
  implements ServicioCrud<CuentaDto, CrearCuentaEntrada, EditarCuentaEntrada, ConsultaCuentas>
{
  protected readonly entidadAuditada = "Cuenta";

  constructor(
    bd: PrismaClient,
    private readonly cuentas: CuentasRepositorio,
    auditoria: AuditoriaRepositorio,
  ) {
    super(bd, cuentas, auditoria);
  }

  async listar(usuarioId: string, consulta: ConsultaCuentas): Promise<Pagina<CuentaDto>> {
    return mapearPagina(await this.cuentas.listar(usuarioId, consulta), aCuentaDto);
  }

  async obtener(usuarioId: string, id: string): Promise<CuentaDto> {
    return aCuentaDto(await this.cuentas.obtener(usuarioId, id));
  }

  async crear(usuarioId: string, entrada: CrearCuentaEntrada): Promise<CuentaDto> {
    const creada = await this.crearAuditado(usuarioId, {
      broker: entrada.broker,
      numeroComitente: entrada.numeroComitente ?? null,
      alias: entrada.alias ?? null,
    });
    return aCuentaDto(creada);
  }

  async editar(usuarioId: string, id: string, entrada: EditarCuentaEntrada): Promise<CuentaDto> {
    return aCuentaDto(await this.editarAuditado(usuarioId, id, entrada));
  }

  async borrar(usuarioId: string, id: string): Promise<void> {
    await this.borrarAuditado(usuarioId, id);
  }
}
