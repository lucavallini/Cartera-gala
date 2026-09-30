import type { RequestHandler } from "express";
import { parametro } from "../../compartido/http/parametros";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import {
  esquemaBusqueda,
  esquemaEditarInstrumento,
  esquemaPrecioManual,
} from "./instrumentos.esquemas";
import type { InstrumentosServicio } from "./instrumentos.servicio";

export class InstrumentosControlador {
  constructor(private readonly servicio: InstrumentosServicio) {}

  readonly buscar: RequestHandler = async (req, res) => {
    const { q } = validar(esquemaBusqueda, req.query);
    res.json(await this.servicio.buscar(usuarioDe(req).id, q));
  };

  readonly obtener: RequestHandler = async (req, res) => {
    res.json(await this.servicio.obtener(usuarioDe(req).id, parametro(req, "id")));
  };

  readonly editar: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaEditarInstrumento, req.body);
    res.json(await this.servicio.editar(usuarioDe(req).id, parametro(req, "id"), entrada));
  };

  readonly fijarPrecioManual: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaPrecioManual, req.body);
    res.json(
      await this.servicio.fijarPrecioManual(usuarioDe(req).id, parametro(req, "id"), entrada),
    );
  };

  readonly quitarPrecioManual: RequestHandler = async (req, res) => {
    res.json(await this.servicio.quitarPrecioManual(usuarioDe(req).id, parametro(req, "id")));
  };
}
