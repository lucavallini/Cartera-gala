import { Router } from "express";
import type { MercadoControlador } from "./mercado.controlador";

export function crearRutasMercado(controlador: MercadoControlador): Router {
  const rutas = Router();
  rutas.post("/actualizar", controlador.actualizar);
  return rutas;
}
