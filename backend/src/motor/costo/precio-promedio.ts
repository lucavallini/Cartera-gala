import { CERO, cuantizar, type Decimal } from "../../compartido/decimal";
import { cuantizarImporte, escalar, restar, sumarTodos } from "../importe";
import type { Lote } from "../tipos";
import type { EstrategiaCosto, ResultadoConsumo } from "./estrategia-costo";

/** Cada unidad vendida cuesta el promedio de todas: todos los lotes bajan en la misma proporción. */
export class PrecioPromedio implements EstrategiaCosto {
  readonly metodo = "PRECIO_PROMEDIO" as const;

  consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo {
    const total = lotes.reduce((suma, lote) => suma.plus(lote.cantidad), CERO);
    const costoTotal = sumarTodos(lotes.map((lote) => lote.costo));
    // Lo que queda se calcula restando, sin redondeos: así una venta posterior de todo cierra en cero.
    const restanteCantidad = total.minus(cantidad);
    if (restanteCantidad.lte(0)) return { costoConsumido: costoTotal, restantes: [] };
    // Consumido y cada lote (salvo el último) se cuantizan a 12 decimales: sin eso, la precisión
    // alta arrastra expansiones largas (p. ej. ×503/511) que nunca cierran justo al vender todo.
    const costoConsumido = cuantizarImporte(escalar(costoTotal, cantidad.div(total)));
    const costoRestante = restar(costoTotal, costoConsumido);
    const queda = restanteCantidad.div(total);
    const anteriores = lotes.slice(0, -1).map((lote) => ({
      ...lote,
      cantidad: cuantizar(lote.cantidad.mul(queda)),
      costo: cuantizarImporte(escalar(lote.costo, queda)),
    }));
    const ultimoOriginal = lotes.at(-1);
    const restantes = ultimoOriginal
      ? [
          ...anteriores,
          {
            ...ultimoOriginal,
            // El último lote absorbe la diferencia por resta exacta: cantidad y costo cierran
            // justo con lo que queda, sin redondeo suelto.
            cantidad: restanteCantidad.minus(
              anteriores.reduce((suma, lote) => suma.plus(lote.cantidad), CERO),
            ),
            costo: restar(costoRestante, sumarTodos(anteriores.map((lote) => lote.costo))),
          },
        ]
      : anteriores;
    // Un lote minúsculo puede truncarse a cantidad 0: se descarta sin afectar las sumas ya hechas
    // (un lote en 0 no aporta nada a ellas).
    return { costoConsumido, restantes: restantes.filter((lote) => lote.cantidad.gt(0)) };
  }
}
