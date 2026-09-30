import { CERO, Decimal } from "../../compartido/decimal";
import { ErrorValidacion } from "../../compartido/errores";
import { formatoFechaCorta } from "../../compartido/fechas";
import { DECIMALES_CANTIDAD, formatearNumero } from "../../compartido/formato";
import { escalar, importeDe, restar, sumar } from "../importe";
import { cantidadDe, costoDe } from "../posicion";
import type { EstadoCartera, OperacionMotor } from "../tipos";
import { ManejadorOperacion, type ContextoAplicacion } from "./manejador-operacion";

const UNO = new Decimal(1);

function bruto(operacion: OperacionMotor, cantidad: Decimal, precio: Decimal): Decimal {
  return cantidad.mul(precio).mul(operacion.factorPrecio);
}

/** Alta de tenencia: agrega un lote con su costo (gastos incluidos). */
abstract class ManejadorAlta extends ManejadorOperacion {
  protected abstract readonly pagaConEfectivo: boolean;

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const cantidad = this.requerir(operacion.cantidad, "la cantidad", operacion);
    const precio = this.requerir(operacion.precio, "el precio", operacion);
    const pagado = bruto(operacion, cantidad, precio).plus(operacion.gastos);
    const costo = importeDe(pagado, operacion.moneda, operacion.tipoCambio);
    const posicion = this.posicion(estado, operacion);
    posicion.lotes.push({ operacionId: operacion.id, fecha: operacion.fecha, cantidad, costo });
    posicion.costoHistorico = sumar(posicion.costoHistorico, costo);
    posicion.monedaPrecio = operacion.moneda;
    posicion.factorPrecio = operacion.factorPrecio;
    if (this.pagaConEfectivo) this.moverEfectivo(estado, operacion.moneda, pagado.neg());
  }
}

export class TenenciaInicialManejador extends ManejadorAlta {
  readonly tipo = "TENENCIA_INICIAL" as const;
  readonly descripcion =
    "Un activo que ya tenías, con su cantidad y su precio promedio de compra. No mueve efectivo.";
  protected readonly pagaConEfectivo = false;
}

export class CompraManejador extends ManejadorAlta {
  readonly tipo = "COMPRA" as const;
  readonly descripcion = "Una compra nueva: suma a tu tenencia y descuenta lo que pagaste.";
  protected readonly pagaConEfectivo = true;
}

export class VentaManejador extends ManejadorOperacion {
  readonly tipo = "VENTA" as const;
  readonly descripcion =
    "Una venta: resta de tu tenencia, suma lo que cobraste y calcula cuánto ganaste o perdiste.";

  aplicar(estado: EstadoCartera, operacion: OperacionMotor, contexto: ContextoAplicacion): void {
    const cantidad = this.requerir(operacion.cantidad, "la cantidad", operacion);
    const precio = this.requerir(operacion.precio, "el precio", operacion);
    const posicion = this.posicionExistente(estado, operacion);
    const tenida = posicion ? cantidadDe(posicion) : CERO;
    if (!posicion || cantidad.gt(tenida)) {
      throw new ErrorValidacion(
        `El ${formatoFechaCorta(operacion.fecha)} vendés ${formatearNumero(cantidad, DECIMALES_CANTIDAD)} ` +
          `${operacion.ticker ?? "del activo"}, pero en ese momento tenías ` +
          `${formatearNumero(tenida, DECIMALES_CANTIDAD)}.`,
      );
    }
    const { restantes, costoConsumido } = contexto.estrategia.consumir(posicion.lotes, cantidad);
    const cobrado = bruto(operacion, cantidad, precio).minus(operacion.gastos);
    const ingreso = importeDe(cobrado, operacion.moneda, operacion.tipoCambio);
    posicion.lotes = restantes;
    posicion.realizado = sumar(posicion.realizado, restar(ingreso, costoConsumido));
    this.moverEfectivo(estado, operacion.moneda, cobrado);
  }
}

/** Cobros que no cambian la tenencia: suman a lo cobrado y al efectivo. */
abstract class ManejadorCobro extends ManejadorOperacion {
  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const posicion = this.posicion(estado, operacion);
    posicion.cobros = sumar(
      posicion.cobros,
      importeDe(monto, operacion.moneda, operacion.tipoCambio),
    );
    this.moverEfectivo(estado, operacion.moneda, monto);
  }
}

export class DividendoManejador extends ManejadorCobro {
  readonly tipo = "DIVIDENDO" as const;
  readonly descripcion = "Un dividendo que te pagó una acción o un CEDEAR.";
}

export class RentaManejador extends ManejadorCobro {
  readonly tipo = "RENTA" as const;
  readonly descripcion = "Los intereses (cupón) que te pagó un bono o una obligación negociable.";
}

export class AmortizacionManejador extends ManejadorOperacion {
  readonly tipo = "AMORTIZACION" as const;
  readonly descripcion =
    "La devolución de parte del capital de un bono u obligación negociable: baja lo invertido en ese activo.";

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const posicion = this.posicionExistente(estado, operacion);
    if (!posicion || cantidadDe(posicion).isZero()) {
      throw new ErrorValidacion(
        `El ${formatoFechaCorta(operacion.fecha)} registrás una amortización de ` +
          `${operacion.ticker ?? "un activo"}, pero en ese momento no tenías ese activo.`,
      );
    }
    const devuelto = importeDe(monto, operacion.moneda, operacion.tipoCambio);
    const costo = costoDe(posicion);
    // Se devuelve capital: el costo baja en la misma proporción. Lo que exceda el costo es ganancia.
    const proporcion = costo.ars.isZero() ? UNO : Decimal.min(UNO, devuelto.ars.div(costo.ars));
    const queda = UNO.minus(proporcion);
    posicion.lotes = posicion.lotes.map((lote) => ({ ...lote, costo: escalar(lote.costo, queda) }));
    posicion.realizado = sumar(posicion.realizado, restar(devuelto, escalar(costo, proporcion)));
    this.moverEfectivo(estado, operacion.moneda, monto);
  }
}

/** Movimientos de dinero propio: cambian el efectivo y lo aportado. */
abstract class ManejadorEfectivo extends ManejadorOperacion {
  protected abstract readonly signo: 1 | -1;

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const conSigno = this.signo === 1 ? monto : monto.neg();
    this.moverEfectivo(estado, operacion.moneda, conSigno);
    estado.aportesNetos = sumar(
      estado.aportesNetos,
      importeDe(conSigno, operacion.moneda, operacion.tipoCambio),
    );
    estado.registraEfectivo = true;
  }
}

export class DepositoManejador extends ManejadorEfectivo {
  readonly tipo = "DEPOSITO" as const;
  readonly descripcion = "Dinero que ingresaste a tu cuenta del bróker.";
  protected readonly signo = 1;
}

export class ExtraccionManejador extends ManejadorEfectivo {
  readonly tipo = "EXTRACCION" as const;
  readonly descripcion = "Dinero que retiraste de tu cuenta del bróker.";
  protected readonly signo = -1;
}

export class ComisionManejador extends ManejadorOperacion {
  readonly tipo = "COMISION" as const;
  readonly descripcion =
    "Una comisión o gasto que te cobró el bróker (mantenimiento, custodia u otros).";

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const importe = importeDe(monto, operacion.moneda, operacion.tipoCambio);
    if (operacion.instrumentoId) {
      const posicion = this.posicion(estado, operacion);
      posicion.realizado = restar(posicion.realizado, importe);
    } else {
      estado.comisionesSueltas = sumar(estado.comisionesSueltas, importe);
    }
    this.moverEfectivo(estado, operacion.moneda, monto.neg());
  }
}
