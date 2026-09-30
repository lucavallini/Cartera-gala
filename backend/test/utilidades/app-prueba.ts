import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request, { type Response } from "supertest";
import type { RegistroEntrada, SesionRespuesta, UsuarioDto } from "@cartera/contratos";
import type { PrismaClient } from "../../src/generado/prisma/client";
import { crearApp } from "../../src/app";
import { crearContenedor } from "../../src/contenedor";
import { NOMBRE_COOKIE_REFRESH } from "../../src/modulos/autenticacion";
import { crearBasePrueba } from "./base-datos-prueba";
import { entornoPrueba } from "./entorno-prueba";
import type { BuscarFalso } from "./http-falso";
import {
  AHORA_FIXTURES,
  crearProveedoresPrueba,
  type ProveedoresPrueba,
} from "./proveedores-prueba";

export interface AppPrueba {
  app: Express;
  bd: PrismaClient;
  /** Registra las URLs externas pedidas (fixtures, sin red). */
  buscar: BuscarFalso;
  cerrar: () => Promise<void>;
}

export interface OpcionesAppPrueba {
  proveedores?: ProveedoresPrueba;
  ahora?: () => Date;
}

export async function crearAppPrueba(
  extra: Record<string, string> = {},
  opciones: OpcionesAppPrueba = {},
): Promise<AppPrueba> {
  const { bd, cerrar } = await crearBasePrueba();
  const ahora = opciones.ahora ?? (() => AHORA_FIXTURES);
  const proveedores = opciones.proveedores ?? crearProveedoresPrueba({ ahora });
  const contenedor = crearContenedor(entornoPrueba(extra), bd, {
    ahora,
    proveedores: {
      cotizaciones: proveedores.cotizaciones,
      dolarActual: proveedores.dolarActual,
      dolarHistorico: proveedores.argentinaDatos,
      feriados: proveedores.argentinaDatos,
    },
  });
  return { app: crearApp(contenedor), bd, buscar: proveedores.buscar, cerrar };
}

export interface UsuarioLogueado {
  token: string;
  cookie: string;
  usuario: UsuarioDto;
}

export function extraerCookieRefresh(respuesta: Response): string {
  const encabezado = respuesta.headers["set-cookie"];
  const cookies = Array.isArray(encabezado) ? encabezado : encabezado ? [String(encabezado)] : [];
  const cookie = cookies.find((valor) => valor.startsWith(`${NOMBRE_COOKIE_REFRESH}=`));
  if (!cookie) throw new Error("La respuesta no trajo la cookie de refresh.");
  return cookie.split(";")[0] ?? cookie;
}

export async function registrarUsuario(
  app: Express,
  datos: Partial<RegistroEntrada> = {},
): Promise<UsuarioLogueado> {
  const cuerpo: RegistroEntrada = {
    nombre: "Usuario de prueba",
    email: `api-${randomUUID()}@prueba.com`,
    password: "clave-segura-123",
    ...datos,
  };
  const respuesta = await request(app).post("/api/auth/registro").send(cuerpo).expect(201);
  const sesion = respuesta.body as SesionRespuesta;
  return {
    token: sesion.tokenAcceso,
    cookie: extraerCookieRefresh(respuesta),
    usuario: sesion.usuario,
  };
}

/** Usuario con rol ADMIN (el registro crea USUARIO): se promueve en la base y se vuelve a loguear. */
export async function registrarAdmin(prueba: AppPrueba): Promise<UsuarioLogueado> {
  const registrado = await registrarUsuario(prueba.app);
  await prueba.bd.usuario.update({ where: { id: registrado.usuario.id }, data: { rol: "ADMIN" } });
  const login = await request(prueba.app)
    .post("/api/auth/login")
    .send({ email: registrado.usuario.email, password: "clave-segura-123" })
    .expect(200);
  const sesion = login.body as SesionRespuesta;
  return {
    token: sesion.tokenAcceso,
    cookie: extraerCookieRefresh(login),
    usuario: sesion.usuario,
  };
}
