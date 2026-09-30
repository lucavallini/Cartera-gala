import type { Router } from "express";
import { crearRutasCrud } from "../../compartido/http/rutas-crud";
import type { CuentasControlador } from "./cuentas.controlador";

export function crearRutasCuentas(controlador: CuentasControlador): Router {
  return crearRutasCrud(controlador);
}
