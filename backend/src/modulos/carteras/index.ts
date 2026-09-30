import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { CarterasControlador } from "./carteras.controlador";
import { CarterasRepositorio } from "./carteras.repositorio";
import { crearRutasCarteras } from "./carteras.rutas";
import { CarterasServicio } from "./carteras.servicio";

export type { CarterasServicio } from "./carteras.servicio";

export interface ModuloCarteras {
  servicio: CarterasServicio;
  rutas: Router;
}

export function crearModuloCarteras(
  bd: PrismaClient,
  auditoria: AuditoriaRepositorio,
): ModuloCarteras {
  const servicio = new CarterasServicio(bd, new CarterasRepositorio(bd), auditoria);
  return { servicio, rutas: crearRutasCarteras(new CarterasControlador(servicio)) };
}
