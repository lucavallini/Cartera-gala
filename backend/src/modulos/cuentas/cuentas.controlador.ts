import type { CrearCuentaEntrada, CuentaDto, EditarCuentaEntrada } from "@cartera/contratos";
import { ControladorCrud } from "../../compartido/http/controlador-crud";
import {
  esquemaConsultaCuentas,
  esquemaCrearCuenta,
  esquemaEditarCuenta,
  type ConsultaCuentas,
} from "./cuentas.esquemas";
import type { CuentasServicio } from "./cuentas.servicio";

export class CuentasControlador extends ControladorCrud<
  CuentaDto,
  CrearCuentaEntrada,
  EditarCuentaEntrada,
  ConsultaCuentas
> {
  constructor(servicio: CuentasServicio) {
    super(servicio, {
      crear: esquemaCrearCuenta,
      editar: esquemaEditarCuenta,
      consulta: esquemaConsultaCuentas,
    });
  }
}
