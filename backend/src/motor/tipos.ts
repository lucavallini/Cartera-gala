import type { Moneda, TipoOperacion } from "@cartera/contratos";
import type { Decimal } from "../compartido/decimal";

/** Un mismo valor expresado en pesos y en dólares (al dólar de referencia del usuario). */
export interface Importe {
  readonly ars: Decimal;
  readonly usd: Decimal;
}

/** Operación lista para calcular: sin Prisma, con todos los números como Decimal. */
export interface OperacionMotor {
  id: string;
  tipo: TipoOperacion;
  fecha: Date;
  /** Desempata operaciones del mismo día: el orden en que se cargaron. */
  secuencia: number;
  carteraId: string;
  cuentaId: string | null;
  instrumentoId: string | null;
  ticker: string | null;
  cantidad: Decimal | null;
  precio: Decimal | null;
  moneda: Moneda;
  /** Pesos por dólar de referencia en la fecha de la operación. */
  tipoCambio: Decimal;
  /** Comisión + derechos de mercado + IVA + otros gastos, en la moneda de la operación. */
  gastos: Decimal;
  /** Importe de las operaciones sin precio: cobros, depósitos, extracciones, comisiones. */
  monto: Decimal | null;
  /** 0,01 en renta fija (cotiza cada 100 nominales), 1 en el resto. */
  factorPrecio: Decimal;
}

/** Una compra (o tenencia inicial) que todavía no se vendió del todo. */
export interface Lote {
  operacionId: string;
  fecha: Date;
  cantidad: Decimal;
  /** Costo total del lote, gastos incluidos. */
  costo: Importe;
}

/** Tenencia de un activo en una cartera y cuenta. */
export interface Posicion {
  clave: string;
  carteraId: string;
  instrumentoId: string;
  ticker: string;
  cuentaId: string | null;
  lotes: Lote[];
  realizado: Importe;
  cobros: Importe;
  /** Todo lo que se pagó alguna vez por este activo: base del rendimiento. */
  costoHistorico: Importe;
  /** Moneda en la que el usuario opera este activo (la de su última compra). */
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
}

export interface EstadoCartera {
  posiciones: Map<string, Posicion>;
  efectivo: Map<Moneda, Decimal>;
  aportesNetos: Importe;
  comisionesSueltas: Importe;
  /** El efectivo solo se muestra si el usuario registró depósitos o extracciones. */
  registraEfectivo: boolean;
}

export interface PrecioVigente {
  porMoneda: Partial<Record<Moneda, Decimal>>;
  variacionPct: Decimal | null;
  fuente: "MERCADO" | "MANUAL";
  actualizadoEn: Date;
  desactualizado: boolean;
}
