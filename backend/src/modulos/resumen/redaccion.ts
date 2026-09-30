import type { MonedaVista } from "@cartera/contratos";
import { formatearMonedaAbreviada, formatearPorcentaje } from "../../compartido/formato";
import { enMoneda } from "../../motor/importe";
import type { PorcentajeDoble, TotalesCartera } from "../../motor/totales";

function porcentajeDe(valor: PorcentajeDoble, vista: MonedaVista) {
  return vista === "ARS" ? valor.ars : valor.usd;
}

/** "Tu cartera vale US$ 48.320 (≈ $ 74,9 M). Desde que empezaste ganaste … Hoy bajó 0,4%." */
export function redactarFrase(
  totales: TotalesCartera,
  vista: MonedaVista,
  mercadoAbierto: boolean,
  vacio: boolean,
): string {
  if (vacio) return "Todavía no cargaste activos. Empezá con «Agregar activo que ya tengo».";
  const otra: MonedaVista = vista === "USD" ? "ARS" : "USD";
  const partes = [
    `Tu cartera vale ${formatearMonedaAbreviada(enMoneda(totales.valor, vista), vista)} ` +
      `(≈ ${formatearMonedaAbreviada(enMoneda(totales.valor, otra), otra)}).`,
  ];
  const resultado = enMoneda(totales.resultadoTotal, vista);
  const rendimiento = porcentajeDe(totales.rendimientoPct, vista);
  partes.push(
    `Desde que empezaste ${resultado.gte(0) ? "ganaste" : "perdiste"} ` +
      `${formatearMonedaAbreviada(resultado.abs(), vista)}` +
      `${rendimiento ? ` (${formatearPorcentaje(rendimiento)})` : ""}.`,
  );
  const variacion = porcentajeDe(totales.variacionDiariaPct, vista);
  if (variacion) {
    const cuando = mercadoAbierto ? "Hoy" : "En la última rueda";
    const verbo = variacion.gt(0) ? "subió" : variacion.lt(0) ? "bajó" : "no cambió";
    const cuanto = variacion.isZero() ? "" : ` ${formatearPorcentaje(variacion.abs(), false)}`;
    partes.push(`${cuando} ${verbo}${cuanto}.`);
  }
  return partes.join(" ");
}
