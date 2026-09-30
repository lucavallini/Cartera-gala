import type { RequestHandler } from "express";
import type { MercadoServicio } from "./mercado.servicio";

export class MercadoControlador {
  constructor(private readonly servicio: MercadoServicio) {}

  readonly actualizar: RequestHandler = async (_req, res) => {
    res.json(await this.servicio.actualizar());
  };
}
