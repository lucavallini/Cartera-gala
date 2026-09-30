import type { EstrategiaCosto } from "./costo/estrategia-costo";
import type { RegistroManejadores } from "./operaciones/registro-manejadores";
import { crearEstadoVacio } from "./posicion";
import type { EstadoCartera, OperacionMotor } from "./tipos";

/** El mismo día, la tenencia inicial va primero: es lo que se tenía antes de operar. */
function prioridad(operacion: OperacionMotor): number {
  return operacion.tipo === "TENENCIA_INICIAL" ? 0 : 1;
}

export function ordenarOperaciones(operaciones: readonly OperacionMotor[]): OperacionMotor[] {
  return [...operaciones].sort(
    (a, b) =>
      a.fecha.getTime() - b.fecha.getTime() ||
      prioridad(a) - prioridad(b) ||
      a.secuencia - b.secuencia,
  );
}

/** Estado de la cartera después de aplicar toda la historia, en orden. */
export function reconstruir(
  operaciones: readonly OperacionMotor[],
  estrategia: EstrategiaCosto,
  registro: RegistroManejadores,
): EstadoCartera {
  const estado = crearEstadoVacio();
  for (const operacion of ordenarOperaciones(operaciones)) {
    registro.obtener(operacion.tipo).aplicar(estado, operacion, { estrategia });
  }
  return estado;
}
