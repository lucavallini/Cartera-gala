export interface EstadoMercadoDto {
  abierto: boolean;
  /** ISO 8601. null con el mercado cerrado: no hace falta volver a pedir. */
  proximaActualizacionEn: string | null;
  /** ISO 8601: de cuándo son los precios que se muestran. */
  datosDe: string | null;
  desactualizado: boolean;
  /** Frase lista para mostrar: "El mercado está abierto. Los precios se actualizan solos cada minuto." */
  mensaje: string;
}
