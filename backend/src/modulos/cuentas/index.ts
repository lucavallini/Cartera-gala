import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { CuentasControlador } from "./cuentas.controlador";
import { CuentasRepositorio } from "./cuentas.repositorio";
import { crearRutasCuentas } from "./cuentas.rutas";
import { CuentasServicio } from "./cuentas.servicio";

export type { CuentasServicio } from "./cuentas.servicio";

export interface ModuloCuentas {
  servicio: CuentasServicio;
  rutas: Router;
}

export function crearModuloCuentas(
  bd: PrismaClient,
  auditoria: AuditoriaRepositorio,
): ModuloCuentas {
  const servicio = new CuentasServicio(bd, new CuentasRepositorio(bd), auditoria);
  return { servicio, rutas: crearRutasCuentas(new CuentasControlador(servicio)) };
}
