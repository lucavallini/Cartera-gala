import { Router } from "express";
import { crearRutasCrud } from "../../compartido/http/rutas-crud";
import type { OperacionesControlador } from "./operaciones.controlador";

export function crearRutasOperaciones(controlador: OperacionesControlador): Router {
  const rutas = Router();
  // Antes que las rutas con :id, para que "tipos" y "simular" no se tomen como un id.
  rutas.get("/tipos", controlador.tipos);
  rutas.post("/simular", controlador.simular);
  rutas.use(crearRutasCrud(controlador));
  return rutas;
}
