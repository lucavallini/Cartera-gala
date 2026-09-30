import { describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { crearManejadorErrores } from "../../src/compartido/http/manejador-errores";
import { rutaNoEncontrada } from "../../src/compartido/http/ruta-no-encontrada";
import { ErrorConflicto, ErrorValidacion } from "../../src/compartido/errores";

function appCon(manejador: RequestHandler, registrar: (error: unknown) => void = () => {}) {
  const app = express();
  app.use(express.json());
  app.post("/prueba", manejador);
  app.use(rutaNoEncontrada);
  app.use(crearManejadorErrores(registrar));
  return app;
}

describe("manejador de errores", () => {
  it("responde un ErrorApp con su status, código y mensaje", async () => {
    const app = appCon(() => {
      throw new ErrorConflicto('Ya tenés una cartera llamada "Principal".');
    });
    const respuesta = await request(app).post("/prueba").send({});
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: { codigo: "CONFLICTO", mensaje: 'Ya tenés una cartera llamada "Principal".' },
    });
  });

  it("incluye los detalles de validación", async () => {
    const app = appCon(async () => {
      throw new ErrorValidacion("Revisá los datos.", [{ campo: "nombre", mensaje: "Falta." }]);
    });
    const respuesta = await request(app).post("/prueba").send({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles).toEqual([{ campo: "nombre", mensaje: "Falta." }]);
  });

  it("oculta los errores inesperados y los registra", async () => {
    const registrar = vi.fn();
    const app = appCon(() => {
      throw new Error("detalle interno que no debe salir");
    }, registrar);
    const respuesta = await request(app).post("/prueba").send({});
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.codigo).toBe("ERROR_INTERNO");
    expect(JSON.stringify(respuesta.body)).not.toContain("detalle interno");
    expect(registrar).toHaveBeenCalledOnce();
  });

  it("explica cuando el cuerpo no es JSON válido", async () => {
    const app = appCon((_req, res) => {
      res.json({});
    });
    const respuesta = await request(app)
      .post("/prueba")
      .set("Content-Type", "application/json")
      .send("{mal json");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("JSON_INVALIDO");
  });

  it("responde 404 en JSON para rutas inexistentes, sin mostrar método ni ruta técnica", async () => {
    const respuesta = await request(appCon(() => {})).get("/no-existe");
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toEqual({
      codigo: "NO_ENCONTRADO",
      mensaje: "No existe esa página.",
    });
  });
});
