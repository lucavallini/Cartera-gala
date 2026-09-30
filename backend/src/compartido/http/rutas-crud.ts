import { Router } from "express";
import type { ManejadoresCrud } from "./controlador-crud";

export function crearRutasCrud(manejadores: ManejadoresCrud): Router {
  const rutas = Router();
  rutas.get("/", manejadores.listar);
  rutas.post("/", manejadores.crear);
  rutas.get("/:id", manejadores.obtener);
  rutas.patch("/:id", manejadores.editar);
  rutas.delete("/:id", manejadores.borrar);
  return rutas;
}
