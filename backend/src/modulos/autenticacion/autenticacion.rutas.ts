import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { ErrorDemasiadosIntentos } from "../../compartido/errores";
import type { AutenticacionControlador } from "./autenticacion.controlador";

export interface OpcionesRutasAutenticacion {
  intentosMaximos: number;
  ventanaMinutos: number;
}

const MS_POR_MINUTO = 60_000;

export function crearRutasAutenticacion(
  controlador: AutenticacionControlador,
  requiereAutenticacion: RequestHandler,
  opciones: OpcionesRutasAutenticacion,
): Router {
  const crearLimitador = () =>
    rateLimit({
      windowMs: opciones.ventanaMinutos * MS_POR_MINUTO,
      limit: opciones.intentosMaximos,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new ErrorDemasiadosIntentos()),
    });
  // Cuentas separadas: probar contraseñas en el login no consume los intentos del cambio de clave.
  const limitadorAcceso = crearLimitador();
  const limitadorPassword = crearLimitador();

  const rutas = Router();
  rutas.post("/registro", limitadorAcceso, controlador.registrar);
  rutas.post("/login", limitadorAcceso, controlador.login);
  rutas.post("/refrescar", controlador.refrescar);
  rutas.post("/logout", controlador.logout);
  rutas.get("/yo", requiereAutenticacion, controlador.yo);
  rutas.patch("/password", requiereAutenticacion, limitadorPassword, controlador.cambiarPassword);
  return rutas;
}
