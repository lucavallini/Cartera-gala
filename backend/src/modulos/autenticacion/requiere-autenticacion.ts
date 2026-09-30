import type { RequestHandler } from "express";
import { ErrorNoAutorizado } from "../../compartido/errores";
import type { ServicioTokens } from "./tokens";

export function crearRequiereAutenticacion(tokens: ServicioTokens): RequestHandler {
  return async (req, _res, next) => {
    const [esquema, token] = req.get("authorization")?.split(" ") ?? [];
    if (esquema !== "Bearer" || !token) throw new ErrorNoAutorizado();
    const carga = await tokens.verificarAcceso(token);
    req.usuario = { id: carga.usuarioId, rol: carga.rol };
    next();
  };
}
