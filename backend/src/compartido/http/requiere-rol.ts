import type { RequestHandler } from "express";
import type { RolUsuario } from "@cartera/contratos";
import { ErrorProhibido } from "../errores";
import { usuarioDe } from "./usuario-de";

export function requiereRol(rol: RolUsuario, mensaje?: string): RequestHandler {
  return (req, _res, next) => {
    if (usuarioDe(req).rol !== rol) throw new ErrorProhibido(mensaje);
    next();
  };
}
