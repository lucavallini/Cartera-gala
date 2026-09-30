import { z } from "zod";
import { Decimal } from "../../compartido/decimal";
import {
  ProveedorHttpBase,
  type DatoConFecha,
  type OpcionesProveedorHttp,
} from "../http/proveedor-http-base";
import {
  FAMILIAS_MERCADO,
  type FamiliaMercado,
  type FilaMercado,
  type ListasMercado,
  type ProveedorCotizaciones,
  type PuntoHistorico,
} from "./proveedor-cotizaciones";

const URL_BASE = "https://data912.com";
const TTL_VIVO_POR_DEFECTO_MS = 60_000;
const TTL_HISTORICO_MS = 3_600_000;

const RUTA_VIVO: Record<FamiliaMercado, string> = {
  ACCIONES: "live/arg_stocks",
  CEDEARS: "live/arg_cedears",
  BONOS: "live/arg_bonds",
  OBLIGACIONES: "live/arg_corp",
  LETRAS: "live/arg_notes",
};

/** data912 solo tiene histórico de estas familias (las ONs y letras no). */
const RUTA_HISTORICO: Partial<Record<FamiliaMercado, string>> = {
  ACCIONES: "historical/stocks",
  CEDEARS: "historical/cedears",
  BONOS: "historical/bonds",
};

const numeroOpcional = z.number().nullable().optional();

const esquemaFila = z.object({
  symbol: z.string(),
  c: numeroOpcional,
  px_bid: numeroOpcional,
  px_ask: numeroOpcional,
  pct_change: numeroOpcional,
});

const esquemaPuntoHistorico = z.object({ date: z.string(), c: z.number() });

function decimalPositivo(valor: number | null | undefined): Decimal | null {
  return valor !== null && valor !== undefined && valor > 0 ? new Decimal(String(valor)) : null;
}

/** Último precio operado; si no hubo operaciones, el promedio entre compra y venta. */
function interpretarLista(json: unknown): FilaMercado[] {
  const filas: FilaMercado[] = [];
  for (const fila of z.array(esquemaFila).parse(json)) {
    const cierre = decimalPositivo(fila.c);
    const compra = decimalPositivo(fila.px_bid);
    const venta = decimalPositivo(fila.px_ask);
    const precio = cierre ?? (compra && venta ? compra.plus(venta).div(2) : null);
    if (!precio) continue;
    const variacion = fila.pct_change;
    filas.push({
      simbolo: fila.symbol,
      precio,
      variacionPct:
        variacion === null || variacion === undefined ? null : new Decimal(String(variacion)),
    });
  }
  return filas;
}

/**
 * Cuando data912 no tiene el ticker responde un objeto con "Error": se toma como sin histórico.
 * Se ordena por fecha: quien lo usa toma los últimos días y no puede depender del orden de la fuente.
 */
function interpretarHistorico(json: unknown): PuntoHistorico[] {
  if (!Array.isArray(json)) return [];
  return z
    .array(esquemaPuntoHistorico)
    .parse(json)
    .map((punto) => ({ fecha: punto.date, cierre: new Decimal(String(punto.c)) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export class Data912Proveedor extends ProveedorHttpBase implements ProveedorCotizaciones {
  protected readonly queSeObtiene = "los precios del mercado";
  private readonly ttlVivoMs: number;

  constructor(opciones: OpcionesProveedorHttp & { ttlVivoMs?: number } = {}) {
    super(opciones);
    this.ttlVivoMs = opciones.ttlVivoMs ?? TTL_VIVO_POR_DEFECTO_MS;
  }

  /**
   * Si falla alguna lista se usan las demás (marcando el dato como desactualizado);
   * solo si fallan todas se informa el error.
   */
  async listas(forzar = false): Promise<DatoConFecha<ListasMercado>> {
    const resultados = await Promise.allSettled(
      FAMILIAS_MERCADO.map((familia) =>
        this.obtener(
          `vivo:${familia}`,
          `${URL_BASE}/${RUTA_VIVO[familia]}`,
          this.ttlVivoMs,
          interpretarLista,
          forzar,
        ),
      ),
    );
    const obtenidos = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (obtenidos.length === 0) {
      const primero = resultados[0];
      throw primero?.status === "rejected" ? primero.reason : new Error("Sin listas");
    }
    const listas = Object.fromEntries(
      FAMILIAS_MERCADO.map((familia, indice) => {
        const resultado = resultados[indice];
        return [familia, resultado?.status === "fulfilled" ? resultado.value.valor : []];
      }),
    ) as ListasMercado;
    return {
      valor: listas,
      obtenidoEn: new Date(Math.min(...obtenidos.map((r) => r.obtenidoEn.getTime()))),
      desactualizado:
        obtenidos.length < resultados.length || obtenidos.some((r) => r.desactualizado),
    };
  }

  async historico(
    familia: FamiliaMercado,
    simbolo: string,
  ): Promise<DatoConFecha<PuntoHistorico[]>> {
    const ruta = RUTA_HISTORICO[familia];
    if (!ruta) return { valor: [], obtenidoEn: new Date(0), desactualizado: false };
    return this.obtener(
      `historico:${familia}:${simbolo}`,
      `${URL_BASE}/${ruta}/${encodeURIComponent(simbolo)}`,
      TTL_HISTORICO_MS,
      interpretarHistorico,
    );
  }
}
