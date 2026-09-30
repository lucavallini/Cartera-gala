import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validar } from "../../src/compartido/validacion";
import type { ErrorValidacion } from "../../src/compartido/errores";

const esquema = z
  .object({
    numero: z.number().int().min(1).max(10),
    entero: z.number().int(),
    texto: z.string().min(3).max(5),
    opcion: z.enum(["A", "B"]),
    email: z.email(),
    siNo: z.boolean(),
    obligatorio: z.string(),
  })
  .strict();

function mensajesDe(datos: unknown): Record<string, string> {
  try {
    validar(esquema, datos);
    return {};
  } catch (error) {
    return Object.fromEntries(
      ((error as ErrorValidacion).detalles ?? []).map((d) => [d.campo || "(general)", d.mensaje]),
    );
  }
}

const TEXTO_TECNICO =
  /invalid|expected|received|input|entrada inválida|(?<!no )se esperaba|nan|undefined/i;

describe("mensajes de validación", () => {
  it("usa frases llanas en castellano para cada tipo de problema", () => {
    const mensajes = mensajesDe({
      numero: "abc",
      entero: 1.5,
      texto: "x",
      opcion: "Z",
      email: "no",
      siNo: "si",
      extra: 1,
    });
    expect(mensajes).toEqual({
      numero: "Tiene que ser un número.",
      entero: "Tiene que ser un número entero.",
      texto: "Tiene que tener al menos 3 caracteres.",
      opcion: "Elegí una de las opciones válidas.",
      email: "El email no es válido. Ejemplo: nombre@gmail.com",
      siNo: "Tiene que ser sí o no.",
      obligatorio: "Este dato es obligatorio.",
      "(general)": "Hay datos que no se esperaban: extra.",
    });
  });

  it("explica los límites de números y textos", () => {
    const mensajes = mensajesDe({
      numero: 0,
      entero: 1,
      texto: "abcdefg",
      opcion: "A",
      email: "a@b.com",
      siNo: true,
      obligatorio: "x",
    });
    expect(mensajes).toEqual({
      numero: "Tiene que ser mayor o igual a 1.",
      texto: "Puede tener hasta 5 caracteres.",
    });
    expect(
      mensajesDe({
        numero: 11,
        entero: 1,
        texto: "abc",
        opcion: "A",
        email: "a@b.com",
        siNo: true,
        obligatorio: "x",
      }),
    ).toEqual({
      numero: "Tiene que ser menor o igual a 10.",
    });
  });

  it("ningún mensaje por defecto tiene jerga técnica ni inglés", () => {
    const mensajes = mensajesDe({
      numero: Number.NaN,
      entero: "x",
      texto: 3,
      opcion: null,
      email: 5,
      siNo: {},
      extra: true,
    });
    for (const mensaje of Object.values(mensajes)) expect(mensaje).not.toMatch(TEXTO_TECNICO);
  });

  it("los mensajes propios de cada esquema siguen teniendo prioridad", () => {
    const propio = z.object({ nombre: z.string({ message: "Poné tu nombre." }) });
    try {
      validar(propio, {});
    } catch (error) {
      expect((error as ErrorValidacion).detalles).toEqual([
        { campo: "nombre", mensaje: "Poné tu nombre." },
      ]);
    }
  });
});
