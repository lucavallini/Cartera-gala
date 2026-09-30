import type { CodigoError, DetalleError } from "@cartera/contratos";

export abstract class ErrorApp extends Error {
  protected constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly status: number,
    readonly detalles?: DetalleError[],
    /** Error técnico original: va a la consola, nunca a la respuesta. */
    readonly causa?: unknown,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErrorValidacion extends ErrorApp {
  constructor(
    mensaje = "Hay datos inválidos. Revisá los campos marcados.",
    detalles?: DetalleError[],
  ) {
    super("VALIDACION", mensaje, 400, detalles);
  }
}

export class ErrorNoAutorizado extends ErrorApp {
  constructor(mensaje = "Tenés que iniciar sesión.") {
    super("NO_AUTORIZADO", mensaje, 401);
  }
}

/**
 * El refresh que llegó ya fue rotado hace instantes por otro pedido (otra pestaña).
 * No es un robo: el cliente tiene que reintentar una vez con la cookie nueva.
 */
export class ErrorRefreshYaRotado extends ErrorApp {
  constructor() {
    super("REFRESH_YA_ROTADO", "Tu sesión se renovó en otra pestaña. Reintentá.", 401);
  }
}

export class ErrorProhibido extends ErrorApp {
  constructor(mensaje = "No tenés permiso para hacer esto.") {
    super("PROHIBIDO", mensaje, 403);
  }
}

export class ErrorNoEncontrado extends ErrorApp {
  /** @param entidad con artículo, por ejemplo "la cartera". */
  constructor(entidad: string) {
    super("NO_ENCONTRADO", `No se encontró ${entidad}.`, 404);
  }
}

/** Una ruta que no existe en la API: no muestra el método ni la ruta técnica. */
export class ErrorRutaNoEncontrada extends ErrorApp {
  constructor() {
    super("NO_ENCONTRADO", "No existe esa página.", 404);
  }
}

export class ErrorConflicto extends ErrorApp {
  constructor(mensaje: string) {
    super("CONFLICTO", mensaje, 409);
  }
}

export class ErrorDemasiadosIntentos extends ErrorApp {
  constructor(mensaje = "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.") {
    super("DEMASIADOS_INTENTOS", mensaje, 429);
  }
}

export class ErrorProveedorExterno extends ErrorApp {
  constructor(mensaje: string, causa?: unknown) {
    super("PROVEEDOR_EXTERNO", mensaje, 502, undefined, causa);
  }
}
