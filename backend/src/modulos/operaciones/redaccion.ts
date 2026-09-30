import type { Moneda, TipoOperacion } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import { DECIMALES_CANTIDAD, formatearMoneda, formatearNumero } from "../../compartido/formato";
import { TEXTO_TIPO_OPERACION } from "../../motor/operaciones/textos";
import { precioPromedio, type FotoPosicion } from "../../motor/simulacion";

const UMBRAL_PRECIO_CHICO = 10;
const DECIMALES_PRECIO_CHICO = 4;

/** Precios menores a 10 (típicos en dólares) llevan 4 decimales; el resto, 2. */
export function formatearPrecio(valor: Decimal, moneda: Moneda): string {
  return formatearMoneda(
    valor,
    moneda,
    valor.abs().lt(UMBRAL_PRECIO_CHICO) ? DECIMALES_PRECIO_CHICO : 2,
  );
}

export interface DatosDescripcion {
  tipo: TipoOperacion;
  ticker: string | null;
  cantidad: Decimal | null;
  precio: Decimal | null;
  monto: Decimal | null;
  moneda: Moneda;
}

export function describirOperacion(datos: DatosDescripcion): string {
  const texto = TEXTO_TIPO_OPERACION[datos.tipo];
  const activo = datos.ticker ?? "";
  if (datos.cantidad && datos.precio) {
    const detalle = `${texto} de ${formatearNumero(datos.cantidad, DECIMALES_CANTIDAD)} ${activo} a ${formatearPrecio(datos.precio, datos.moneda)}`;
    return datos.tipo === "TENENCIA_INICIAL" ? `${detalle} promedio` : detalle;
  }
  if (datos.monto) {
    const monto = formatearMoneda(datos.monto, datos.moneda);
    if (datos.tipo === "COMISION")
      return datos.ticker ? `${texto} de ${activo} por ${monto}` : `${texto} por ${monto}`;
    return datos.ticker ? `${texto} de ${activo} por ${monto}` : `${texto} de ${monto}`;
  }
  return texto;
}

function promedioTexto(posicion: FotoPosicion): string | null {
  const promedio = precioPromedio(posicion);
  return promedio ? formatearPrecio(promedio, posicion.monedaPrecio) : null;
}

export function describirSimulacion(
  antes: FotoPosicion | null,
  despues: FotoPosicion | null,
): string {
  if (!antes && !despues) return "La operación se puede registrar.";
  if (!antes && despues) {
    const promedio = promedioTexto(despues);
    const cantidad = formatearNumero(despues.cantidad, DECIMALES_CANTIDAD);
    return promedio
      ? `Vas a tener ${cantidad} ${despues.ticker} con un precio promedio de ${promedio}.`
      : `Vas a tener ${cantidad} ${despues.ticker}.`;
  }
  const referencia = (antes ?? despues) as FotoPosicion;
  const cantidadAntes = antes ? formatearNumero(antes.cantidad, DECIMALES_CANTIDAD) : "0";
  const cantidadDespues = despues ? formatearNumero(despues.cantidad, DECIMALES_CANTIDAD) : "0";
  const base = `Tu tenencia de ${referencia.ticker} pasa de ${cantidadAntes} a ${cantidadDespues}`;
  const promedioAntes = antes ? promedioTexto(antes) : null;
  const promedioDespues = despues ? promedioTexto(despues) : null;
  if (promedioAntes && promedioDespues && promedioAntes !== promedioDespues) {
    return `${base} y tu precio promedio de ${promedioAntes} a ${promedioDespues}.`;
  }
  return `${base}.`;
}
