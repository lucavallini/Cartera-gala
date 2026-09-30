import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const LARGO_REFERENCIA = 8;

/**
 * Código corto por pedido. Viaja en la respuesta (y en el encabezado X-Referencia) y queda en
 * la consola junto al error técnico: el usuario lo puede dictar sin ver ningún detalle interno.
 */
export const referenciaPedido: RequestHandler = (req, res, next) => {
  req.referencia = randomUUID().replaceAll("-", "").slice(0, LARGO_REFERENCIA).toUpperCase();
  res.setHeader("X-Referencia", req.referencia);
  next();
};
