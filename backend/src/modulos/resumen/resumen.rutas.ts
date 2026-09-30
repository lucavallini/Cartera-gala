import { Router } from "express";
import type { ResumenControlador } from "./resumen.controlador";

export function crearRutasResumen(controlador: ResumenControlador): Router {
  const rutas = Router();
  rutas.get("/", controlador.obtener);
  return rutas;
}

export function crearRutasActivos(controlador: ResumenControlador): Router {
  const rutas = Router();
  rutas.get("/:instrumentoId", controlador.activo);
  return rutas;
}
