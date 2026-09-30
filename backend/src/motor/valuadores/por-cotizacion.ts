import type { Moneda } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import { cantidadDe, costoDe } from "../posicion";
import type { Importe, Posicion, PrecioVigente } from "../tipos";
import type { ContextoValuacion, ValuacionPosicion, Valuador } from "./valuador";

const MONEDAS_DOLAR: readonly Moneda[] = ["USD_MEP", "USD_CCL", "USD_EXTERIOR"];

interface Cotizacion {
  precio: Decimal;
  moneda: Moneda;
}

/** El precio en la moneda del usuario; si no hay, el de pesos; si no, cualquier dólar. */
function elegirCotizacion(precio: PrecioVigente, preferida: Moneda): Cotizacion | null {
  for (const moneda of [preferida, "ARS" as const, ...MONEDAS_DOLAR]) {
    const valor = precio.porMoneda[moneda];
    if (valor) return { precio: valor, moneda };
  }
  return null;
}

function convertir(valor: Decimal, desde: Moneda, hacia: Moneda, dolar: Decimal): Decimal {
  const desdePesos = desde === "ARS";
  if (desdePesos === (hacia === "ARS")) return valor;
  return desdePesos ? valor.div(dolar) : valor.mul(dolar);
}

/** Acciones, CEDEARs, bonos, ONs y letras: cantidad × precio de mercado × factor. */
export class ValuadorPorCotizacion implements Valuador {
  valuar(
    posicion: Posicion,
    precio: PrecioVigente | undefined,
    contexto: ContextoValuacion,
  ): ValuacionPosicion {
    const cotizacion = precio ? elegirCotizacion(precio, posicion.monedaPrecio) : null;
    if (!precio || !cotizacion) {
      return {
        valor: costoDe(posicion),
        precio: null,
        variacionPct: null,
        sinCotizacion: true,
        fuente: "COSTO",
      };
    }
    const bruto = cantidadDe(posicion).mul(cotizacion.precio).mul(posicion.factorPrecio);
    const valor: Importe =
      cotizacion.moneda === "ARS"
        ? { ars: bruto, usd: bruto.div(contexto.dolar) }
        : { ars: bruto.mul(contexto.dolar), usd: bruto };
    return {
      valor,
      precio: convertir(
        cotizacion.precio,
        cotizacion.moneda,
        posicion.monedaPrecio,
        contexto.dolar,
      ),
      variacionPct: precio.variacionPct,
      sinCotizacion: false,
      fuente: precio.fuente,
    };
  }
}
