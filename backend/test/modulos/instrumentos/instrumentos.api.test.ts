import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { InstrumentoDto } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarAdmin,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";
import { InstrumentosRepositorio } from "../../../src/modulos/instrumentos/instrumentos.repositorio";
import { AHORA_FIXTURES, crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";

describe("API de instrumentos", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  async function buscar(q: string, usuario = ana): Promise<InstrumentoDto[]> {
    const respuesta = await request(prueba.app)
      .get(`/api/instrumentos/buscar?q=${encodeURIComponent(q)}`)
      .set(auth(usuario))
      .expect(200);
    return respuesta.body as InstrumentoDto[];
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("busca por parte del ticker y explica cómo cotiza", async () => {
    const [amzn] = await buscar("amz");
    expect(amzn).toMatchObject({
      ticker: "AMZN",
      tipo: "CEDEAR",
      tipoTexto: "CEDEAR",
      monedas: ["ARS", "USD_MEP", "USD_CCL"],
      factorPrecio: 1,
      explicacionPrecio: "Cotiza por unidad: el valor es cantidad × precio.",
      precioManual: null,
    });
  });

  it("buscar el símbolo en dólares encuentra la ON por su ticker en O", async () => {
    const [primero] = await buscar("YM39D");
    expect(primero).toMatchObject({
      ticker: "YM39O",
      tipoTexto: "Obligación negociable",
      factorPrecio: 0.01,
      explicacionPrecio: "Cotiza cada 100 nominales: el valor es cantidad × precio ÷ 100.",
    });
  });

  it("sincroniza el catálogo una sola vez (no en cada búsqueda)", async () => {
    await buscar("GGAL");
    await buscar("PAMP");
    const listas = prueba.buscar.llamadas.filter((url) => url.includes("/live/"));
    expect(listas).toHaveLength(5);
  });

  it("sin texto de búsqueda responde un 400 explicado", async () => {
    const respuesta = await request(prueba.app)
      .get("/api/instrumentos/buscar?q=%20")
      .set(auth(ana));
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].mensaje).toBe("Escribí el ticker o parte del ticker.");
  });

  it("un activo inexistente da 404 en castellano", async () => {
    const respuesta = await request(prueba.app).get("/api/instrumentos/no-existe").set(auth(ana));
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró el activo.");
  });

  it("el precio manual es de cada usuario y se puede quitar", async () => {
    const [ym39] = await buscar("YM39O");
    const ruta = `/api/instrumentos/${ym39?.id}/precio-manual`;
    const fijado = await request(prueba.app)
      .put(ruta)
      .set(auth(ana))
      .send({ precio: 108.5, moneda: "USD_MEP" });
    expect(fijado.status).toBe(200);
    expect(fijado.body.precioManual).toMatchObject({ precio: 108.5, moneda: "USD_MEP" });
    const [vistoPorBeto] = await buscar("YM39O", beto);
    expect(vistoPorBeto?.precioManual).toBeNull();
    const quitado = await request(prueba.app).delete(ruta).set(auth(ana));
    expect(quitado.body.precioManual).toBeNull();
  });

  it("el precio manual se valida con mensajes llanos", async () => {
    const [ym39] = await buscar("YM39O");
    const respuesta = await request(prueba.app)
      .put(`/api/instrumentos/${ym39?.id}/precio-manual`)
      .set(auth(ana))
      .send({ precio: -3, moneda: "EUR" });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles.map((d: { mensaje: string }) => d.mensaje)).toEqual([
      "Tiene que ser un número mayor a cero.",
      "Elegí la moneda: pesos, dólar MEP, dólar cable o dólar del exterior.",
    ]);
  });

  it("solo un administrador puede editar los datos del catálogo", async () => {
    const [amzn] = await buscar("AMZN");
    const ruta = `/api/instrumentos/${amzn?.id}`;
    const comoUsuario = await request(prueba.app)
      .patch(ruta)
      .set(auth(ana))
      .send({ nombre: "Amazon" });
    expect(comoUsuario.status).toBe(403);
    expect(comoUsuario.body.error.mensaje).toBe(
      "Solo un administrador puede cambiar los datos del catálogo.",
    );
    const admin = await registrarAdmin(prueba);
    const comoAdmin = await request(prueba.app)
      .patch(ruta)
      .set(auth(admin))
      .send({ nombre: "Amazon", sector: "Comercio" });
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body).toMatchObject({ nombre: "Amazon", sector: "Comercio" });
  });
});

describe("API de instrumentos sin data912", () => {
  it("con el catálogo vacío y data912 caído, explica el problema sin detalles técnicos", async () => {
    const caido = new Error("getaddrinfo ENOTFOUND data912.com");
    const proveedores = crearProveedoresPrueba({
      rutasExtra: Object.fromEntries(
        [URLS.acciones, URLS.cedears, URLS.bonos, URLS.obligaciones, URLS.letras].map((u) => [
          u,
          caido,
        ]),
      ),
    });
    const prueba = await crearAppPrueba({}, { proveedores });
    const usuario = await registrarUsuario(prueba.app);
    const respuesta = await request(prueba.app)
      .get("/api/instrumentos/buscar?q=AMZN")
      .set({ Authorization: `Bearer ${usuario.token}` });
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.error.mensaje).toBe(
      "No pudimos obtener los precios del mercado. Probá de nuevo en unos minutos.",
    );
    expect(JSON.stringify(respuesta.body)).not.toMatch(/ENOTFOUND|data912/);
    await prueba.cerrar();
  });
});

describe("API de instrumentos: sincronización del catálogo", () => {
  it("búsquedas simultáneas con el catálogo vacío comparten una sola sincronización", async () => {
    // En producción la transacción de más de mil altas tarda: se simula con una demora.
    const original = InstrumentosRepositorio.prototype.sincronizar;
    const espia = vi
      .spyOn(InstrumentosRepositorio.prototype, "sincronizar")
      .mockImplementation(async function (this: InstrumentosRepositorio, items) {
        await new Promise((resolver) => setTimeout(resolver, 200));
        return original.call(this, items);
      });
    const prueba = await crearAppPrueba();
    try {
      const usuario = await registrarUsuario(prueba.app);
      const respuestas = await Promise.all(
        ["AMZN", "GGAL", "PAMP"].map((q) =>
          request(prueba.app)
            .get(`/api/instrumentos/buscar?q=${q}`)
            .set({ Authorization: `Bearer ${usuario.token}` }),
        ),
      );
      expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(espia).toHaveBeenCalledTimes(1);
    } finally {
      espia.mockRestore();
      await prueba.cerrar();
    }
  });

  it("si alguna lista vino incompleta, vuelve a sincronizar pasada la espera (no a las 24 h)", async () => {
    const espia = vi.spyOn(InstrumentosRepositorio.prototype, "sincronizar");
    let reloj = AHORA_FIXTURES;
    const ahora = () => reloj;
    const proveedores = crearProveedoresPrueba({
      ahora,
      rutasExtra: { [URLS.letras]: [new Error("ECONNREFUSED"), { json: [] }] },
    });
    const prueba = await crearAppPrueba({}, { proveedores, ahora });
    try {
      const usuario = await registrarUsuario(prueba.app);
      const buscar = (q: string) =>
        request(prueba.app)
          .get(`/api/instrumentos/buscar?q=${q}`)
          .set({ Authorization: `Bearer ${usuario.token}` })
          .expect(200);
      await buscar("AMZN");
      await buscar("GGAL");
      expect(espia).toHaveBeenCalledTimes(1);
      reloj = new Date(AHORA_FIXTURES.getTime() + 61_000);
      await buscar("PAMP");
      expect(espia).toHaveBeenCalledTimes(2);
      // Esta vez las listas vinieron completas: queda vigente por un día.
      reloj = new Date(AHORA_FIXTURES.getTime() + 200_000);
      await buscar("YPFD");
      expect(espia).toHaveBeenCalledTimes(2);
    } finally {
      espia.mockRestore();
      await prueba.cerrar();
    }
  });
});
