import { z } from "zod";
import type { TipoDolar } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import { ProveedorHttpBase, type DatoConFecha } from "../http/proveedor-http-base";
import { CASA_POR_TIPO, type CotizacionDolar, type ProveedorDolarActual } from "./proveedor-dolar";

const URL_DOLARES = "https://dolarapi.com/v1/dolares";
const TTL_MS = 60_000;

const TIPO_POR_CASA = new Map<string, TipoDolar>(
  Object.entries(CASA_POR_TIPO).map(([tipo, casa]) => [casa, tipo as TipoDolar]),
);

const esquema = z.array(
  z.object({
    casa: z.string(),
    compra: z.number().nullable(),
    venta: z.number(),
    fechaActualizacion: z.string(),
  }),
);

function interpretar(json: unknown): CotizacionDolar[] {
  const cotizaciones: CotizacionDolar[] = [];
  for (const fila of esquema.parse(json)) {
    const tipo = TIPO_POR_CASA.get(fila.casa);
    if (!tipo) continue;
    // Una fecha rara no debe llegar como Invalid Date: se descarta esa fila.
    const actualizadoEn = new Date(fila.fechaActualizacion);
    if (Number.isNaN(actualizadoEn.getTime())) continue;
    cotizaciones.push({
      tipo,
      compra: fila.compra === null ? null : new Decimal(String(fila.compra)),
      venta: new Decimal(String(fila.venta)),
      actualizadoEn,
    });
  }
  return cotizaciones;
}

export class DolarApiProveedor extends ProveedorHttpBase implements ProveedorDolarActual {
  protected readonly queSeObtiene = "el valor del dólar";

  actuales(forzar = false): Promise<DatoConFecha<CotizacionDolar[]>> {
    return this.obtener("dolares", URL_DOLARES, TTL_MS, interpretar, forzar);
  }
}
