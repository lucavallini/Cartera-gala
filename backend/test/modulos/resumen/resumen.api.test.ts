import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CarteraDto, InstrumentoDto, Pagina, ResumenDto } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";
import { crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";

const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

async function idDe(prueba: AppPrueba, usuario: UsuarioLogueado, ticker: string): Promise<string> {
  const respuesta = await request(prueba.app)
    .get(`/api/instrumentos/buscar?q=${ticker}`)
    .set(auth(usuario))
    .expect(200);
  const [primero] = respuesta.body as InstrumentoDto[];
  if (!primero) throw new Error(`sin ${ticker}`);
  return primero.id;
}

async function principal(prueba: AppPrueba, usuario: UsuarioLogueado): Promise<string> {
  const respuesta = await request(prueba.app).get("/api/carteras").set(auth(usuario)).expect(200);
  return ((respuesta.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
}

describe("API de resumen", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  let carteraAna: string;

  async function resumen(usuario: UsuarioLogueado, consulta = "?moneda=USD"): Promise<ResumenDto> {
    const respuesta = await request(prueba.app).get(`/api/resumen${consulta}`).set(auth(usuario));
    expect(respuesta.status).toBe(200);
    return respuesta.body as ResumenDto;
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
    carteraAna = await principal(prueba, ana);
    const operar = (cuerpo: object) =>
      request(prueba.app)
        .post("/api/operaciones")
        .set(auth(ana))
        .send({ carteraId: carteraAna, moneda: "USD_MEP", ...cuerpo })
        .expect(201);
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: await idDe(prueba, ana, "AMZN"),
      fecha: "2026-09-15",
      cantidad: 72,
      precio: 1.5,
    });
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: await idDe(prueba, ana, "YM39O"),
      fecha: "2026-09-16",
      cantidad: 344,
      precio: 109.3,
    });
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: await idDe(prueba, ana, "YPFD"),
      fecha: "2026-09-16",
      cantidad: 50,
      precio: 3.89,
    });
    const pamp = await idDe(prueba, ana, "PAMP");
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: pamp,
      fecha: "2026-09-14",
      cantidad: 55,
      precio: 3.51,
    });
    await operar({
      tipo: "VENTA",
      instrumentoId: pamp,
      fecha: "2026-09-22",
      cantidad: 55,
      precio: 3.3,
    });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("arma la frase con los números reales de la cartera", async () => {
    const r = await resumen(ana);
    expect(r.frase).toBe(
      "Tu cartera vale US$ 777 (≈ $ 1,2 M). Desde que empezaste ganaste US$ 87 (+9,9%). Hoy bajó 0,5%.",
    );
    expect(r).toMatchObject({ moneda: "USD", carteraId: null, vacio: false, avisos: [] });
    expect(r.dolar).toMatchObject({ tipo: "MEP", valor: 1556.5, desactualizado: false });
    expect(r.mercado).toMatchObject({ abierto: true, desactualizado: false });
  });

  it("tarjetas con explicación, valor, porcentaje y tono", async () => {
    const tarjetas = Object.fromEntries((await resumen(ana)).tarjetas.map((t) => [t.clave, t]));
    expect(tarjetas["valorActual"]).toMatchObject({
      titulo: "Valor actual",
      explicacion: "Lo que vale hoy todo lo que tenés.",
      valor: 776.55,
      tono: "neutro",
    });
    expect(tarjetas["invertido"]).toMatchObject({ valor: 678.49 });
    expect(tarjetas["noRealizado"]).toMatchObject({
      valor: 98.06,
      porcentaje: 14.45,
      tono: "positivo",
      explicacion: "Lo que ganarías (o perderías) si vendieras todo hoy.",
    });
    expect(tarjetas["realizado"]).toMatchObject({ valor: -11.55, tono: "negativo" });
    expect(tarjetas["cobros"]).toMatchObject({ valor: 0, tono: "neutro" });
    expect(tarjetas["rendimiento"]).toMatchObject({
      valor: 86.51,
      porcentaje: 9.93,
      tono: "positivo",
    });
    expect(tarjetas["variacionDiaria"]).toMatchObject({
      valor: -3.98,
      porcentaje: -0.51,
      tono: "negativo",
      explicacion:
        "Cuánto cambió hoy el valor de tu cartera. La variación es la del activo en pesos.",
    });
  });

  it("las tenencias van de mayor a menor valor y un activo vendido por completo no aparece", async () => {
    const { tenencias } = await resumen(ana);
    expect(tenencias.map((t) => t.ticker)).toEqual(["YM39O", "YPFD", "AMZN"]);
    expect(tenencias[1]).toMatchObject({
      ticker: "YPFD",
      tipoTexto: "Acción",
      cantidad: 50,
      monedaPrecio: "USD_MEP",
      precioPromedio: 3.89,
      precioActual: 5.35,
      valor: 267.5,
      invertido: 194.5,
      resultado: 73,
      resultadoPct: 37.53,
      peso: 34.45,
      sinCotizacion: false,
      fuentePrecio: "MERCADO",
      explicacionPrecio: "Cotiza por unidad: el valor es cantidad × precio.",
      monedaPrecioTexto: "Dólar MEP",
    });
    expect(tenencias[0]?.explicacionPrecio).toBe(
      "Cotiza cada 100 nominales: el valor es cantidad × precio ÷ 100.",
    );
  });

  it("ponderaciones por activo y por tipo", async () => {
    const { ponderaciones } = await resumen(ana);
    expect(ponderaciones.porTipo.map((p) => [p.etiqueta, p.porcentaje])).toEqual([
      ["Obligación negociable", 48.82],
      ["Acción", 34.45],
      ["CEDEAR", 16.74],
    ]);
    expect(ponderaciones.porActivo[0]).toMatchObject({ etiqueta: "YM39O", porcentaje: 48.82 });
  });

  it("en pesos convierte con el dólar de referencia", async () => {
    const r = await resumen(ana, "?moneda=ARS");
    expect(r.tarjetas.find((t) => t.clave === "valorActual")?.valor).toBe(1208696.96);
  });

  it("sin moneda usa la base del usuario (dólares por defecto)", async () => {
    expect((await resumen(ana, "")).moneda).toBe("USD");
  });

  it("filtra por cartera y muestra el efectivo cuando hay depósitos", async () => {
    const otra = await request(prueba.app)
      .post("/api/carteras")
      .set(auth(ana))
      .send({ nombre: "Ahorro" })
      .expect(201);
    await request(prueba.app)
      .post("/api/operaciones")
      .set(auth(ana))
      .send({
        carteraId: otra.body.id,
        tipo: "DEPOSITO",
        fecha: "2026-09-20",
        monto: 1000,
        moneda: "USD_MEP",
      })
      .expect(201);
    const r = await resumen(ana, `?moneda=USD&carteraId=${otra.body.id}`);
    expect(r.tenencias).toEqual([]);
    expect(r.efectivo).toEqual({
      valor: 1000,
      detalle: [{ moneda: "USD_MEP", monedaTexto: "Dólar MEP", monto: 1000 }],
    });
    expect(r.vacio).toBe(false);
  });

  it("el efectivo negativo avisa con el nombre llano de cada moneda, sin avisos repetidos", async () => {
    const dana = await registrarUsuario(prueba.app);
    const carteraDana = await principal(prueba, dana);
    const operar = (cuerpo: object) =>
      request(prueba.app)
        .post("/api/operaciones")
        .set(auth(dana))
        .send({ carteraId: carteraDana, ...cuerpo })
        .expect(201);
    await operar({ tipo: "EXTRACCION", fecha: "2026-09-20", monto: 100, moneda: "USD_MEP" });
    await operar({ tipo: "EXTRACCION", fecha: "2026-09-20", monto: 50, moneda: "USD_CCL" });
    const r = await resumen(dana);
    expect(r.avisos).toContain(
      "Tu efectivo en dólar MEP da negativo: puede faltar registrar algún depósito.",
    );
    expect(r.avisos).toContain(
      "Tu efectivo en dólar cable da negativo: puede faltar registrar algún depósito.",
    );
    expect(r.avisos.some((a) => a.includes("dólares"))).toBe(false);
    expect(new Set(r.avisos).size).toBe(r.avisos.length);
  });

  it("vendiste todo un activo: no es un resumen vacío y se ve el resultado realizado", async () => {
    const carla = await registrarUsuario(prueba.app);
    const carteraCarla = await principal(prueba, carla);
    const pamp = await idDe(prueba, carla, "PAMP");
    const operar = (cuerpo: object) =>
      request(prueba.app)
        .post("/api/operaciones")
        .set(auth(carla))
        .send({ carteraId: carteraCarla, moneda: "USD_MEP", ...cuerpo })
        .expect(201);
    await operar({
      tipo: "TENENCIA_INICIAL",
      instrumentoId: pamp,
      fecha: "2026-09-14",
      cantidad: 55,
      precio: 3.51,
    });
    await operar({
      tipo: "VENTA",
      instrumentoId: pamp,
      fecha: "2026-09-22",
      cantidad: 55,
      precio: 3.3,
    });
    const r = await resumen(carla);
    expect(r.vacio).toBe(false);
    expect(r.tenencias).toEqual([]);
    // Cálculo a mano (dólar "bolsa" venta de los fixtures: 14/09 = 1539.9, 22/09 = 1536.5):
    // costo = 55×3.51 = 193.05 USD ($ 297.277,695 al 1539,9); cobrado = 55×3.3 = 181.5 USD
    // ($ 278.874,75 al 1536,5); realizado = 181.5 − 193.05 = −11,55 USD ($ −18.402,945).
    // Sin posiciones vivas ni efectivo: valor = US$ 0 (≈ $ 0). rendimiento% = −11,55 / 193,05 × 100
    // = −5,98…% → "-6,0%" redondeado a un decimal. variación diaria: sin posiciones vivas, base
    // cero → null → no hay tercera frase.
    expect(r.frase).toBe(
      "Tu cartera vale US$ 0 (≈ $ 0). Desde que empezaste perdiste US$ 12 (-6,0%).",
    );
    const realizado = r.tarjetas.find((t) => t.clave === "realizado");
    expect(realizado).toMatchObject({ valor: -11.55, tono: "negativo" });
  });

  it("un usuario sin operaciones ve la invitación a empezar", async () => {
    const r = await resumen(beto);
    expect(r.vacio).toBe(true);
    expect(r.frase).toBe("Todavía no cargaste activos. Empezá con «Agregar activo que ya tengo».");
    expect(r.tenencias).toEqual([]);
  });

  it("no deja ver el resumen de una cartera ajena", async () => {
    const respuesta = await request(prueba.app)
      .get(`/api/resumen?carteraId=${carteraAna}`)
      .set(auth(beto));
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró la cartera.");
  });
});

describe("API de resumen con data912 caído", () => {
  it("se arma igual: valúa al precio manual o al costo, y avisa", async () => {
    const caido = new Error("ECONNREFUSED");
    const proveedores = crearProveedoresPrueba({
      rutasExtra: Object.fromEntries(
        [URLS.acciones, URLS.cedears, URLS.bonos, URLS.obligaciones, URLS.letras].map((u) => [
          u,
          caido,
        ]),
      ),
    });
    const prueba = await crearAppPrueba({}, { proveedores });
    try {
      const usuario = await registrarUsuario(prueba.app);
      const cartera = await principal(prueba, usuario);
      // Sin data912 no hay catálogo: se cargan dos activos directo en la base.
      const crearInstrumento = (ticker: string) =>
        prueba.bd.instrumento.create({
          data: { ticker, tipo: "CEDEAR", mercado: "BYMA", simbolos: { ARS: ticker } },
        });
      const amzn = await crearInstrumento("AMZN");
      const msft = await crearInstrumento("MSFT");
      for (const instrumento of [amzn, msft]) {
        await request(prueba.app)
          .post("/api/operaciones")
          .set(auth(usuario))
          .send({
            carteraId: cartera,
            tipo: "TENENCIA_INICIAL",
            instrumentoId: instrumento.id,
            fecha: "2026-09-15",
            cantidad: 10,
            precio: 1000,
            moneda: "ARS",
          })
          .expect(201);
      }
      await request(prueba.app)
        .put(`/api/instrumentos/${amzn.id}/precio-manual`)
        .set(auth(usuario))
        .send({ precio: 1200, moneda: "ARS" })
        .expect(200);

      const respuesta = await request(prueba.app).get("/api/resumen?moneda=ARS").set(auth(usuario));
      expect(respuesta.status).toBe(200);
      const r = respuesta.body as ResumenDto;
      const porTicker = Object.fromEntries(r.tenencias.map((t) => [t.ticker, t]));
      expect(porTicker["AMZN"]).toMatchObject({
        fuentePrecio: "MANUAL",
        valor: 12000,
        sinCotizacion: false,
      });
      expect(porTicker["MSFT"]).toMatchObject({
        fuentePrecio: "COSTO",
        valor: 10000,
        sinCotizacion: true,
      });
      expect(r.mercado.desactualizado).toBe(true);
      expect(r.avisos).toEqual([
        "No pudimos obtener los precios del mercado. Se usan los precios que cargaste a mano o, si no hay, lo que pagaste.",
        "No encontramos precio de mercado para MSFT: se muestra lo que pagaste. Podés cargar un precio a mano desde la ficha del activo.",
        "AMZN usa el precio que cargaste a mano el 28/09/2026.",
      ]);
      expect(JSON.stringify(r)).not.toMatch(/ECONNREFUSED|data912/);
    } finally {
      await prueba.cerrar();
    }
  });

  it("el aviso del precio manual usa el día de Argentina, no el día UTC", async () => {
    // 23:30 del 27/09 en Argentina (UTC-3) = 02:30 UTC del 28/09: el día UTC "adelanta" un día.
    const ahora = () => new Date("2026-09-28T02:30:00Z");
    const prueba = await crearAppPrueba({}, { ahora });
    try {
      const usuario = await registrarUsuario(prueba.app);
      const cartera = await principal(prueba, usuario);
      // Instrumento propio, sin cotización de mercado, para forzar la fuente MANUAL.
      const instrumento = await prueba.bd.instrumento.create({
        data: { ticker: "ZZZ", tipo: "CEDEAR", mercado: "BYMA", simbolos: { ARS: "ZZZ" } },
      });
      await request(prueba.app)
        .post("/api/operaciones")
        .set(auth(usuario))
        .send({
          carteraId: cartera,
          tipo: "TENENCIA_INICIAL",
          instrumentoId: instrumento.id,
          fecha: "2026-09-15",
          cantidad: 10,
          precio: 1000,
          moneda: "ARS",
        })
        .expect(201);
      await request(prueba.app)
        .put(`/api/instrumentos/${instrumento.id}/precio-manual`)
        .set(auth(usuario))
        .send({ precio: 1200, moneda: "ARS" })
        .expect(200);

      const respuesta = await request(prueba.app).get("/api/resumen?moneda=ARS").set(auth(usuario));
      expect(respuesta.status).toBe(200);
      const r = respuesta.body as ResumenDto;
      // hoyEn("America/Argentina/Buenos_Aires", 2026-09-28T02:30:00Z) = "2026-09-27" (día UTC: 28).
      expect(r.avisos).toContain("ZZZ usa el precio que cargaste a mano el 27/09/2026.");
    } finally {
      await prueba.cerrar();
    }
  });
});

describe("API de resumen con el dólar caído", () => {
  const caidas = () =>
    crearProveedoresPrueba({
      rutasExtra: {
        [URLS.dolares]: new Error("ECONNREFUSED"),
        [URLS.mepHistorico]: new Error("ECONNREFUSED"),
      },
    });

  it("con el dólar caído (dolarapi y argentinadatos) el resumen se arma igual con el último tipo de cambio cargado y avisa", async () => {
    const prueba = await crearAppPrueba({}, { proveedores: caidas() });
    try {
      const usuario = await registrarUsuario(prueba.app);
      const cartera = await principal(prueba, usuario);
      const amzn = await idDe(prueba, usuario, "AMZN");
      const operar = (cuerpo: object) =>
        request(prueba.app)
          .post("/api/operaciones")
          .set(auth(usuario))
          .send({ carteraId: cartera, instrumentoId: amzn, moneda: "USD_MEP", ...cuerpo })
          .expect(201);
      // La más reciente por fecha es la del 20/09 (se carga primero para no confundir con el orden de carga).
      await operar({
        tipo: "COMPRA",
        fecha: "2026-09-20",
        cantidad: 10,
        precio: 1.8,
        tipoCambio: 1540,
      });
      await operar({
        tipo: "TENENCIA_INICIAL",
        fecha: "2026-09-15",
        cantidad: 10,
        precio: 1.5,
        tipoCambio: 1500,
      });

      const respuesta = await request(prueba.app).get("/api/resumen?moneda=USD").set(auth(usuario));
      expect(respuesta.status).toBe(200);
      const r = respuesta.body as ResumenDto;
      expect(r.dolar).toMatchObject({ tipo: "MEP", valor: 1540, desactualizado: true });
      expect(r.avisos).toContain(
        "No pudimos obtener el dólar: usamos el último tipo de cambio de tus operaciones ($ 1.540,00 del 20/09/2026).",
      );
      expect(r.tenencias.map((t) => t.ticker)).toEqual(["AMZN"]);
      expect(JSON.stringify(r)).not.toMatch(/ECONNREFUSED|dolarapi|argentinadatos/);

      const ficha = await request(prueba.app)
        .get(`/api/activos/${amzn}?moneda=USD`)
        .set(auth(usuario));
      expect(ficha.status).toBe(200);
      expect(ficha.body.tenencia).toMatchObject({ ticker: "AMZN", cantidad: 20 });
    } finally {
      await prueba.cerrar();
    }
  });

  it("un resumen vacío responde aunque el dólar esté caído", async () => {
    const prueba = await crearAppPrueba({}, { proveedores: caidas() });
    try {
      const usuario = await registrarUsuario(prueba.app);
      const respuesta = await request(prueba.app).get("/api/resumen?moneda=USD").set(auth(usuario));
      expect(respuesta.status).toBe(200);
      const r = respuesta.body as ResumenDto;
      expect(r.vacio).toBe(true);
      expect(r.dolar).toBeNull();
    } finally {
      await prueba.cerrar();
    }
  });
});
