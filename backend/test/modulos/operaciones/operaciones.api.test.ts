import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type {
  CarteraDto,
  InstrumentoDto,
  OperacionDto,
  Pagina,
  ResumenDto,
} from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";

describe("API de operaciones", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  let cartera: string;
  let amzn: string;
  let ym39: string;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  async function instrumento(q: string): Promise<string> {
    const respuesta = await request(prueba.app)
      .get(`/api/instrumentos/buscar?q=${q}`)
      .set(auth(ana))
      .expect(200);
    const [primero] = respuesta.body as InstrumentoDto[];
    if (!primero) throw new Error(`sin ${q}`);
    return primero.id;
  }

  function crear(cuerpo: object, usuario = ana) {
    return request(prueba.app)
      .post("/api/operaciones")
      .set(auth(usuario))
      .send({ carteraId: cartera, ...cuerpo });
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(ana)).expect(200);
    cartera = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    amzn = await instrumento("AMZN");
    ym39 = await instrumento("YM39O");
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("registra una tenencia inicial, completa el dólar del día y la describe", async () => {
    const respuesta = await crear({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: amzn,
      fecha: "2026-09-15",
      cantidad: 72,
      precio: 1.5,
      moneda: "USD_MEP",
    });
    expect(respuesta.status).toBe(201);
    const operacion = respuesta.body as OperacionDto;
    expect(operacion).toMatchObject({
      tipo: "TENENCIA_INICIAL",
      tipoTexto: "Tenencia inicial",
      fecha: "2026-09-15",
      instrumento: { id: amzn, ticker: "AMZN" },
      cantidad: 72,
      precio: 1.5,
      moneda: "USD_MEP",
      tipoCambio: 1536.7,
      gastos: 0,
      origen: "MANUAL",
      descripcion: "Tenencia inicial de 72 AMZN a US$ 1,5000 promedio",
    });
    const auditoria = await prueba.bd.registroAuditoria.findMany({
      where: { entidadId: operacion.id },
    });
    expect(auditoria.map((r) => r.accion)).toEqual(["CREAR"]);
  });

  it("respeta el tipo de cambio que carga el usuario", async () => {
    const respuesta = await crear({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: ym39,
      fecha: "2026-09-16",
      cantidad: 344,
      precio: 109.3,
      moneda: "USD_MEP",
      tipoCambio: 1500,
    });
    expect(respuesta.body.tipoCambio).toBe(1500);
  });

  it("para una fecha sin dólar histórico pide cargarlo a mano; con el dato, funciona", async () => {
    const sinDato = await crear({
      tipo: "DEPOSITO",
      fecha: "2015-06-01",
      monto: 1000,
      moneda: "USD_MEP",
    });
    expect(sinDato.status).toBe(400);
    expect(sinDato.body.error.mensaje).toBe(
      "No tenemos el valor del dólar para el 01/06/2015. Cargá el tipo de cambio a mano.",
    );
    expect(sinDato.body.error.detalles[0].campo).toBe("tipoCambio");
    const conDato = await crear({
      tipo: "DEPOSITO",
      fecha: "2015-06-01",
      monto: 1000,
      moneda: "USD_MEP",
      tipoCambio: 12.5,
    });
    expect(conDato.status).toBe(201);
  });

  it("no acepta fechas futuras", async () => {
    const respuesta = await crear({
      tipo: "DEPOSITO",
      fecha: "2026-09-29",
      monto: 10,
      moneda: "ARS",
    });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0]).toEqual({
      campo: "fecha",
      mensaje: "La fecha no puede ser posterior a hoy.",
    });
  });

  it("rechaza vender más de lo que había, con fecha y cantidades", async () => {
    const respuesta = await crear({
      tipo: "VENTA",
      instrumentoId: amzn,
      fecha: "2026-09-20",
      cantidad: 100,
      precio: 1.9,
      moneda: "USD_MEP",
    });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toBe(
      "El 20/09/2026 vendés 100 AMZN, pero en ese momento tenías 72.",
    );
  });

  it("no deja borrar una operación si una venta posterior quedaría sin tenencia", async () => {
    const compra = await crear({
      tipo: "COMPRA",
      instrumentoId: ym39,
      fecha: "2026-09-17",
      cantidad: 100,
      precio: 110,
      moneda: "USD_MEP",
    });
    const venta = await crear({
      tipo: "VENTA",
      instrumentoId: ym39,
      fecha: "2026-09-21",
      cantidad: 400,
      precio: 111,
      moneda: "USD_MEP",
    });
    expect(venta.status).toBe(201);
    const borrar = await request(prueba.app)
      .delete(`/api/operaciones/${compra.body.id}`)
      .set(auth(ana));
    expect(borrar.status).toBe(409);
    expect(borrar.body.error.mensaje).toBe(
      "No se puede borrar esta operación: el 21/09/2026 vendés 400 YM39O, pero en ese momento tenías 344.",
    );
  });

  it("editar valida la historia completa", async () => {
    const compra = await crear({
      tipo: "COMPRA",
      instrumentoId: amzn,
      fecha: "2026-09-18",
      cantidad: 10,
      precio: 1.8,
      moneda: "USD_MEP",
    });
    const editada = await request(prueba.app)
      .patch(`/api/operaciones/${compra.body.id}`)
      .set(auth(ana))
      .send({
        tipo: "COMPRA",
        instrumentoId: amzn,
        fecha: "2026-09-18",
        cantidad: 20,
        precio: 1.8,
        moneda: "USD_MEP",
      });
    expect(editada.status).toBe(200);
    expect(editada.body.cantidad).toBe(20);
    const inicial = await request(prueba.app)
      .get(`/api/operaciones?tipo=TENENCIA_INICIAL&instrumentoId=${amzn}`)
      .set(auth(ana));
    const idInicial = (inicial.body as Pagina<OperacionDto>).items[0]?.id;
    await crear({
      tipo: "VENTA",
      instrumentoId: amzn,
      fecha: "2026-09-22",
      cantidad: 90,
      precio: 1.9,
      moneda: "USD_MEP",
    }).expect(201);
    const invalida = await request(prueba.app)
      .patch(`/api/operaciones/${idInicial}`)
      .set(auth(ana))
      .send({
        tipo: "TENENCIA_INICIAL",
        instrumentoId: amzn,
        fecha: "2026-09-15",
        cantidad: 10,
        precio: 1.5,
        moneda: "USD_MEP",
      });
    expect(invalida.status).toBe(400);
    expect(invalida.body.error.mensaje).toBe(
      "El 22/09/2026 vendés 90 AMZN, pero en ese momento tenías 30.",
    );
  });

  it("lista con filtros, de la más nueva a la más vieja", async () => {
    const respuesta = await request(prueba.app)
      .get(`/api/operaciones?instrumentoId=${amzn}`)
      .set(auth(ana))
      .expect(200);
    const fechas = (respuesta.body as Pagina<OperacionDto>).items.map((o) => o.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect(fechas.length).toBeGreaterThanOrEqual(3);
  });

  it("ordenar por un campo inválido explica las opciones en lenguaje llano", async () => {
    const respuesta = await request(prueba.app)
      .get("/api/operaciones?orden=noExiste")
      .set(auth(ana));
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].mensaje).toBe(
      "Valores posibles: fecha, fecha de carga, tipo.",
    );
  });

  it("simula una compra y explica el efecto sin guardar nada", async () => {
    const antes = await prueba.bd.operacion.count();
    const respuesta = await request(prueba.app)
      .post("/api/operaciones/simular")
      .set(auth(ana))
      .send({
        accion: "crear",
        operacion: {
          carteraId: cartera,
          tipo: "COMPRA",
          instrumentoId: amzn,
          fecha: "2026-09-23",
          cantidad: 100,
          precio: 2,
          moneda: "USD_MEP",
        },
      });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.valida).toBe(true);
    // AMZN a esta altura: 72 (inicial) + 20 (compra editada) − 90 (venta) = 2.
    expect(respuesta.body.mensaje).toBe(
      "Tu tenencia de AMZN pasa de 2 a 102 y tu precio promedio de US$ 1,5652 a US$ 1,9915.",
    );
    expect(respuesta.body.antes).toMatchObject({ cantidad: 2, moneda: "USD_MEP" });
    expect(respuesta.body.despues).toMatchObject({ cantidad: 102 });
    expect(await prueba.bd.operacion.count()).toBe(antes);
  });

  it("simular un borrado inválido explica por qué no se puede", async () => {
    const inicial = await request(prueba.app)
      .get(`/api/operaciones?tipo=TENENCIA_INICIAL&instrumentoId=${amzn}`)
      .set(auth(ana));
    const id = (inicial.body as Pagina<OperacionDto>).items[0]?.id;
    const respuesta = await request(prueba.app)
      .post("/api/operaciones/simular")
      .set(auth(ana))
      .send({ accion: "borrar", id });
    // Sin la inicial quedan solo los 20 de la compra para la venta de 90.
    expect(respuesta.body).toMatchObject({
      valida: false,
      mensaje: "El 22/09/2026 vendés 90 AMZN, pero en ese momento tenías 20.",
    });
  });

  it("lista los tipos disponibles con los campos que pide cada uno", async () => {
    const respuesta = await request(prueba.app)
      .get("/api/operaciones/tipos")
      .set(auth(ana))
      .expect(200);
    expect(respuesta.body).toHaveLength(9);
    expect(respuesta.body[0]).toEqual({
      tipo: "TENENCIA_INICIAL",
      texto: "Tenencia inicial",
      descripcion:
        "Un activo que ya tenías, con su cantidad y su precio promedio de compra. No mueve efectivo.",
      campos: ["instrumento", "cantidad", "precio", "gastos"],
    });
    expect(respuesta.body.find((t: { tipo: string }) => t.tipo === "DEPOSITO").campos).toEqual([
      "monto",
    ]);
  });

  it("valida con mensajes llanos", async () => {
    const tipoRaro = await crear({ tipo: "SPLIT", fecha: "2026-09-10", moneda: "ARS" });
    expect(tipoRaro.status).toBe(400);
    expect(tipoRaro.body.error.detalles[0].mensaje).toBe(
      "Elegí qué tipo de operación querés registrar.",
    );
    const negativa = await crear({
      tipo: "COMPRA",
      instrumentoId: amzn,
      fecha: "2026-09-10",
      cantidad: -5,
      precio: 1,
      moneda: "ARS",
    });
    expect(negativa.body.error.detalles).toEqual([
      { campo: "cantidad", mensaje: "Tiene que ser un número mayor a cero." },
    ]);
  });

  it("aislamiento: no se puede operar en carteras ajenas ni ver operaciones de otro", async () => {
    const enAjena = await crear(
      { tipo: "DEPOSITO", fecha: "2026-09-10", monto: 10, moneda: "ARS" },
      beto,
    );
    expect(enAjena.status).toBe(404);
    expect(enAjena.body.error.mensaje).toBe("No se encontró la cartera.");
    const deAna = await request(prueba.app).get("/api/operaciones").set(auth(ana));
    const id = (deAna.body as Pagina<OperacionDto>).items[0]?.id;
    expect((await request(prueba.app).get(`/api/operaciones/${id}`).set(auth(beto))).status).toBe(
      404,
    );
    expect(
      (await request(prueba.app).delete(`/api/operaciones/${id}`).set(auth(beto))).status,
    ).toBe(404);
    expect((await request(prueba.app).get("/api/operaciones").set(auth(beto))).body.items).toEqual(
      [],
    );
  });

  it("aislamiento: otro no puede editar ni simular sobre operaciones ajenas", async () => {
    const deAna = await request(prueba.app).get("/api/operaciones").set(auth(ana)).expect(200);
    const original = (deAna.body as Pagina<OperacionDto>).items[0] as OperacionDto;
    const edicion = {
      tipo: "DEPOSITO",
      fecha: "2026-09-10",
      monto: 999,
      moneda: "ARS",
    };
    const editar = await request(prueba.app)
      .patch(`/api/operaciones/${original.id}`)
      .set(auth(beto))
      .send(edicion);
    expect(editar.status).toBe(404);
    const despues = await request(prueba.app)
      .get(`/api/operaciones/${original.id}`)
      .set(auth(ana))
      .expect(200);
    expect(despues.body).toEqual(original);
    const simularEditar = await request(prueba.app)
      .post("/api/operaciones/simular")
      .set(auth(beto))
      .send({ accion: "editar", id: original.id, operacion: edicion });
    expect(simularEditar.status).toBe(404);
    const simularBorrar = await request(prueba.app)
      .post("/api/operaciones/simular")
      .set(auth(beto))
      .send({ accion: "borrar", id: original.id });
    expect(simularBorrar.status).toBe(404);
  });

  it("aislamiento: no se puede usar una cuenta de otro usuario", async () => {
    const cuentaDeBeto = await request(prueba.app)
      .post("/api/cuentas")
      .set(auth(beto))
      .send({ broker: "Balanz" })
      .expect(201);
    const antes = await prueba.bd.operacion.count();
    const respuesta = await crear({
      tipo: "DEPOSITO",
      cuentaId: cuentaDeBeto.body.id,
      fecha: "2026-09-10",
      monto: 10,
      moneda: "ARS",
    });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró la cuenta.");
    expect(await prueba.bd.operacion.count()).toBe(antes);
  });

  it("un activo inexistente da 404 en castellano", async () => {
    const respuesta = await crear({
      tipo: "COMPRA",
      instrumentoId: "no-existe",
      fecha: "2026-09-10",
      cantidad: 1,
      precio: 1,
      moneda: "ARS",
    });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró el activo.");
  });

  it("vender en partes con precio promedio deja la tenencia exacta y se puede vender todo", async () => {
    const carla = await registrarUsuario(prueba.app);
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(carla)).expect(200);
    const carteraCarla = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    const operar = (cuerpo: object) =>
      request(prueba.app)
        .post("/api/operaciones")
        .set(auth(carla))
        .send({
          carteraId: carteraCarla,
          instrumentoId: amzn,
          moneda: "USD_MEP",
          tipoCambio: 1500,
          ...cuerpo,
        });
    const pasos = [
      { tipo: "COMPRA", fecha: "2026-09-10", cantidad: 1, precio: 1.5 },
      { tipo: "COMPRA", fecha: "2026-09-11", cantidad: 2, precio: 1.7 },
      { tipo: "VENTA", fecha: "2026-09-14", cantidad: 2, precio: 1.8 },
      { tipo: "VENTA", fecha: "2026-09-15", cantidad: 1, precio: 1.9 },
    ];
    for (const paso of pasos) expect((await operar(paso)).status).toBe(201);
    const resumen = await request(prueba.app)
      .get(`/api/resumen?carteraId=${carteraCarla}&moneda=USD`)
      .set(auth(carla))
      .expect(200);
    const tickers = (resumen.body as ResumenDto).tenencias.map((t) => t.ticker);
    expect(tickers).not.toContain("AMZN");
  });
});
