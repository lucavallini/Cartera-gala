import { z } from "zod";
import type { TipoDolar } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import { ProveedorHttpBase, type DatoConFecha } from "../http/proveedor-http-base";
import {
  CASA_POR_TIPO,
  type ProveedorDolarHistorico,
  type ProveedorFeriados,
  type PuntoDolar,
} from "./proveedor-dolar";

const URL_BASE = "https://api.argentinadatos.com/v1";
const TTL_HISTORICO_MS = 6 * 3_600_000;
const TTL_FERIADOS_MS = 24 * 3_600_000;

const esquemaHistorico = z.array(z.object({ fecha: z.string(), venta: z.number() }));
const esquemaFeriados = z.array(z.object({ fecha: z.string() }));

export class ArgentinaDatosProveedor
  extends ProveedorHttpBase
  implements ProveedorDolarHistorico, ProveedorFeriados
{
  protected readonly queSeObtiene = "los datos históricos del dólar y los feriados";

  historico(tipo: TipoDolar): Promise<DatoConFecha<PuntoDolar[]>> {
    return this.obtener(
      `dolar:${tipo}`,
      `${URL_BASE}/cotizaciones/dolares/${CASA_POR_TIPO[tipo]}`,
      TTL_HISTORICO_MS,
      // Ordenada por fecha: el último valor y la búsqueda por día dependen de ese orden.
      (json) =>
        esquemaHistorico
          .parse(json)
          .map((punto) => ({ fecha: punto.fecha, venta: new Decimal(String(punto.venta)) }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    );
  }

  feriados(anio: number): Promise<DatoConFecha<string[]>> {
    return this.obtener(
      `feriados:${anio}`,
      `${URL_BASE}/feriados/${anio}`,
      TTL_FERIADOS_MS,
      (json) => esquemaFeriados.parse(json).map((feriado) => feriado.fecha),
    );
  }
}
