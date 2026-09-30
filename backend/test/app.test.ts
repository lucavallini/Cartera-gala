import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { crearAppPrueba, type AppPrueba } from "./utilidades/app-prueba";

describe("app", () => {
  let prueba: AppPrueba;
  beforeAll(async () => {
    prueba = await crearAppPrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("responde el chequeo de salud sin pedir sesión", async () => {
    const respuesta = await request(prueba.app).get("/api/salud");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });

  it("agrega los encabezados de seguridad de helmet", async () => {
    const respuesta = await request(prueba.app).get("/api/salud");
    expect(respuesta.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("exige sesión en las rutas privadas", async () => {
    const respuesta = await request(prueba.app).get("/api/carteras");
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe("NO_AUTORIZADO");
  });

  it("responde 404 en JSON fuera de /api", async () => {
    const respuesta = await request(prueba.app).get("/no-existe");
    expect(respuesta.status).toBe(404);
  });

  it("cada respuesta lleva un número de referencia para rastrear errores", async () => {
    const respuesta = await request(prueba.app).get("/api/salud");
    expect(respuesta.headers["x-referencia"]).toMatch(/^[0-9A-F]{8}$/);
  });
});
