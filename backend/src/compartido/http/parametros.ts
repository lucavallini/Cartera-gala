import type { Request } from "express";
import { ErrorValidacion } from "../errores";

export function parametro(req: Request, nombre: string): string {
  const valor: unknown = req.params[nombre];
  if (typeof valor !== "string" || valor.length === 0) {
    throw new ErrorValidacion(`Falta el parámetro "${nombre}" en la dirección.`);
  }
  return valor;
}
