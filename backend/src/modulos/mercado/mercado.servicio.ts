import type { EstadoMercadoDto, Moneda, TipoDolar } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import { ErrorProveedorExterno, ErrorValidacion } from "../../compartido/errores";
import { aFechaDia, fechaCortaEn, formatoFechaCorta, hoyEn } from "../../compartido/fechas";
import type { PrecioVigente } from "../../motor/tipos";
import type {
  FilaMercado,
  ListasMercado,
  ProveedorCotizaciones,
  PuntoHistorico,
} from "../../proveedores/cotizaciones/proveedor-cotizaciones";
import type { DatoConFecha } from "../../proveedores/http/proveedor-http-base";
import type {
  ProveedorDolarActual,
  ProveedorDolarHistorico,
  PuntoDolar,
} from "../../proveedores/dolar/proveedor-dolar";
import type { InstrumentoCatalogado, PrecioManual } from "../instrumentos";
import { INTERVALO_ACTUALIZACION_MS, type HorarioMercado } from "./horario-mercado";

export interface FuentePreciosManuales {
  preciosManuales(usuarioId: string, ids: readonly string[]): Promise<Map<string, PrecioManual>>;
}

export interface PreciosDelMercado {
  precios: Map<string, PrecioVigente>;
  datosDe: Date | null;
  desactualizado: boolean;
}

export interface DolarVigente {
  tipo: TipoDolar;
  valor: Decimal;
  actualizadoEn: Date;
  desactualizado: boolean;
}

export interface HistoricoActivo {
  disponible: boolean;
  moneda: Moneda;
  puntos: PuntoHistorico[];
}

/** Último valor con fecha menor o igual a la pedida (la serie viene ordenada por fecha). */
function ultimoHasta(serie: readonly PuntoDolar[], fecha: string): PuntoDolar | undefined {
  let encontrado: PuntoDolar | undefined;
  for (const punto of serie) {
    if (punto.fecha > fecha) break;
    encontrado = punto;
  }
  return encontrado;
}

export class MercadoServicio {
  constructor(
    private readonly cotizaciones: ProveedorCotizaciones,
    private readonly dolarActual: ProveedorDolarActual,
    private readonly dolarHistorico: ProveedorDolarHistorico,
    private readonly horario: HorarioMercado,
    private readonly manuales: FuentePreciosManuales,
    private readonly zonaHoraria: string,
    private readonly ahora: () => Date,
  ) {}

  /** Precio de cada instrumento: el de mercado; si no hay, el que cargó el usuario. */
  async precios(
    usuarioId: string,
    instrumentos: readonly InstrumentoCatalogado[],
  ): Promise<PreciosDelMercado> {
    const listas = await this.listasSinFallar();
    const porSimbolo = new Map<string, FilaMercado>();
    if (listas) {
      for (const filas of Object.values(listas.valor)) {
        for (const fila of filas) porSimbolo.set(fila.simbolo, fila);
      }
    }
    const manuales = await this.manuales.preciosManuales(
      usuarioId,
      instrumentos.map((i) => i.id),
    );
    const precios = new Map<string, PrecioVigente>();
    for (const instrumento of instrumentos) {
      const deMercado = listas ? this.deMercado(instrumento, porSimbolo, listas) : null;
      const manual = manuales.get(instrumento.id);
      if (deMercado) precios.set(instrumento.id, deMercado);
      else if (manual) {
        precios.set(instrumento.id, {
          porMoneda: { [manual.moneda]: manual.precio },
          variacionPct: null,
          fuente: "MANUAL",
          actualizadoEn: manual.cargadoEn,
          desactualizado: false,
        });
      }
    }
    return {
      precios,
      datosDe: listas?.obtenidoEn ?? null,
      desactualizado: !listas || listas.desactualizado,
    };
  }

  async dolarVigente(tipo: TipoDolar): Promise<DolarVigente> {
    try {
      const actuales = await this.dolarActual.actuales();
      const cotizacion = actuales.valor.find((c) => c.tipo === tipo);
      if (cotizacion) {
        return {
          tipo,
          valor: cotizacion.venta,
          actualizadoEn: cotizacion.actualizadoEn,
          desactualizado: actuales.desactualizado,
        };
      }
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
    }
    const ultimo = (await this.serieDolar(tipo)).at(-1);
    if (!ultimo) {
      throw new ErrorProveedorExterno(
        "No pudimos obtener el valor del dólar para convertir tu cartera. Probá de nuevo en unos minutos.",
      );
    }
    return {
      tipo,
      valor: ultimo.venta,
      actualizadoEn: aFechaDia(ultimo.fecha),
      desactualizado: true,
    };
  }

  /** Dólar de un día: hoy, el vigente; antes, el último cierre hasta ese día. */
  async dolarEnFecha(tipo: TipoDolar, fecha: string): Promise<Decimal> {
    const mensaje = `No tenemos el valor del dólar para el ${formatoFechaCorta(aFechaDia(fecha))}. Cargá el tipo de cambio a mano.`;
    if (fecha >= hoyEn(this.zonaHoraria, this.ahora())) {
      try {
        return (await this.dolarVigente(tipo)).valor;
      } catch (error) {
        if (!(error instanceof ErrorProveedorExterno)) throw error;
        throw new ErrorValidacion(mensaje, [{ campo: "tipoCambio", mensaje }]);
      }
    }
    let serie: PuntoDolar[];
    try {
      serie = await this.serieDolar(tipo);
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
      throw new ErrorValidacion(mensaje, [{ campo: "tipoCambio", mensaje }]);
    }
    const punto = ultimoHasta(serie, fecha);
    if (!punto) throw new ErrorValidacion(mensaje, [{ campo: "tipoCambio", mensaje }]);
    return punto.venta;
  }

  async estado(datos: {
    datosDe: Date | null;
    desactualizado: boolean;
  }): Promise<EstadoMercadoDto> {
    const abierto = await this.horario.estaAbierto();
    return {
      abierto,
      proximaActualizacionEn: abierto
        ? new Date(this.ahora().getTime() + INTERVALO_ACTUALIZACION_MS).toISOString()
        : null,
      datosDe: datos.datosDe?.toISOString() ?? null,
      desactualizado: datos.desactualizado,
      mensaje: this.mensajeEstado(abierto, datos.datosDe, datos.desactualizado),
    };
  }

  /** Pide precios y dólar ignorando la caché (botón "Actualizar precios"). */
  async actualizar(): Promise<EstadoMercadoDto> {
    const listas = await this.listasSinFallar(true);
    try {
      await this.dolarActual.actuales(true);
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
    }
    return this.estado({
      datosDe: listas?.obtenidoEn ?? null,
      desactualizado: !listas || listas.desactualizado,
    });
  }

  /**
   * Cierres diarios del activo. data912 tiene acciones y CEDEARs solo en pesos, bonos en pesos
   * o dólares, y no tiene ONs ni letras. Una serie en pesos se pasa a dólares con el dólar de cada día.
   */
  async historico(
    instrumento: InstrumentoCatalogado,
    moneda: Moneda,
    tipoDolar: TipoDolar,
  ): Promise<HistoricoActivo> {
    const sinHistorico: HistoricoActivo = { disponible: false, moneda, puntos: [] };
    const familia = instrumento.familia;
    if (!familia || familia === "OBLIGACIONES" || familia === "LETRAS") return sinHistorico;
    const propio = familia === "BONOS" ? instrumento.simbolos[moneda] : undefined;
    const simbolo = propio ?? instrumento.simbolos.ARS;
    if (!simbolo) return sinHistorico;
    let puntos: PuntoHistorico[];
    try {
      puntos = (await this.cotizaciones.historico(familia, simbolo)).valor;
    } catch (error) {
      if (error instanceof ErrorProveedorExterno) return sinHistorico;
      throw error;
    }
    if (puntos.length === 0) return sinHistorico;
    const enPesos = !propio;
    if (!enPesos || moneda === "ARS") {
      return { disponible: true, moneda: propio ? moneda : "ARS", puntos };
    }
    return this.pasarADolares(puntos, moneda, tipoDolar);
  }

  private async pasarADolares(
    puntos: readonly PuntoHistorico[],
    moneda: Moneda,
    tipoDolar: TipoDolar,
  ): Promise<HistoricoActivo> {
    let serie: PuntoDolar[];
    try {
      serie = await this.serieDolar(tipoDolar);
    } catch (error) {
      if (error instanceof ErrorProveedorExterno)
        return { disponible: true, moneda: "ARS", puntos: [...puntos] };
      throw error;
    }
    const convertidos: PuntoHistorico[] = [];
    for (const punto of puntos) {
      const dolar = ultimoHasta(serie, punto.fecha);
      if (dolar) convertidos.push({ fecha: punto.fecha, cierre: punto.cierre.div(dolar.venta) });
    }
    return { disponible: convertidos.length > 0, moneda, puntos: convertidos };
  }

  private deMercado(
    instrumento: InstrumentoCatalogado,
    porSimbolo: ReadonlyMap<string, FilaMercado>,
    listas: DatoConFecha<ListasMercado>,
  ): PrecioVigente | null {
    const porMoneda: Partial<Record<Moneda, Decimal>> = {};
    let variacionPct: Decimal | null = null;
    for (const [moneda, simbolo] of Object.entries(instrumento.simbolos) as [Moneda, string][]) {
      const fila = porSimbolo.get(simbolo);
      if (!fila) continue;
      porMoneda[moneda] = fila.precio;
      if (moneda === "ARS" || variacionPct === null)
        variacionPct = fila.variacionPct ?? variacionPct;
    }
    if (Object.keys(porMoneda).length === 0) return null;
    return {
      porMoneda,
      variacionPct,
      fuente: "MERCADO",
      actualizadoEn: listas.obtenidoEn,
      desactualizado: listas.desactualizado,
    };
  }

  private async listasSinFallar(forzar = false): Promise<DatoConFecha<ListasMercado> | null> {
    try {
      return await this.cotizaciones.listas(forzar);
    } catch (error) {
      if (error instanceof ErrorProveedorExterno) return null;
      throw error;
    }
  }

  private async serieDolar(tipo: TipoDolar): Promise<PuntoDolar[]> {
    return (await this.dolarHistorico.historico(tipo)).valor;
  }

  private mensajeEstado(abierto: boolean, datosDe: Date | null, desactualizado: boolean): string {
    if (desactualizado && !datosDe) {
      return "No pudimos obtener los precios del mercado. Se usan los precios que cargaste a mano o, si no hay, lo que pagaste.";
    }
    if (desactualizado && datosDe) {
      const hora = new Intl.DateTimeFormat("es-AR", {
        timeZone: this.zonaHoraria,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(datosDe);
      const dia = fechaCortaEn(this.zonaHoraria, datosDe, false);
      return `No pudimos actualizar los precios. Mostramos los de las ${hora} del ${dia}.`;
    }
    return abierto
      ? "El mercado está abierto. Los precios se actualizan solos cada minuto."
      : "El mercado está cerrado. Mostramos los últimos precios disponibles.";
  }
}
