import type { Moneda, TipoOperacion } from "@cartera/contratos";
import { CERO, type Decimal } from "../../compartido/decimal";
import { ErrorValidacion } from "../../compartido/errores";
import { formatoFechaCorta } from "../../compartido/fechas";
import type { EstrategiaCosto } from "../costo/estrategia-costo";
import { IMPORTE_CERO } from "../importe";
import { claveDePosicion } from "../posicion";
import type { EstadoCartera, OperacionMotor, Posicion } from "../tipos";

export interface ContextoAplicacion {
  estrategia: EstrategiaCosto;
}

/** Cada tipo de operación sabe cómo cambia la cartera. Sin I/O: solo modifica el estado. */
export abstract class ManejadorOperacion {
  abstract readonly tipo: TipoOperacion;
  /** Qué registra este tipo, en lenguaje llano (lo muestra el formulario). */
  abstract readonly descripcion: string;

  abstract aplicar(
    estado: EstadoCartera,
    operacion: OperacionMotor,
    contexto: ContextoAplicacion,
  ): void;

  protected requerir(valor: Decimal | null, dato: string, operacion: OperacionMotor): Decimal {
    if (valor === null) {
      throw new ErrorValidacion(
        `Falta ${dato} en la operación del ${formatoFechaCorta(operacion.fecha)}.`,
      );
    }
    return valor;
  }

  protected posicionExistente(
    estado: EstadoCartera,
    operacion: OperacionMotor,
  ): Posicion | undefined {
    if (!operacion.instrumentoId) return undefined;
    return estado.posiciones.get(
      claveDePosicion(operacion.carteraId, operacion.instrumentoId, operacion.cuentaId),
    );
  }

  protected posicion(estado: EstadoCartera, operacion: OperacionMotor): Posicion {
    if (!operacion.instrumentoId || !operacion.ticker) {
      throw new ErrorValidacion(
        `Falta el activo en la operación del ${formatoFechaCorta(operacion.fecha)}.`,
      );
    }
    const existente = this.posicionExistente(estado, operacion);
    if (existente) return existente;
    const nueva: Posicion = {
      clave: claveDePosicion(operacion.carteraId, operacion.instrumentoId, operacion.cuentaId),
      carteraId: operacion.carteraId,
      instrumentoId: operacion.instrumentoId,
      ticker: operacion.ticker,
      cuentaId: operacion.cuentaId,
      lotes: [],
      realizado: IMPORTE_CERO,
      cobros: IMPORTE_CERO,
      costoHistorico: IMPORTE_CERO,
      monedaPrecio: operacion.moneda,
      factorPrecio: operacion.factorPrecio,
    };
    estado.posiciones.set(nueva.clave, nueva);
    return nueva;
  }

  protected moverEfectivo(estado: EstadoCartera, moneda: Moneda, delta: Decimal): void {
    estado.efectivo.set(moneda, (estado.efectivo.get(moneda) ?? CERO).plus(delta));
  }
}
