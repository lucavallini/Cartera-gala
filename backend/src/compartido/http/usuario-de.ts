import type { Request } from "express";
import type { RolUsuario } from "@cartera/contratos";
import { ErrorNoAutorizado } from "../errores";

export interface UsuarioAutenticado {
  id: string;
  rol: RolUsuario;
}

/** Devuelve el usuario que dejó el middleware de autenticación, o corta con 401. */
export function usuarioDe(req: Request): UsuarioAutenticado {
  if (!req.usuario) throw new ErrorNoAutorizado();
  return req.usuario;
}
