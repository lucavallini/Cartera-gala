import type { CarteraDto, CrearCarteraEntrada, EditarCarteraEntrada } from "@cartera/contratos";
import { ControladorCrud } from "../../compartido/http/controlador-crud";
import {
  esquemaConsultaCarteras,
  esquemaCrearCartera,
  esquemaEditarCartera,
  type ConsultaCarteras,
} from "./carteras.esquemas";
import type { CarterasServicio } from "./carteras.servicio";

export class CarterasControlador extends ControladorCrud<
  CarteraDto,
  CrearCarteraEntrada,
  EditarCarteraEntrada,
  ConsultaCarteras
> {
  constructor(servicio: CarterasServicio) {
    super(servicio, {
      crear: esquemaCrearCartera,
      editar: esquemaEditarCartera,
      consulta: esquemaConsultaCarteras,
    });
  }
}
