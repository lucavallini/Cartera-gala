import type { Instrumento, Operacion } from "../../generado/prisma/client";
import { CERO, Decimal, aDecimal } from "../../compartido/decimal";
import type { OperacionMotor } from "../../motor/tipos";

export type OperacionConInstrumento = Operacion & { instrumento: Instrumento | null };

function decimalONulo(valor: { toString(): string } | null): Decimal | null {
  return valor === null ? null : aDecimal(valor);
}

/** Lo que hace falta para sumar los gastos: una operación guardada o sus campos ya validados. */
export interface ConGastos {
  comision: { toString(): string };
  derechosMercado: { toString(): string };
  iva: { toString(): string };
  otrosGastos: { toString(): string };
}

export function gastosDe(operacion: ConGastos): Decimal {
  return [
    operacion.comision,
    operacion.derechosMercado,
    operacion.iva,
    operacion.otrosGastos,
  ].reduce<Decimal>((total, gasto) => total.plus(aDecimal(gasto)), CERO);
}

export function aOperacionMotor(operacion: OperacionConInstrumento): OperacionMotor {
  return {
    id: operacion.id,
    tipo: operacion.tipo,
    fecha: operacion.fechaConcertacion,
    secuencia: operacion.creadoEn.getTime(),
    carteraId: operacion.carteraId,
    cuentaId: operacion.cuentaId,
    instrumentoId: operacion.instrumentoId,
    ticker: operacion.instrumento?.ticker ?? null,
    cantidad: decimalONulo(operacion.cantidad),
    precio: decimalONulo(operacion.precio),
    moneda: operacion.moneda,
    // Siempre se completa al guardar; el 1 solo protege de una fila cargada a mano en la base.
    tipoCambio: operacion.tipoCambio ? aDecimal(operacion.tipoCambio) : new Decimal(1),
    gastos: gastosDe(operacion),
    monto: decimalONulo(operacion.montoNeto),
    factorPrecio: operacion.instrumento
      ? aDecimal(operacion.instrumento.factorPrecio)
      : new Decimal(1),
  };
}
