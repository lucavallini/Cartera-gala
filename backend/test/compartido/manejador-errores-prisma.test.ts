import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { crearManejadorErrores } from "../../src/compartido/http/manejador-errores";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";

describe("manejador de errores con Prisma", () => {
  let base: BasePrueba;
  beforeEach(async () => {
    base = await crearBasePrueba();
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("convierte una violación de unicidad en 409 explicado", async () => {
    const app = express();
    app.post("/duplicar", async (_req, res) => {
      const datos = { nombre: "A", email: "repetido@prueba.com", hashPassword: "x" };
      await base.bd.usuario.create({ data: datos });
      await base.bd.usuario.create({ data: datos });
      res.json({});
    });
    app.use(crearManejadorErrores(() => {}));
    const respuesta = await request(app).post("/duplicar");
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toEqual({
      codigo: "CONFLICTO",
      mensaje: "Ya existe un registro con esos datos.",
    });
  });
});
