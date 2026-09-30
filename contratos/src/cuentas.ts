export interface CuentaDto {
  id: string;
  broker: string;
  numeroComitente: string | null;
  alias: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearCuentaEntrada {
  broker: string;
  numeroComitente?: string;
  alias?: string;
}

export interface EditarCuentaEntrada {
  broker?: string;
  numeroComitente?: string | null;
  alias?: string | null;
}
