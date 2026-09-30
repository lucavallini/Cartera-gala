import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CuentaDto, Pagina } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";

describe("API de cuentas", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  const auth = (usuario: UsuarioLogueado) => ({ Authorization: `Bearer ${usuario.token}` });

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("crea, lista ordenado por bróker, edita y borra", async () => {
    const bull = await request(prueba.app)
      .post("/api/cuentas")
      .set(auth(ana))
      .send({ broker: "Bull Market", numeroComitente: "1234", alias: "Principal" });
    expect(bull.status).toBe(201);
    expect(bull.body).toMatchObject({
      broker: "Bull Market",
      numeroComitente: "1234",
      alias: "Principal",
    });
    await request(prueba.app)
      .post("/api/cuentas")
      .set(auth(ana))
      .send({ broker: "Balanz" })
      .expect(201);

    const lista = await request(prueba.app).get("/api/cuentas").set(auth(ana)).expect(200);
    expect((lista.body as Pagina<CuentaDto>).items.map((c) => c.broker)).toEqual([
      "Balanz",
      "Bull Market",
    ]);

    const editada = await request(prueba.app)
      .patch(`/api/cuentas/${bull.body.id}`)
      .set(auth(ana))
      .send({ alias: null });
    expect(editada.body.alias).toBeNull();

    await request(prueba.app).delete(`/api/cuentas/${bull.body.id}`).set(auth(ana)).expect(204);
    await request(prueba.app).get(`/api/cuentas/${bull.body.id}`).set(auth(ana)).expect(404);
  });

  it("exige el bróker", async () => {
    const respuesta = await request(prueba.app)
      .post("/api/cuentas")
      .set(auth(ana))
      .send({ broker: " " });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0]).toEqual({
      campo: "broker",
      mensaje: "Poné el nombre del bróker. Ejemplo: Bull Market.",
    });
  });

  it("ordenar por un campo inválido explica las opciones en lenguaje llano", async () => {
    const respuesta = await request(prueba.app).get("/api/cuentas?orden=noExiste").set(auth(ana));
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].mensaje).toBe(
      "Valores posibles: bróker, alias, fecha de carga.",
    );
  });

  it("aislamiento entre usuarios", async () => {
    const deAna = await request(prueba.app)
      .post("/api/cuentas")
      .set(auth(ana))
      .send({ broker: "IOL" })
      .expect(201);
    const ruta = `/api/cuentas/${deAna.body.id}`;
    expect((await request(prueba.app).get(ruta).set(auth(beto))).status).toBe(404);
    expect(
      (await request(prueba.app).patch(ruta).set(auth(beto)).send({ broker: "X" })).status,
    ).toBe(404);
    expect((await request(prueba.app).delete(ruta).set(auth(beto))).status).toBe(404);
    const deBeto = await request(prueba.app).get("/api/cuentas").set(auth(beto)).expect(200);
    expect(deBeto.body.items).toEqual([]);
  });
});
