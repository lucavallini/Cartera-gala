import type { Moneda, TipoDolar } from "./comunes";
import type { InstrumentoDto, TipoInstrumento } from "./instrumentos";
import type { EstadoMercadoDto } from "./mercado";
import type { OperacionDto, TipoOperacion } from "./operaciones";

/** Moneda en la que se muestran los totales. */
export type MonedaVista = "ARS" | "USD";

export type ClaveTarjeta =
  | "valorActual"
  | "invertido"
  | "noRealizado"
  | "realizado"
  | "cobros"
  | "rendimiento"
  | "variacionDiaria";

export type Tono = "positivo" | "negativo" | "neutro";

export interface TarjetaDto {
  clave: ClaveTarjeta;
  titulo: string;
  /** Qué significa el número, en lenguaje llano. */
  explicacion: string;
  valor: number;
  porcentaje: number | null;
  tono: Tono;
}

export type FuentePrecioDto = "MERCADO" | "MANUAL" | "COSTO" | "DEVENGADO";

export interface TenenciaDto {
  instrumentoId: string;
  ticker: string;
  nombre: string | null;
  tipo: TipoInstrumento;
  tipoTexto: string;
  cantidad: number;
  /** Moneda en la que el usuario opera este activo: la de precios promedio y actual. */
  monedaPrecio: Moneda;
  monedaPrecioTexto: string;
  precioPromedio: number | null;
  precioActual: number | null;
  variacionDiariaPct: number | null;
  /** En la moneda de la vista. */
  valor: number;
  invertido: number;
  resultado: number;
  resultadoPct: number | null;
  realizado: number;
  cobros: number;
  /** Porcentaje de la cartera. */
  peso: number;
  sinCotizacion: boolean;
  fuentePrecio: FuentePrecioDto;
  explicacionPrecio: string;
}

export interface PesoDto {
  clave: string;
  etiqueta: string;
  valor: number;
  porcentaje: number;
}

export interface EfectivoDto {
  valor: number;
  detalle: { moneda: Moneda; monedaTexto: string; monto: number }[];
}

export interface DolarDto {
  tipo: TipoDolar;
  valor: number;
  actualizadoEn: string;
  desactualizado: boolean;
}

export interface ResumenDto {
  moneda: MonedaVista;
  /** null = todas las carteras activas. */
  carteraId: string | null;
  vacio: boolean;
  frase: string;
  tarjetas: TarjetaDto[];
  tenencias: TenenciaDto[];
  ponderaciones: { porActivo: PesoDto[]; porTipo: PesoDto[] };
  efectivo: EfectivoDto | null;
  /** null solo si la cartera está vacía y no se pudo obtener el dólar (no hace falta para nada). */
  dolar: DolarDto | null;
  mercado: EstadoMercadoDto;
  avisos: string[];
}

export interface PuntoHistoricoDto {
  fecha: string;
  cierre: number;
}

export interface MarcaOperacionDto {
  fecha: string;
  tipo: TipoOperacion;
  tipoTexto: string;
  cantidad: number | null;
  precio: number | null;
}

export interface HistoricoActivoDto {
  disponible: boolean;
  /** Por qué no hay historial, en lenguaje llano. */
  mensaje: string | null;
  moneda: Moneda;
  monedaTexto: string;
  puntos: PuntoHistoricoDto[];
  marcas: MarcaOperacionDto[];
}

/** Lo que ganó o perdió el usuario con este activo, tenga o no tenencia hoy. */
export interface ResultadoActivoDto {
  realizado: number;
  cobros: number;
  /** Explicación en lenguaje llano, por ejemplo "Con las ventas ganaste US$ 25 y cobraste US$ 5 en dividendos y rentas." */
  explicacion: string;
}

export interface ActivoDto {
  instrumento: InstrumentoDto;
  tenencia: TenenciaDto | null;
  resultado: ResultadoActivoDto;
  operaciones: OperacionDto[];
  historico: HistoricoActivoDto;
}
