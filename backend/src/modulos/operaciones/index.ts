import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { OperacionesControlador } from "./operaciones.controlador";
import { OperacionesRepositorio } from "./operaciones.repositorio";
import { crearRutasOperaciones } from "./operaciones.rutas";
import { OperacionesServicio, type DependenciasOperaciones } from "./operaciones.servicio";

export type { OperacionesServicio, DependenciasOperaciones } from "./operaciones.servicio";

export interface ModuloOperaciones {
  servicio: OperacionesServicio;
  rutas: Router;
}

export function crearModuloOperaciones(
  bd: PrismaClient,
  auditoria: AuditoriaRepositorio,
  dependencias: DependenciasOperaciones,
): ModuloOperaciones {
  const servicio = new OperacionesServicio(
    bd,
    new OperacionesRepositorio(bd),
    auditoria,
    dependencias,
  );
  return { servicio, rutas: crearRutasOperaciones(new OperacionesControlador(servicio)) };
}
