import { CIEN, type Decimal } from "../compartido/decimal";
import { IMPORTE_CERO, importeDe, restar, sumar, sumarTodos } from "./importe";
import { costoDe } from "./posicion";
import type { EstadoCartera, Importe, Posicion } from "./tipos";
import type { ValuacionPosicion } from "./valuadores/valuador";

export interface PosicionValuada {
  posicion: Posicion;
  valuacion: ValuacionPosicion;
}

export interface PorcentajeDoble {
  ars: Decimal | null;
  usd: Decimal | null;
}

export interface TotalesCartera {
  /** Todo: posiciones más efectivo (si se registra). */
  valor: Importe;
  valorPosiciones: Importe;
  /** Lo que se pagó por lo que se tiene hoy. */
  invertido: Importe;
  noRealizado: Importe;
  realizado: Importe;
  cobros: Importe;
  comisionesSueltas: Importe;
  resultadoTotal: Importe;
  /** Todo lo que se pagó alguna vez: base del rendimiento. */
  costoHistorico: Importe;
  rendimientoPct: PorcentajeDoble;
  variacionDiaria: Importe;
  variacionDiariaPct: PorcentajeDoble;
  efectivo: Importe | null;
}

function porcentaje(parte: Importe, base: Importe): PorcentajeDoble {
  return {
    ars: base.ars.isZero() ? null : parte.ars.div(base.ars).mul(CIEN),
    usd: base.usd.isZero() ? null : parte.usd.div(base.usd).mul(CIEN),
  };
}

/** Parte del valor actual que cambió hoy: valor − valor / (1 + variación%). */
function variacionDelDia(valuadas: readonly PosicionValuada[]): Importe {
  return sumarTodos(
    valuadas.flatMap(({ valuacion }) => {
      const pct = valuacion.variacionPct;
      if (!pct || valuacion.sinCotizacion) return [];
      const divisor = pct.div(CIEN).plus(1);
      if (divisor.lte(0)) return [];
      const valor = valuacion.valor;
      return [restar(valor, { ars: valor.ars.div(divisor), usd: valor.usd.div(divisor) })];
    }),
  );
}

function efectivoComoImporte(estado: EstadoCartera, dolar: Decimal): Importe {
  let total = IMPORTE_CERO;
  for (const [moneda, monto] of estado.efectivo)
    total = sumar(total, importeDe(monto, moneda, dolar));
  return total;
}

export function totalizar(
  valuadas: readonly PosicionValuada[],
  estado: EstadoCartera,
  dolar: Decimal,
): TotalesCartera {
  const posiciones = [...estado.posiciones.values()];
  const valorPosiciones = sumarTodos(valuadas.map((v) => v.valuacion.valor));
  const invertido = sumarTodos(valuadas.map((v) => costoDe(v.posicion)));
  const noRealizado = restar(valorPosiciones, invertido);
  const realizado = sumarTodos(posiciones.map((p) => p.realizado));
  const cobros = sumarTodos(posiciones.map((p) => p.cobros));
  const costoHistorico = sumarTodos(posiciones.map((p) => p.costoHistorico));
  const efectivo = estado.registraEfectivo ? efectivoComoImporte(estado, dolar) : null;
  const resultadoTotal = restar(
    sumar(sumar(noRealizado, realizado), cobros),
    estado.comisionesSueltas,
  );
  const variacionDiaria = variacionDelDia(valuadas);
  return {
    valor: efectivo ? sumar(valorPosiciones, efectivo) : valorPosiciones,
    valorPosiciones,
    invertido,
    noRealizado,
    realizado,
    cobros,
    comisionesSueltas: estado.comisionesSueltas,
    resultadoTotal,
    costoHistorico,
    rendimientoPct: porcentaje(resultadoTotal, costoHistorico),
    variacionDiaria,
    variacionDiariaPct: porcentaje(variacionDiaria, restar(valorPosiciones, variacionDiaria)),
    efectivo,
  };
}
