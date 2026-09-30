import { ErrorProveedorExterno } from "../../compartido/errores";

export interface DatoConFecha<T> {
  valor: T;
  obtenidoEn: Date;
  /** true cuando la fuente falló y se devuelve el último dato conocido. */
  desactualizado: boolean;
}

export interface RespuestaHttp {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type BuscarHttp = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<RespuestaHttp>;

export interface OpcionesProveedorHttp {
  buscar?: BuscarHttp;
  ahora?: () => Date;
  timeoutMs?: number;
  reintentos?: number;
  /** Dónde va el detalle técnico de una falla. Nunca llega al usuario. */
  registrar?: (mensaje: string, error: unknown) => void;
}

interface Entrada {
  valor: unknown;
  obtenidoEn: Date;
}

interface Fallo {
  enMs: number;
  error: unknown;
}

const TIMEOUT_POR_DEFECTO_MS = 8_000;
const REINTENTOS_POR_DEFECTO = 1;
/** Tope de la espera tras una falla: se usa el TTL de la clave, pero nunca más que esto. */
export const ESPERA_TRAS_FALLO_MS = 60_000;
/** Un pedido forzado no vuelve a la red si el dato guardado es más nuevo que esto. */
export const REFRESCO_MINIMO_MS = 10_000;

/**
 * Base de todos los proveedores HTTP: timeout, reintento, caché con vencimiento, una sola
 * descarga para pedidos simultáneos y respaldo con el último dato cuando la fuente falla.
 */
export abstract class ProveedorHttpBase {
  /** Qué se obtiene, para los mensajes al usuario: "los precios del mercado". */
  protected abstract readonly queSeObtiene: string;

  private readonly cache = new Map<string, Entrada>();
  private readonly enCurso = new Map<string, Promise<Entrada>>();
  /** Última falla de cada clave: mientras dura la espera no se vuelve a la red. */
  private readonly fallos = new Map<string, Fallo>();
  private readonly buscar: BuscarHttp;
  private readonly ahora: () => Date;
  private readonly timeoutMs: number;
  private readonly reintentos: number;
  private readonly registrar: (mensaje: string, error: unknown) => void;

  constructor(opciones: OpcionesProveedorHttp = {}) {
    this.buscar = opciones.buscar ?? ((url, init) => fetch(url, init));
    this.ahora = opciones.ahora ?? (() => new Date());
    this.timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;
    this.reintentos = opciones.reintentos ?? REINTENTOS_POR_DEFECTO;
    this.registrar = opciones.registrar ?? ((mensaje, error) => console.error(mensaje, error));
  }

  protected async obtener<T>(
    clave: string,
    url: string,
    ttlMs: number,
    interpretar: (json: unknown) => T,
    forzar = false,
  ): Promise<DatoConFecha<T>> {
    const ahoraMs = this.ahora().getTime();
    const guardada = this.cache.get(clave);
    const edad = guardada ? ahoraMs - guardada.obtenidoEn.getTime() : Infinity;
    // Forzar no martilla la fuente: con un dato de hace menos de REFRESCO_MINIMO_MS se usa ese.
    if (guardada && edad < ttlMs && (!forzar || edad < REFRESCO_MINIMO_MS)) {
      return { valor: guardada.valor as T, obtenidoEn: guardada.obtenidoEn, desactualizado: false };
    }
    // Tras una falla se espera antes de volver a intentar (tampoco con forzar): responde enseguida.
    const fallo = this.fallos.get(clave);
    if (fallo && ahoraMs - fallo.enMs < Math.min(ttlMs, ESPERA_TRAS_FALLO_MS)) {
      return this.respaldo<T>(guardada, fallo.error);
    }
    try {
      const entrada = await this.descargarUnaVez(clave, url, interpretar);
      this.fallos.delete(clave);
      return { valor: entrada.valor as T, obtenidoEn: entrada.obtenidoEn, desactualizado: false };
    } catch (error) {
      this.registrar(`No se pudo obtener ${this.queSeObtiene} desde ${url}`, error);
      this.fallos.set(clave, { enMs: this.ahora().getTime(), error });
      return this.respaldo<T>(guardada, error);
    }
  }

  /** El último dato conocido, marcado como desactualizado; sin él, el error llano. */
  private respaldo<T>(guardada: Entrada | undefined, error: unknown): DatoConFecha<T> {
    if (guardada) {
      return { valor: guardada.valor as T, obtenidoEn: guardada.obtenidoEn, desactualizado: true };
    }
    throw new ErrorProveedorExterno(
      `No pudimos obtener ${this.queSeObtiene}. Probá de nuevo en unos minutos.`,
      error,
    );
  }

  private descargarUnaVez<T>(
    clave: string,
    url: string,
    interpretar: (json: unknown) => T,
  ): Promise<Entrada> {
    const existente = this.enCurso.get(clave);
    if (existente) return existente;
    const descarga = this.descargar(url)
      .then((json) => {
        const entrada: Entrada = { valor: interpretar(json), obtenidoEn: this.ahora() };
        this.cache.set(clave, entrada);
        return entrada;
      })
      .finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, descarga);
    return descarga;
  }

  private async descargar(url: string): Promise<unknown> {
    let ultimoError: unknown;
    for (let intento = 0; intento <= this.reintentos; intento += 1) {
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), this.timeoutMs);
      try {
        const respuesta = await this.buscar(url, {
          signal: control.signal,
          headers: { Accept: "application/json" },
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en ${url}`);
        return await respuesta.json();
      } catch (error) {
        ultimoError = error;
      } finally {
        clearTimeout(temporizador);
      }
    }
    throw ultimoError;
  }
}
