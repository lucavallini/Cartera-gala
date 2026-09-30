import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { crearAppPrueba, registrarUsuario, type AppPrueba } from "../../utilidades/app-prueba";

describe("POST /api/cotizaciones/actualizar", () => {
  let prueba: AppPrueba;
  beforeAll(async () => {
    prueba = await crearAppPrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("fuerza la actualización y devuelve el estado del mercado", async () => {
    const usuario = await registrarUsuario(prueba.app);
    const respuesta = await request(prueba.app)
      .post("/api/cotizaciones/actualizar")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ abierto: true, desactualizado: false });
    expect(prueba.buscar.llamadas.filter((u) => u.includes("/live/"))).toHaveLength(5);
  });
});
