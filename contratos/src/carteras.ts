export interface CarteraDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  esPrincipal: boolean;
  archivada: boolean;
  orden: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearCarteraEntrada {
  nombre: string;
  descripcion?: string;
}

export interface EditarCarteraEntrada {
  nombre?: string;
  descripcion?: string | null;
  /** Solo se acepta `true`: para cambiar la principal se marca otra. */
  esPrincipal?: boolean;
  archivada?: boolean;
  orden?: number;
}
