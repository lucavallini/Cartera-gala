import type { TipoOperacion } from "@cartera/contratos";
import { ErrorValidacion } from "../../compartido/errores";
import type { ManejadorOperacion } from "./manejador-operacion";
import {
  AmortizacionManejador,
  CompraManejador,
  ComisionManejador,
  DepositoManejador,
  DividendoManejador,
  ExtraccionManejador,
  RentaManejador,
  TenenciaInicialManejador,
  VentaManejador,
} from "./manejadores";
import { TEXTO_TIPO_OPERACION } from "./textos";

export interface TipoDisponible {
  tipo: TipoOperacion;
  texto: string;
  descripcion: string;
}

/** Encuentra el manejador de cada tipo: agregar un tipo nuevo es registrar una clase más. */
export class RegistroManejadores {
  private readonly porTipo: ReadonlyMap<TipoOperacion, ManejadorOperacion>;

  constructor(private readonly manejadores: readonly ManejadorOperacion[]) {
    this.porTipo = new Map(manejadores.map((manejador) => [manejador.tipo, manejador]));
  }

  obtener(tipo: TipoOperacion): ManejadorOperacion {
    const manejador = this.porTipo.get(tipo);
    if (!manejador) {
      throw new ErrorValidacion(
        `Todavía no se pueden registrar operaciones de tipo «${TEXTO_TIPO_OPERACION[tipo]}».`,
      );
    }
    return manejador;
  }

  disponibles(): TipoDisponible[] {
    return this.manejadores.map((manejador) => ({
      tipo: manejador.tipo,
      texto: TEXTO_TIPO_OPERACION[manejador.tipo],
      descripcion: manejador.descripcion,
    }));
  }
}

export function crearRegistroManejadores(): RegistroManejadores {
  return new RegistroManejadores([
    new TenenciaInicialManejador(),
    new CompraManejador(),
    new VentaManejador(),
    new DividendoManejador(),
    new RentaManejador(),
    new AmortizacionManejador(),
    new DepositoManejador(),
    new ExtraccionManejador(),
    new ComisionManejador(),
  ]);
}
