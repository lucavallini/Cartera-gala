import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { ActivoDto, CarteraDto, InstrumentoDto, Pagina } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";
import { InstrumentosRepositorio } from "../../../src/modulos/instrumentos/instrumentos.repositorio";

describe("API de ficha del activo", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let amzn: string;
  let ym39: string;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  async function id(q: string) {
    const r = await request(prueba.app)
      .get(`/api/instrumentos/buscar?q=${q}`)
      .set(auth(ana))
      .expect(200);
    return ((r.body as InstrumentoDto[])[0] as InstrumentoDto).id;
  }

  async function ficha(instrumentoId: string): Promise<ActivoDto> {
    const r = await request(prueba.app)
      .get(`/api/activos/${instrumentoId}?moneda=USD`)
      .set(auth(ana));
    expect(r.status).toBe(200);
    return r.body as ActivoDto;
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(ana));
    const cartera = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    amzn = await id("AMZN");
    ym39 = await id("YM39O");
    const operar = (cuerpo: object) =>
      request(prueba.app)
        .post("/api/operaciones")
        .set(auth(ana))
        .send({ carteraId: cartera, moneda: "USD_MEP", ...cuerpo })
        .expect(201);
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: amzn,
      fecha: "2026-09-15",
      cantidad: 72,
      precio: 1.5,
    });
    await operar({
      tipo: "COMPRA",
      instrumentoId: amzn,
      fecha: "2026-09-22",
      cantidad: 28,
      precio: 1.8,
    });
    await operar({ tipo: "DIVIDENDO", instrumentoId: amzn, fecha: "2026-09-24", monto: 2 });
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: ym39,
      fecha: "2026-09-16",
      cantidad: 344,
      precio: 109.3,
    });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("muestra la tenencia, las operaciones (la más nueva primero) y el historial en la moneda del activo", async () => {
    const f = await ficha(amzn);
    expect(f.instrumento).toMatchObject({ ticker: "AMZN", tipoTexto: "CEDEAR" });
    expect(f.tenencia).toMatchObject({
      cantidad: 100,
      monedaPrecio: "USD_MEP",
      precioPromedio: 1.584,
      cobros: 2,
    });
    expect(f.operaciones.map((o) => o.tipo)).toEqual(["DIVIDENDO", "COMPRA", "TENENCIA_INICIAL"]);
    expect(f.historico).toMatchObject({ disponible: true, mensaje: null, moneda: "USD_MEP" });
    expect(f.historico.puntos.at(-1)).toEqual({ fecha: "2026-09-25", cierre: 1.824534 });
  });

  it("marca en el historial solo las compras, ventas y tenencias iniciales", async () => {
    const f = await ficha(amzn);
    expect(f.historico.marcas).toEqual([
      {
        fecha: "2026-09-15",
        tipo: "TENENCIA_INICIAL",
        tipoTexto: "Tenencia inicial",
        cantidad: 72,
        precio: 1.5,
      },
      { fecha: "2026-09-22", tipo: "COMPRA", tipoTexto: "Compra", cantidad: 28, precio: 1.8 },
    ]);
  });

  it("si no hay historial lo explica en lenguaje llano", async () => {
    const f = await ficha(ym39);
    expect(f.historico).toMatchObject({
      disponible: false,
      mensaje: "Todavía no tenemos el historial de precios de este activo.",
      puntos: [],
    });
    expect(f.tenencia?.cantidad).toBe(344);
  });

  it("un activo que no se tiene muestra su ficha sin tenencia", async () => {
    const f = await ficha(await id("GGAL"));
    expect(f.tenencia).toBeNull();
    expect(f.operaciones).toEqual([]);
  });

  it("un activo con tenencia lee el instrumento una sola vez", async () => {
    const espia = vi.spyOn(InstrumentosRepositorio.prototype, "buscarPorId");
    espia.mockClear();
    const f = await ficha(amzn);
    expect(f.instrumento.ticker).toBe("AMZN");
    // Ya viene del catálogo del cálculo (tiene tenencia): no hace falta leerlo de nuevo.
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it("un activo inexistente da 404 en castellano", async () => {
    const r = await request(prueba.app).get("/api/activos/no-existe").set(auth(ana));
    expect(r.status).toBe(404);
    expect(r.body.error.mensaje).toBe("No se encontró el activo.");
  });

  it("la ficha de un activo vendido por completo muestra el resultado y los cobros", async () => {
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(ana));
    const cartera = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    const pamp = await id("PAMP");
    const operar = (cuerpo: object) =>
      request(prueba.app)
        .post("/api/operaciones")
        .set(auth(ana))
        .send({ carteraId: cartera, moneda: "USD_MEP", instrumentoId: pamp, ...cuerpo })
        .expect(201);
    await operar({ tipo: "COMPRA", fecha: "2026-09-15", cantidad: 50, precio: 2 });
    await operar({ tipo: "DIVIDENDO", fecha: "2026-09-16", monto: 5 });
    await operar({ tipo: "VENTA", fecha: "2026-09-22", cantidad: 50, precio: 2.5 });
    const f = await ficha(pamp);
    // Compra 50 a US$2 = costo US$100. Venta 50 a US$2,5 = cobrado US$125.
    // Realizado = 125 − 100 = US$25. Cobros = US$5 (dividendo).
    expect(f.tenencia).toBeNull();
    expect(f.resultado).toMatchObject({ realizado: 25, cobros: 5 });
    expect(f.resultado.explicacion).not.toMatch(/undefined|null|NaN/);
    expect(f.operaciones).toHaveLength(3);
    expect(f.operaciones[0]?.moneda).toBe("USD_MEP");
    // Sin tenencia no hay monedaPrecio: el histórico usa la moneda de la última operación.
    expect(f.historico.moneda).toBe("USD_MEP");
  });
});

describe("API de ficha del activo: aislamiento entre usuarios", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  let amzn: string;
  let carteraDeAna: string;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(ana));
    carteraDeAna = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    const busqueda = await request(prueba.app)
      .get("/api/instrumentos/buscar?q=AMZN")
      .set(auth(ana))
      .expect(200);
    amzn = ((busqueda.body as InstrumentoDto[])[0] as InstrumentoDto).id;
    await request(prueba.app)
      .post("/api/operaciones")
      .set(auth(ana))
      .send({
        carteraId: carteraDeAna,
        moneda: "USD_MEP",
        instrumentoId: amzn,
        tipo: "TENENCIA_INICIAL",
        fecha: "2026-09-15",
        cantidad: 10,
        precio: 1.5,
      })
      .expect(201);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("otro usuario pide la ficha de un activo de Ana: sin tenencia, sin operaciones y resultado en cero", async () => {
    const r = await request(prueba.app).get(`/api/activos/${amzn}`).set(auth(beto));
    expect(r.status).toBe(200);
    const f = r.body as ActivoDto;
    expect(f.tenencia).toBeNull();
    expect(f.operaciones).toEqual([]);
    expect(f.resultado).toMatchObject({ realizado: 0, cobros: 0 });
  });

  it("otro usuario pide la cartera de Ana por carteraId: 404 en castellano", async () => {
    const r = await request(prueba.app)
      .get(`/api/activos/${amzn}?carteraId=${carteraDeAna}`)
      .set(auth(beto));
    expect(r.status).toBe(404);
    expect(r.body.error.mensaje).toMatch(/cartera/i);
  });
});
