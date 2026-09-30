const PATRON_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Las fechas de operaciones son días: se guardan como medianoche UTC de ese día. */
export function aFechaDia(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`);
}

export function aTextoDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function esTextoDiaValido(texto: string): boolean {
  if (!PATRON_DIA.test(texto)) return false;
  const fecha = aFechaDia(texto);
  return !Number.isNaN(fecha.getTime()) && aTextoDia(fecha) === texto;
}

/** "AAAA-MM-DD" del día actual en la zona horaria dada. */
export function hoyEn(zonaHoraria: string, ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** "AAAA-MM-DD" → "10/05/2026", o "10/05" sin el año. */
export function formatoDia(textoDia: string, conAnio = true): string {
  const [anio, mes, dia] = textoDia.split("-");
  return conAnio ? `${dia}/${mes}/${anio}` : `${dia}/${mes}`;
}

/** "10/05/2026". */
export function formatoFechaCorta(fecha: Date): string {
  return formatoDia(aTextoDia(fecha));
}

/** Fecha corta del día que era en esa zona horaria en ese momento (no el día UTC). */
export function fechaCortaEn(zonaHoraria: string, momento: Date, conAnio = true): string {
  return formatoDia(hoyEn(zonaHoraria, momento), conAnio);
}
