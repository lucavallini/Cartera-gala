import type { RequestHandler, Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { Entorno } from "../../config/entorno";
import { AutenticacionControlador } from "./autenticacion.controlador";
import { crearRutasAutenticacion } from "./autenticacion.rutas";
import { AutenticacionServicio } from "./autenticacion.servicio";
import { ServicioContrasenas } from "./contrasenas";
import { crearRequiereAutenticacion } from "./requiere-autenticacion";
import { SesionesRepositorio } from "./sesiones.repositorio";
import { ServicioTokens } from "./tokens";
import { UsuariosRepositorio } from "./usuarios.repositorio";

export type { AutenticacionServicio } from "./autenticacion.servicio";
export { LARGO_MINIMO_PASSWORD } from "./contrasenas";
export { NOMBRE_COOKIE_REFRESH } from "./autenticacion.controlador";

export interface ModuloAutenticacion {
  servicio: AutenticacionServicio;
  requiereAutenticacion: RequestHandler;
  rutas: Router;
}

export function crearModuloAutenticacion(bd: PrismaClient, entorno: Entorno): ModuloAutenticacion {
  const tokens = new ServicioTokens(
    entorno.JWT_SECRETO,
    entorno.JWT_ACCESO_MINUTOS,
    entorno.REFRESH_DIAS,
  );
  const servicio = new AutenticacionServicio(
    bd,
    new UsuariosRepositorio(bd),
    new SesionesRepositorio(bd),
    new ServicioContrasenas(),
    tokens,
    { registroHabilitado: entorno.REGISTRO_HABILITADO },
  );
  const requiereAutenticacion = crearRequiereAutenticacion(tokens);
  const controlador = new AutenticacionControlador(servicio, entorno.NODE_ENV === "production");
  const rutas = crearRutasAutenticacion(controlador, requiereAutenticacion, {
    intentosMaximos: entorno.LOGIN_INTENTOS_MAX,
    ventanaMinutos: entorno.LOGIN_VENTANA_MINUTOS,
  });
  return { servicio, requiereAutenticacion, rutas };
}
