import type { Router } from "express";
import { crearRutasCrud } from "../../compartido/http/rutas-crud";
import type { CarterasControlador } from "./carteras.controlador";

export function crearRutasCarteras(controlador: CarterasControlador): Router {
  return crearRutasCrud(controlador);
}
