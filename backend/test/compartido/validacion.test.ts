import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validar } from "../../src/compartido/validacion";
import { ErrorNoEncontrado, ErrorValidacion } from "../../src/compartido/errores";

const esquema = z.object({
  nombre: z.string().min(2, "Mínimo 2 letras."),
  datos: z.object({ edad: z.number().int("Tiene que ser un número entero.") }),
});

describe("validar", () => {
  it("devuelve los datos cuando son válidos", () => {
    expect(validar(esquema, { nombre: "Ana", datos: { edad: 30 } })).toEqual({
      nombre: "Ana",
      datos: { edad: 30 },
    });
  });

  it("lanza ErrorValidacion con un detalle por campo, con la ruta completa", () => {
    try {
      validar(esquema, { nombre: "A", datos: { edad: 1.5 } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorValidacion);
      const detalles = (error as ErrorValidacion).detalles;
      expect(detalles).toEqual(
        expect.arrayContaining([
          { campo: "nombre", mensaje: "Mínimo 2 letras." },
          { campo: "datos.edad", mensaje: "Tiene que ser un número entero." },
        ]),
      );
    }
  });
});

describe("errores", () => {
  it("ErrorNoEncontrado arma el mensaje con la entidad", () => {
    const error = new ErrorNoEncontrado("la cartera");
    expect(error.message).toBe("No se encontró la cartera.");
    expect(error.status).toBe(404);
    expect(error.codigo).toBe("NO_ENCONTRADO");
    expect(error.name).toBe("ErrorNoEncontrado");
  });
});
