import type { MetodoCosto, Moneda, RolUsuario, TipoDolar } from "./comunes";

export interface RegistroEntrada {
  nombre: string;
  email: string;
  password: string;
}

export interface LoginEntrada {
  email: string;
  password: string;
}

export interface CambioPasswordEntrada {
  passwordActual: string;
  passwordNueva: string;
}

export interface UsuarioDto {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  monedaBase: Moneda;
  dolarReferencia: TipoDolar;
  metodoCosto: MetodoCosto;
}

export interface SesionRespuesta {
  tokenAcceso: string;
  /** ISO 8601. */
  expiraEn: string;
  usuario: UsuarioDto;
}
