import type { z } from "zod";

const POR_TIPO_ESPERADO: Record<string, string> = {
  number: "Tiene que ser un número.",
  int: "Tiene que ser un número entero.",
  string: "Tiene que ser un texto.",
  boolean: "Tiene que ser sí o no.",
  date: "Tiene que ser una fecha válida.",
  array: "Tiene que ser una lista.",
  object: "Faltan datos o tienen un formato incorrecto.",
};

const POR_FORMATO: Record<string, string> = {
  email: "El email no es válido. Ejemplo: nombre@gmail.com",
  url: "La dirección web no es válida.",
  regex: "Tiene un formato incorrecto.",
};

/**
 * Mapa de errores global: reemplaza los textos por defecto de zod (técnicos, a veces en inglés)
 * por frases llanas. Los mensajes escritos en cada esquema tienen prioridad sobre este.
 */
export function mensajeAmigable(problema: z.core.$ZodRawIssue): string {
  switch (problema.code) {
    case "invalid_type":
      if (problema.input === undefined || problema.input === null) {
        return "Este dato es obligatorio.";
      }
      return POR_TIPO_ESPERADO[problema.expected] ?? "Tiene un formato incorrecto.";
    case "too_small":
      if (problema.origin === "string") {
        return Number(problema.minimum) <= 1
          ? "Este dato es obligatorio."
          : `Tiene que tener al menos ${problema.minimum} caracteres.`;
      }
      if (problema.origin === "number") {
        return `Tiene que ser ${problema.inclusive ? "mayor o igual a" : "mayor a"} ${problema.minimum}.`;
      }
      return `Tiene que tener al menos ${problema.minimum} elementos.`;
    case "too_big":
      if (problema.origin === "string") return `Puede tener hasta ${problema.maximum} caracteres.`;
      if (problema.origin === "number") {
        return `Tiene que ser ${problema.inclusive ? "menor o igual a" : "menor a"} ${problema.maximum}.`;
      }
      return `Puede tener hasta ${problema.maximum} elementos.`;
    case "invalid_format":
      return POR_FORMATO[problema.format] ?? "Tiene un formato incorrecto.";
    case "invalid_value":
      return "Elegí una de las opciones válidas.";
    case "unrecognized_keys":
      return `Hay datos que no se esperaban: ${problema.keys.join(", ")}.`;
    default:
      return "Este dato no es válido.";
  }
}
