import type { ErrorRequestHandler } from "express";
import type { CodigoError, DetalleError, RespuestaError } from "@cartera/contratos";
import { Prisma } from "../../generado/prisma/client";
import { ErrorApp } from "../errores";

export interface RegistroDeError {
  referencia: string | undefined;
  metodo: string;
  ruta: string;
  error: unknown;
}

export type RegistradorDeErrores = (registro: RegistroDeError) => void;

export const registrarEnConsola: RegistradorDeErrores = (registro) => {
  console.error(
    `[error ${registro.referencia ?? "sin-referencia"}] ${registro.metodo} ${registro.ruta}`,
    registro.error,
  );
};

interface Clasificacion {
  status: number;
  codigo: CodigoError;
  mensaje: string;
  detalles?: DetalleError[];
  /** Solo las fallas del sistema van a la consola; los errores esperables del usuario no. */
  registrar: boolean;
  /** Lo que se registra: la causa técnica si existe. */
  tecnico: unknown;
}

const MENSAJE_BASE_DATOS = "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos.";
const MENSAJE_SIN_CONEXION =
  "No hay conexión con la base de datos. Probá de nuevo en unos minutos.";
const MENSAJE_INESPERADO = "Ocurrió un error inesperado. Probá de nuevo en unos segundos.";

const ERRORES_PRISMA: Record<string, { status: number; codigo: CodigoError; mensaje: string }> = {
  P2002: { status: 409, codigo: "CONFLICTO", mensaje: "Ya existe un registro con esos datos." },
  P2003: {
    status: 409,
    codigo: "CONFLICTO",
    mensaje: "No se puede guardar porque depende de un dato que no existe o que está en uso.",
  },
  P2025: {
    status: 404,
    codigo: "NO_ENCONTRADO",
    mensaje: "No se encontró lo que buscabas. Puede que se haya borrado.",
  },
};

interface ErrorDeCuerpo {
  type: string;
  status: number;
}

function esErrorDeCuerpo(error: unknown): error is ErrorDeCuerpo {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string" &&
    "status" in error &&
    typeof error.status === "number"
  );
}

function errorDeBase(status: number, mensaje: string, error: unknown): Clasificacion {
  return { status, codigo: "ERROR_BASE_DATOS", mensaje, registrar: true, tecnico: error };
}

function clasificar(error: unknown): Clasificacion {
  if (error instanceof ErrorApp) {
    return {
      status: error.status,
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles,
      registrar: error.status >= 500,
      tecnico: error.causa ?? error,
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const conocido = ERRORES_PRISMA[error.code];
    return conocido
      ? { ...conocido, registrar: true, tecnico: error }
      : errorDeBase(500, MENSAJE_BASE_DATOS, error);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return errorDeBase(503, MENSAJE_SIN_CONEXION, error);
  }
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return errorDeBase(500, MENSAJE_BASE_DATOS, error);
  }
  if (esErrorDeCuerpo(error) && error.type === "entity.parse.failed") {
    return {
      status: 400,
      codigo: "JSON_INVALIDO",
      mensaje: "Los datos enviados no tienen el formato esperado.",
      registrar: false,
      tecnico: error,
    };
  }
  if (esErrorDeCuerpo(error) && error.type === "entity.too.large") {
    return {
      status: 413,
      codigo: "DEMASIADO_GRANDE",
      mensaje: "Lo que enviaste es demasiado grande.",
      registrar: false,
      tecnico: error,
    };
  }
  return {
    status: 500,
    codigo: "ERROR_INTERNO",
    mensaje: MENSAJE_INESPERADO,
    registrar: true,
    tecnico: error,
  };
}

export function crearManejadorErrores(
  registrar: RegistradorDeErrores = registrarEnConsola,
): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const clasificacion = clasificar(error);
    if (clasificacion.registrar) {
      registrar({
        referencia: req.referencia,
        metodo: req.method,
        ruta: req.originalUrl,
        error: clasificacion.tecnico,
      });
    }
    const cuerpo: RespuestaError = {
      error: {
        codigo: clasificacion.codigo,
        mensaje: clasificacion.mensaje,
        ...(clasificacion.detalles ? { detalles: clasificacion.detalles } : {}),
        ...(req.referencia ? { referencia: req.referencia } : {}),
      },
    };
    res.status(clasificacion.status).json(cuerpo);
  };
}
