import { z } from "zod";
import type {
  EditarInstrumentoEntrada,
  InstrumentoDto,
  Moneda,
  TipoInstrumento,
} from "@cartera/contratos";
import type { Instrumento } from "../../generado/prisma/client";
import { aDecimal, aNumero, type Decimal } from "../../compartido/decimal";
import { ErrorNoEncontrado, ErrorProveedorExterno } from "../../compartido/errores";
import { MONEDAS } from "../../compartido/esquemas";
import { DECIMALES_PRECIO } from "../../compartido/formato";
import type {
  FamiliaMercado,
  ProveedorCotizaciones,
} from "../../proveedores/cotizaciones/proveedor-cotizaciones";
import {
  derivarCatalogo,
  familiaDe,
  MONEDA_POR_SUFIJO,
  SUFIJO_ON,
  type Simbolos,
} from "./catalogo";
import type { InstrumentosRepositorio } from "./instrumentos.repositorio";
import type { PrecioManual, PreciosManualesRepositorio } from "./precios-manuales.repositorio";
import { TEXTO_TIPO_INSTRUMENTO, explicacionPrecio } from "./textos";
import { ESPERA_TRAS_FALLO_MS } from "../../proveedores/http/proveedor-http-base";

const VIGENCIA_CATALOGO_MS = 24 * 3_600_000;
/** Si data912 falla con el catálogo ya cargado, se reintenta recién después de este tiempo. */
const ESPERA_REINTENTO_MS = 5 * 60_000;
const LIMITE_BUSQUEDA = 10;
const SUFIJO_VARIANTE = new RegExp(`[${Object.keys(MONEDA_POR_SUFIJO).join("")}]$`);

const esquemaSimbolos = z.partialRecord(z.enum(MONEDAS), z.string());

export interface InstrumentoCatalogado {
  id: string;
  ticker: string;
  nombre: string | null;
  tipo: TipoInstrumento;
  familia: FamiliaMercado | null;
  simbolos: Simbolos;
  factorPrecio: Decimal;
  /** Tasa nominal anual en porcentaje, para los instrumentos que devengan (plazo fijo, caución). */
  tasaAnual: Decimal | null;
  emisor: string | null;
  sector: string | null;
}

function aCatalogado(instrumento: Instrumento): InstrumentoCatalogado {
  const simbolos = esquemaSimbolos.safeParse(instrumento.simbolos);
  return {
    id: instrumento.id,
    ticker: instrumento.ticker,
    nombre: instrumento.nombre,
    tipo: instrumento.tipo,
    familia: familiaDe(instrumento.tipo),
    simbolos: simbolos.success ? simbolos.data : {},
    factorPrecio: aDecimal(instrumento.factorPrecio),
    tasaAnual: instrumento.tasaCupon ? aDecimal(instrumento.tasaCupon) : null,
    emisor: instrumento.emisor,
    sector: instrumento.sector,
  };
}

function aDto(
  instrumento: InstrumentoCatalogado,
  manual: PrecioManual | undefined,
): InstrumentoDto {
  return {
    id: instrumento.id,
    ticker: instrumento.ticker,
    nombre: instrumento.nombre,
    tipo: instrumento.tipo,
    tipoTexto: TEXTO_TIPO_INSTRUMENTO[instrumento.tipo],
    monedas: MONEDAS.filter((moneda: Moneda) => instrumento.simbolos[moneda] !== undefined),
    factorPrecio: aNumero(instrumento.factorPrecio, DECIMALES_PRECIO),
    explicacionPrecio: explicacionPrecio(instrumento.factorPrecio),
    emisor: instrumento.emisor,
    sector: instrumento.sector,
    precioManual: manual
      ? {
          precio: aNumero(manual.precio, DECIMALES_PRECIO),
          moneda: manual.moneda,
          cargadoEn: manual.cargadoEn.toISOString(),
        }
      : null,
  };
}

/** "YM39D" → también "YM39" y "YM39O", para encontrar el activo por su símbolo en dólares. */
function tickersCandidatos(busqueda: string): string[] {
  if (!SUFIJO_VARIANTE.test(busqueda) || busqueda.length < 2) return [busqueda];
  const raiz = busqueda.slice(0, -1);
  return [busqueda, raiz, `${raiz}${SUFIJO_ON}`];
}

export class InstrumentosServicio {
  private ultimaSincronizacion: Date | null = null;
  private proximoIntento: Date | null = null;
  /** Compartida entre pedidos simultáneos: evita lanzar varias sincronizaciones a la vez. */
  private sincronizando: Promise<void> | null = null;

  constructor(
    private readonly instrumentos: InstrumentosRepositorio,
    private readonly precios: PreciosManualesRepositorio,
    private readonly proveedor: ProveedorCotizaciones,
    private readonly ahora: () => Date,
  ) {}

  /** Sincroniza con data912 si el catálogo está vacío o tiene más de un día. */
  async asegurarCatalogo(): Promise<void> {
    const ahora = this.ahora().getTime();
    const vigente =
      this.ultimaSincronizacion !== null &&
      ahora - this.ultimaSincronizacion.getTime() < VIGENCIA_CATALOGO_MS;
    const esperando = this.proximoIntento !== null && ahora < this.proximoIntento.getTime();
    if (vigente || esperando) return;
    // `this.sincronizando` se asigna en el mismo tick que se verifica: si hubiera un `await`
    // en el medio, varios pedidos simultáneos pasarían la verificación antes de que ninguno
    // tomara el mutex y lanzarían una sincronización cada uno.
    if (!this.sincronizando) {
      this.sincronizando = this.sincronizarConReintento().finally(() => {
        this.sincronizando = null;
      });
    }
    await this.sincronizando;
  }

  private async sincronizarConReintento(): Promise<void> {
    const hayCatalogo = (await this.instrumentos.contar()) > 0;
    try {
      const desactualizado = await this.sincronizar();
      // Listas parciales: no queda vigente 24 h; se reintenta recién pasada ESPERA_TRAS_FALLO_MS.
      this.proximoIntento = desactualizado
        ? new Date(this.ahora().getTime() + ESPERA_TRAS_FALLO_MS)
        : null;
    } catch (error) {
      if (!hayCatalogo || !(error instanceof ErrorProveedorExterno)) throw error;
      // Con catálogo cargado se sigue trabajando; se reintenta más tarde.
      this.proximoIntento = new Date(this.ahora().getTime() + ESPERA_REINTENTO_MS);
    }
  }

  /** Devuelve true si alguna lista vino desactualizada (falla parcial del proveedor). */
  async sincronizar(): Promise<boolean> {
    const listas = await this.proveedor.listas();
    const items = derivarCatalogo(listas.valor);
    await this.instrumentos.sincronizar(items);
    if (!listas.desactualizado) {
      this.ultimaSincronizacion = this.ahora();
    }
    return listas.desactualizado;
  }

  async buscar(usuarioId: string, busqueda: string): Promise<InstrumentoDto[]> {
    await this.asegurarCatalogo();
    const candidatos = tickersCandidatos(busqueda);
    const exactos = await this.instrumentos.porTickers(candidatos);
    exactos.sort((a, b) => candidatos.indexOf(a.ticker) - candidatos.indexOf(b.ticker));
    const porPrefijo = await this.instrumentos.porPrefijo(busqueda, LIMITE_BUSQUEDA);
    const vistos = new Set<string>();
    const resultado = [...exactos, ...porPrefijo]
      .filter((instrumento) => !vistos.has(instrumento.id) && vistos.add(instrumento.id))
      .slice(0, LIMITE_BUSQUEDA)
      .map(aCatalogado);
    const manuales = await this.precios.deUsuario(
      usuarioId,
      resultado.map((i) => i.id),
    );
    return resultado.map((instrumento) => aDto(instrumento, manuales.get(instrumento.id)));
  }

  async obtener(usuarioId: string, id: string): Promise<InstrumentoDto> {
    const instrumento = await this.catalogado(id);
    return this.aDtoDeCatalogado(usuarioId, instrumento);
  }

  /** Arma el DTO a partir de un instrumento ya leído (por ejemplo, del catálogo de un cálculo). */
  async aDtoDeCatalogado(
    usuarioId: string,
    instrumento: InstrumentoCatalogado,
  ): Promise<InstrumentoDto> {
    const manuales = await this.precios.deUsuario(usuarioId, [instrumento.id]);
    return aDto(instrumento, manuales.get(instrumento.id));
  }

  async catalogado(id: string): Promise<InstrumentoCatalogado> {
    const instrumento = await this.instrumentos.buscarPorId(id);
    if (!instrumento) throw new ErrorNoEncontrado("el activo");
    return aCatalogado(instrumento);
  }

  async catalogados(ids: readonly string[]): Promise<Map<string, InstrumentoCatalogado>> {
    const instrumentos = await this.instrumentos.porIds(ids);
    return new Map(instrumentos.map((instrumento) => [instrumento.id, aCatalogado(instrumento)]));
  }

  async editar(
    usuarioId: string,
    id: string,
    entrada: EditarInstrumentoEntrada,
  ): Promise<InstrumentoDto> {
    await this.catalogado(id);
    await this.instrumentos.editar(id, entrada);
    return this.obtener(usuarioId, id);
  }

  async fijarPrecioManual(
    usuarioId: string,
    id: string,
    entrada: { precio: Decimal; moneda: Moneda },
  ): Promise<InstrumentoDto> {
    await this.catalogado(id);
    await this.precios.fijar(usuarioId, id, entrada.precio, entrada.moneda, this.ahora());
    return this.obtener(usuarioId, id);
  }

  async quitarPrecioManual(usuarioId: string, id: string): Promise<InstrumentoDto> {
    await this.catalogado(id);
    await this.precios.quitar(usuarioId, id);
    return this.obtener(usuarioId, id);
  }

  preciosManuales(usuarioId: string, ids: readonly string[]): Promise<Map<string, PrecioManual>> {
    return this.precios.deUsuario(usuarioId, ids);
  }
}
