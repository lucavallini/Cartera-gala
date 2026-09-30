import type { RequestHandler } from "express";
import type { OperacionDto } from "@cartera/contratos";
import { ControladorCrud } from "../../compartido/http/controlador-crud";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import {
  esquemaConsultaOperaciones,
  esquemaCrearOperacion,
  esquemaDatosOperacion,
  esquemaSimularOperacion,
  type ConsultaOperaciones,
  type DatosOperacion,
  type EntradaCrearOperacion,
} from "./operaciones.esquemas";
import type { OperacionesServicio } from "./operaciones.servicio";

export class OperacionesControlador extends ControladorCrud<
  OperacionDto,
  EntradaCrearOperacion,
  DatosOperacion,
  ConsultaOperaciones
> {
  constructor(private readonly operaciones: OperacionesServicio) {
    super(operaciones, {
      crear: esquemaCrearOperacion,
      editar: esquemaDatosOperacion,
      consulta: esquemaConsultaOperaciones,
    });
  }

  readonly tipos: RequestHandler = (_req, res) => {
    res.json(this.operaciones.tipos());
  };

  readonly simular: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaSimularOperacion, req.body);
    res.json(await this.operaciones.simular(usuarioDe(req).id, entrada));
  };
}
