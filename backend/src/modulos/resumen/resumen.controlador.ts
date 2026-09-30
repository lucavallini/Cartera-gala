import type { RequestHandler } from "express";
import { parametro } from "../../compartido/http/parametros";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import { esquemaConsultaResumen } from "./resumen.esquemas";
import type { ResumenServicio } from "./resumen.servicio";

export class ResumenControlador {
  constructor(private readonly servicio: ResumenServicio) {}

  readonly obtener: RequestHandler = async (req, res) => {
    const consulta = validar(esquemaConsultaResumen, req.query);
    res.json(await this.servicio.obtener(usuarioDe(req).id, consulta));
  };

  readonly activo: RequestHandler = async (req, res) => {
    const consulta = validar(esquemaConsultaResumen, req.query);
    res.json(
      await this.servicio.activo(usuarioDe(req).id, parametro(req, "instrumentoId"), consulta),
    );
  };
}
