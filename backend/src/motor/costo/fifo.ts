import type { Decimal } from "../../compartido/decimal";
import { IMPORTE_CERO, cuantizarImporte, escalar, restar, sumar } from "../importe";
import type { Lote } from "../tipos";
import type { EstrategiaCosto, ResultadoConsumo } from "./estrategia-costo";

/** Se vende primero lo que se compró primero. */
export class Fifo implements EstrategiaCosto {
  readonly metodo = "FIFO" as const;

  consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo {
    let pendiente = cantidad;
    let costoConsumido = IMPORTE_CERO;
    const restantes: Lote[] = [];
    for (const lote of lotes) {
      if (pendiente.lte(0)) {
        restantes.push(lote);
        continue;
      }
      const tomada = pendiente.lt(lote.cantidad) ? pendiente : lote.cantidad;
      const queda = lote.cantidad.minus(tomada);
      // El costo tomado de un lote parcial se cuantiza: sin eso, la precisión alta arrastra una
      // expansión larga que después no cierra exacta al restarla del lote.
      const costoTomado = queda.gt(0)
        ? cuantizarImporte(escalar(lote.costo, tomada.div(lote.cantidad)))
        : lote.costo;
      costoConsumido = sumar(costoConsumido, costoTomado);
      pendiente = pendiente.minus(tomada);
      if (queda.gt(0)) {
        // Lo que queda del lote, por resta exacta: cantidad y costo cierran con lo consumido.
        restantes.push({ ...lote, cantidad: queda, costo: restar(lote.costo, costoTomado) });
      }
    }
    return { restantes, costoConsumido };
  }
}
