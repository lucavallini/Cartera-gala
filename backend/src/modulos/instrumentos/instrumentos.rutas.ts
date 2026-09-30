import { Router } from "express";
import { requiereRol } from "../../compartido/http/requiere-rol";
import type { InstrumentosControlador } from "./instrumentos.controlador";

export function crearRutasInstrumentos(controlador: InstrumentosControlador): Router {
  const rutas = Router();
  rutas.get("/buscar", controlador.buscar);
  rutas.get("/:id", controlador.obtener);
  rutas.patch(
    "/:id",
    requiereRol("ADMIN", "Solo un administrador puede cambiar los datos del catálogo."),
    controlador.editar,
  );
  rutas.put("/:id/precio-manual", controlador.fijarPrecioManual);
  rutas.delete("/:id/precio-manual", controlador.quitarPrecioManual);
  return rutas;
}
