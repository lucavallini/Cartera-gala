/** Códigos que puede devolver la API. El frontend decide qué hacer según el código. */
export type CodigoError =
  | "VALIDACION"
  | "JSON_INVALIDO"
  | "DEMASIADO_GRANDE"
  | "NO_AUTORIZADO"
  /** El refresh ya fue rotado por otro pedido (otra pestaña): reintentar una vez con la cookie nueva. */
  | "REFRESH_YA_ROTADO"
  | "PROHIBIDO"
  | "NO_ENCONTRADO"
  | "CONFLICTO"
  | "DEMASIADOS_INTENTOS"
  | "PROVEEDOR_EXTERNO"
  | "ERROR_BASE_DATOS"
  | "ERROR_INTERNO";

export interface DetalleError {
  campo: string;
  mensaje: string;
}

export interface RespuestaError {
  error: {
    codigo: CodigoError;
    /** Siempre en castellano llano, apto para mostrar al usuario. */
    mensaje: string;
    detalles?: DetalleError[];
    /** Código corto del pedido: el mismo que queda en la consola junto al detalle técnico. */
    referencia?: string;
  };
}
