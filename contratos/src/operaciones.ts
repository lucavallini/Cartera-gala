import type { Moneda } from "./comunes";

export type TipoOperacion =
  | "TENENCIA_INICIAL"
  | "COMPRA"
  | "VENTA"
  | "DIVIDENDO"
  | "RENTA"
  | "AMORTIZACION"
  | "SUSCRIPCION_FCI"
  | "RESCATE_FCI"
  | "DEPOSITO"
  | "EXTRACCION"
  | "COMPRA_MONEDA"
  | "VENTA_MONEDA"
  | "CAUCION_COLOCACION"
  | "CAUCION_VENCIMIENTO"
  | "COMISION"
  | "IMPUESTO"
  | "SPLIT"
  | "CANJE"
  | "TRANSFERENCIA_ENTRADA"
  | "TRANSFERENCIA_SALIDA"
  | "AJUSTE";

/** Tipos que se pueden registrar en la etapa 1. */
export type TipoOperacionDisponible =
  | "TENENCIA_INICIAL"
  | "COMPRA"
  | "VENTA"
  | "DIVIDENDO"
  | "RENTA"
  | "AMORTIZACION"
  | "DEPOSITO"
  | "EXTRACCION"
  | "COMISION";

interface DatosComunesOperacion {
  cuentaId?: string | null;
  /** AAAA-MM-DD */
  fecha: string;
  moneda: Moneda;
  /** Pesos por dólar de ese día. Si no se manda, lo completa el backend con el histórico. */
  tipoCambio?: number | null;
  notas?: string | null;
}

export interface OperacionConPrecioEntrada extends DatosComunesOperacion {
  tipo: "TENENCIA_INICIAL" | "COMPRA" | "VENTA";
  instrumentoId: string;
  cantidad: number;
  precio: number;
  comision?: number;
  derechosMercado?: number;
  iva?: number;
  otrosGastos?: number;
}

export interface CobroEntrada extends DatosComunesOperacion {
  tipo: "DIVIDENDO" | "RENTA" | "AMORTIZACION";
  instrumentoId: string;
  monto: number;
}

export interface MovimientoEfectivoEntrada extends DatosComunesOperacion {
  tipo: "DEPOSITO" | "EXTRACCION";
  monto: number;
}

export interface ComisionEntrada extends DatosComunesOperacion {
  tipo: "COMISION";
  instrumentoId?: string | null;
  monto: number;
}

export type DatosOperacionEntrada =
  OperacionConPrecioEntrada | CobroEntrada | MovimientoEfectivoEntrada | ComisionEntrada;

export type CrearOperacionEntrada = DatosOperacionEntrada & { carteraId: string };
export type EditarOperacionEntrada = DatosOperacionEntrada;

export type SimularOperacionEntrada =
  | { accion: "crear"; operacion: CrearOperacionEntrada }
  | { accion: "editar"; id: string; operacion: EditarOperacionEntrada }
  | { accion: "borrar"; id: string };

export interface InstrumentoResumidoDto {
  id: string;
  ticker: string;
  nombre: string | null;
}

export interface OperacionDto {
  id: string;
  carteraId: string;
  cuentaId: string | null;
  tipo: TipoOperacion;
  tipoTexto: string;
  fecha: string;
  instrumento: InstrumentoResumidoDto | null;
  cantidad: number | null;
  precio: number | null;
  moneda: Moneda;
  monto: number | null;
  gastos: number;
  tipoCambio: number;
  notas: string | null;
  origen: "MANUAL" | "IMPORTACION" | "SISTEMA";
  /** "Compra de 100 AMZN a $ 2.785,00" */
  descripcion: string;
  creadoEn: string;
}

export interface EstadoPosicionDto {
  cantidad: number;
  precioPromedio: number | null;
  moneda: Moneda;
}

export interface SimulacionDto {
  valida: boolean;
  /** Qué va a pasar ("Tu tenencia de AMZN pasa de 72 a 172…") o por qué no se puede. */
  mensaje: string;
  antes: EstadoPosicionDto | null;
  despues: EstadoPosicionDto | null;
}

export type CampoOperacion = "instrumento" | "cantidad" | "precio" | "gastos" | "monto";

export interface TipoOperacionDto {
  tipo: TipoOperacionDisponible;
  texto: string;
  descripcion: string;
  /** Qué campos pide el formulario para este tipo. */
  campos: CampoOperacion[];
}
