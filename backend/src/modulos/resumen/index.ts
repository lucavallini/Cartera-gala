import type { Router } from "express";
import { ResumenControlador } from "./resumen.controlador";
import { crearRutasActivos, crearRutasResumen } from "./resumen.rutas";
import { ResumenServicio, type DependenciasResumen } from "./resumen.servicio";

export type { ResumenServicio } from "./resumen.servicio";

export interface ModuloResumen {
  servicio: ResumenServicio;
  rutasResumen: Router;
  rutasActivos: Router;
}

export function crearModuloResumen(dependencias: DependenciasResumen): ModuloResumen {
  const servicio = new ResumenServicio(dependencias);
  const controlador = new ResumenControlador(servicio);
  return {
    servicio,
    rutasResumen: crearRutasResumen(controlador),
    rutasActivos: crearRutasActivos(controlador),
  };
}
