import type { UsuarioDto } from "@cartera/contratos";

/** Lo que otros módulos necesitan del usuario: moneda, dólar de referencia y método de costo. */
export interface FuentePreferencias {
  yo(usuarioId: string): Promise<UsuarioDto>;
}
