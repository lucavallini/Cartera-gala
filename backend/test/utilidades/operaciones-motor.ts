import type { Moneda, TipoOperacion } from "@cartera/contratos";
import { Decimal } from "../../src/compartido/decimal";
import type { OperacionMotor } from "../../src/motor/tipos";

export const d = (valor: string | number) => new Decimal(valor);

let secuencia = 0;

export interface DatosOperacionPrueba {
  id?: string;
  fecha?: string;
  carteraId?: string;
  cuentaId?: string | null;
  instrumentoId?: string | null;
  ticker?: string | null;
  cantidad?: number | string;
  precio?: number | string;
  monto?: number | string;
  moneda?: Moneda;
  tipoCambio?: number | string;
  gastos?: number | string;
  factorPrecio?: number | string;
}

/** Operación de prueba: por defecto AMZN, en pesos, cartera "c1", dólar a 1000. */
export function crearOperacion(
  tipo: TipoOperacion,
  datos: DatosOperacionPrueba = {},
): OperacionMotor {
  secuencia += 1;
  const opcional = (valor: number | string | undefined) => (valor === undefined ? null : d(valor));
  return {
    id: datos.id ?? `op-${secuencia}`,
    tipo,
    fecha: new Date(`${datos.fecha ?? "2026-01-10"}T00:00:00.000Z`),
    secuencia,
    carteraId: datos.carteraId ?? "c1",
    cuentaId: datos.cuentaId ?? null,
    instrumentoId: datos.instrumentoId === undefined ? "i-amzn" : datos.instrumentoId,
    ticker: datos.ticker === undefined ? "AMZN" : datos.ticker,
    cantidad: opcional(datos.cantidad),
    precio: opcional(datos.precio),
    monto: opcional(datos.monto),
    moneda: datos.moneda ?? "ARS",
    tipoCambio: d(datos.tipoCambio ?? 1000),
    gastos: d(datos.gastos ?? 0),
    factorPrecio: d(datos.factorPrecio ?? 1),
  };
}
