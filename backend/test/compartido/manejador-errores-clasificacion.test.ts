import { describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { Prisma } from "../../src/generado/prisma/client";
import {
  crearManejadorErrores,
  type RegistroDeError,
} from "../../src/compartido/http/manejador-errores";
import { referenciaPedido } from "../../src/compartido/http/referencia-pedido";
import { ErrorProveedorExterno, ErrorValidacion } from "../../src/compartido/errores";

const VERSION = "7.10.0";
const TEXTO_TECNICO = /prisma|sqlite|invocation|constraint|P20\d\d|ECONN|stack|Error:/i;

function appQueLanza(error: unknown) {
  const registros: RegistroDeError[] = [];
  const app = express();
  app.use(referenciaPedido);
  app.get("/x", (() => {
    throw error;
  }) as RequestHandler);
  app.use(crearManejadorErrores((registro) => registros.push(registro)));
  return { app, registros };
}

function conocido(codigo: string) {
  return new Prisma.PrismaClientKnownRequestError(
    "\nInvalid `bd.cartera.create()` invocation in /home/x/archivo.ts:1:1\nForeign key constraint violated",
    { code: codigo, clientVersion: VERSION },
  );
}

describe("clasificación de errores", () => {
  const casos: [string, unknown, number, string, string][] = [
    ["unicidad", conocido("P2002"), 409, "CONFLICTO", "Ya existe un registro con esos datos."],
    [
      "referencia inválida",
      conocido("P2003"),
      409,
      "CONFLICTO",
      "No se puede guardar porque depende de un dato que no existe o que está en uso.",
    ],
    [
      "registro inexistente",
      conocido("P2025"),
      404,
      "NO_ENCONTRADO",
      "No se encontró lo que buscabas. Puede que se haya borrado.",
    ],
    [
      "otro error de la base",
      conocido("P2034"),
      500,
      "ERROR_BASE_DATOS",
      "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos.",
    ],
    [
      "base inaccesible",
      new Prisma.PrismaClientInitializationError("Can't reach database server at `x`", VERSION),
      503,
      "ERROR_BASE_DATOS",
      "No hay conexión con la base de datos. Probá de nuevo en unos minutos.",
    ],
    [
      "error desconocido de la base",
      new Prisma.PrismaClientUnknownRequestError("SQLITE_BUSY: database is locked", {
        clientVersion: VERSION,
      }),
      500,
      "ERROR_BASE_DATOS",
      "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos.",
    ],
    [
      "consulta mal armada",
      new Prisma.PrismaClientValidationError("Argument `where` is missing.", {
        clientVersion: VERSION,
      }),
      500,
      "ERROR_BASE_DATOS",
      "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos.",
    ],
    [
      "servicio externo",
      new ErrorProveedorExterno("No pudimos actualizar los precios.", new Error("ECONNRESET")),
      502,
      "PROVEEDOR_EXTERNO",
      "No pudimos actualizar los precios.",
    ],
    [
      "error de código",
      new TypeError("Cannot read properties of undefined (reading 'x')"),
      500,
      "ERROR_INTERNO",
      "Ocurrió un error inesperado. Probá de nuevo en unos segundos.",
    ],
  ];

  it.each(casos)(
    "%s: mensaje llano, sin detalle técnico y con referencia",
    async (_nombre, error, status, codigo, mensaje) => {
      const { app } = appQueLanza(error);
      const respuesta = await request(app).get("/x");
      expect(respuesta.status).toBe(status);
      expect(respuesta.body.error.codigo).toBe(codigo);
      expect(respuesta.body.error.mensaje).toBe(mensaje);
      expect(JSON.stringify(respuesta.body)).not.toMatch(TEXTO_TECNICO);
      expect(respuesta.body.error.referencia).toMatch(/^[0-9A-F]{8}$/);
      expect(respuesta.headers["x-referencia"]).toBe(respuesta.body.error.referencia);
    },
  );

  it("registra en consola el error técnico completo con la referencia del pedido", async () => {
    const causa = new Error("ECONNRESET");
    const { app, registros } = appQueLanza(
      new ErrorProveedorExterno("No pudimos actualizar los precios.", causa),
    );
    const respuesta = await request(app).get("/x");
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      referencia: respuesta.body.error.referencia,
      metodo: "GET",
      ruta: "/x",
    });
    expect(registros[0]?.error).toBe(causa);
  });

  it("los errores esperables del usuario (validación) no se registran como fallas", async () => {
    const { app, registros } = appQueLanza(new ErrorValidacion("Revisá los datos."));
    await request(app).get("/x");
    expect(registros).toHaveLength(0);
  });

  it("el registrador por defecto escribe en la consola con la referencia", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.use(referenciaPedido);
    app.get("/x", (() => {
      throw new Error("detalle interno");
    }) as RequestHandler);
    app.use(crearManejadorErrores());
    const respuesta = await request(app).get("/x");
    expect(espia).toHaveBeenCalledOnce();
    expect(String(espia.mock.calls[0]?.[0])).toContain(respuesta.body.error.referencia);
    espia.mockRestore();
  });
});
