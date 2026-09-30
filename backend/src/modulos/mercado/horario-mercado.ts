import { ErrorProveedorExterno } from "../../compartido/errores";
import { hoyEn } from "../../compartido/fechas";
import type { ProveedorFeriados } from "../../proveedores/dolar/proveedor-dolar";

const MINUTOS_POR_HORA = 60;
const APERTURA = 11 * MINUTOS_POR_HORA;
const CIERRE = 17 * MINUTOS_POR_HORA;
const DIAS_HABILES: ReadonlySet<string> = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/** Cada cuánto conviene volver a pedir precios con el mercado abierto. */
export const INTERVALO_ACTUALIZACION_MS = 60_000;

interface PartesLocales {
  fecha: string;
  anio: number;
  diaSemana: string;
  minutos: number;
}

function partesLocales(momento: Date, zonaHoraria: string): PartesLocales {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zonaHoraria,
      hourCycle: "h23",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(momento)
      .map((parte) => [parte.type, parte.value]),
  );
  const fecha = hoyEn(zonaHoraria, momento);
  return {
    fecha,
    anio: Number(fecha.slice(0, 4)),
    diaSemana: partes["weekday"] ?? "",
    minutos: Number(partes["hour"]) * MINUTOS_POR_HORA + Number(partes["minute"]),
  };
}

/** BYMA opera de lunes a viernes de 11 a 17 (hora argentina), salvo feriados. */
export class HorarioMercado {
  constructor(
    private readonly feriados: ProveedorFeriados,
    private readonly zonaHoraria: string,
    private readonly ahora: () => Date,
  ) {}

  async estaAbierto(momento: Date = this.ahora()): Promise<boolean> {
    const partes = partesLocales(momento, this.zonaHoraria);
    const enHorario = partes.minutos >= APERTURA && partes.minutos < CIERRE;
    if (!DIAS_HABILES.has(partes.diaSemana) || !enHorario) return false;
    return !(await this.esFeriado(partes));
  }

  private async esFeriado(partes: PartesLocales): Promise<boolean> {
    try {
      return (await this.feriados.feriados(partes.anio)).valor.includes(partes.fecha);
    } catch (error) {
      // Sin la lista de feriados, un día hábil se toma como abierto (el proveedor ya lo registró).
      if (error instanceof ErrorProveedorExterno) return false;
      throw error;
    }
  }
}
