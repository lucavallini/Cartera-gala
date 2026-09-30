import type { Moneda } from "@cartera/contratos";
import type { Decimal } from "../compartido/decimal";
import { ErrorApp } from "../compartido/errores";
import type { EstrategiaCosto } from "./costo/estrategia-costo";
import type { RegistroManejadores } from "./operaciones/registro-manejadores";
import { cantidadDe, claveDePosicion, costoDe } from "./posicion";
import { reconstruir } from "./tenencia";
import type { EstadoCartera, Importe, OperacionMotor } from "./tipos";

/** Reexportado desde `posicion.ts`, donde vive junto al resto de los cálculos de posición. */
export { precioPromedio } from "./posicion";

export type CambioSimulado =
  { accion: "crear" | "editar"; operacion: OperacionMotor } | { accion: "borrar"; id: string };

export interface FotoPosicion {
  ticker: string;
  cantidad: Decimal;
  costo: Importe;
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
}

export type ResultadoSimulacion =
  | { valida: true; antes: FotoPosicion | null; despues: FotoPosicion | null }
  | { valida: false; mensaje: string };

export function aplicarCambio(
  operaciones: readonly OperacionMotor[],
  cambio: CambioSimulado,
): OperacionMotor[] {
  switch (cambio.accion) {
    case "crear":
      return [...operaciones, cambio.operacion];
    case "editar":
      return operaciones.map((op) => (op.id === cambio.operacion.id ? cambio.operacion : op));
    case "borrar":
      return operaciones.filter((op) => op.id !== cambio.id);
  }
}

function claveAfectada(
  operaciones: readonly OperacionMotor[],
  cambio: CambioSimulado,
): string | null {
  const operacion =
    cambio.accion === "borrar" ? operaciones.find((op) => op.id === cambio.id) : cambio.operacion;
  if (!operacion?.instrumentoId) return null;
  return claveDePosicion(operacion.carteraId, operacion.instrumentoId, operacion.cuentaId);
}

function foto(estado: EstadoCartera, clave: string): FotoPosicion | null {
  const posicion = estado.posiciones.get(clave);
  if (!posicion) return null;
  return {
    ticker: posicion.ticker,
    cantidad: cantidadDe(posicion),
    costo: costoDe(posicion),
    monedaPrecio: posicion.monedaPrecio,
    factorPrecio: posicion.factorPrecio,
  };
}

/** Qué pasaría con la posición afectada. Si el cambio deja la historia inválida, dice por qué. */
export function simular(
  operaciones: readonly OperacionMotor[],
  cambio: CambioSimulado,
  estrategia: EstrategiaCosto,
  registro: RegistroManejadores,
): ResultadoSimulacion {
  const clave = claveAfectada(operaciones, cambio);
  let despues: EstadoCartera;
  try {
    despues = reconstruir(aplicarCambio(operaciones, cambio), estrategia, registro);
  } catch (error) {
    if (error instanceof ErrorApp) return { valida: false, mensaje: error.message };
    throw error;
  }
  if (!clave) return { valida: true, antes: null, despues: null };
  const antes = reconstruir(operaciones, estrategia, registro);
  return { valida: true, antes: foto(antes, clave), despues: foto(despues, clave) };
}
