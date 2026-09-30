import type { UsuarioAutenticado } from "../compartido/http/usuario-de";

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
      referencia?: string;
    }
  }
}

export {};
