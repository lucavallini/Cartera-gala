import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/compartido/decimal";
import { ErrorValidacion } from "../../../src/compartido/errores";
import { HorarioMercado } from "../../../src/modulos/mercado/horario-mercado";
import { MercadoServicio } from "../../../src/modulos/mercado/mercado.servicio";
import type { InstrumentoCatalogado, PrecioManual } from "../../../src/modulos/instrumentos";
import { AHORA_FIXTURES, crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";
import { leerFixture, type RespuestaFalsa } from "../../utilidades/http-falso";

const ZONA = "America/Argentina/Buenos_Aires";

function instrumento(datos: Partial<InstrumentoCatalogado>): InstrumentoCatalogado {
  return {
    id: "i-amzn",
    ticker: "AMZN",
    nombre: null,
    tipo: "CEDEAR",
    familia: "CEDEARS",
    simbolos: { ARS: "AMZN", USD_MEP: "AMZND", USD_CCL: "AMZNC" },
    factorPrecio: new Decimal(1),
    tasaAnual: null,
    emisor: null,
    sector: null,
    ...datos,
  };
}

const AMZN = instrumento({});
const YM39 = instrumento({
  id: "i-ym39",
  ticker: "YM39O",
  tipo: "ON",
  familia: "OBLIGACIONES",
  simbolos: { ARS: "YM39O", USD_MEP: "YM39D" },
  factorPrecio: new Decimal("0.01"),
});
const RARO = instrumento({ id: "i-raro", ticker: "RARO", simbolos: { ARS: "RARO" } });

function crear(
  rutasExtra: Record<string, RespuestaFalsa> = {},
  manuales = new Map<string, PrecioManual>(),
) {
  const ahora = () => AHORA_FIXTURES;
  const p = crearProveedoresPrueba({ ahora, rutasExtra });
  const servicio = new MercadoServicio(
    p.cotizaciones,
    p.dolarActual,
    p.argentinaDatos,
    new HorarioMercado(p.argentinaDatos, ZONA, ahora),
    { preciosManuales: async () => manuales },
    ZONA,
    ahora,
  );
  return { servicio, buscar: p.buscar };
}

const caidas = (...urls: string[]) => Object.fromEntries(urls.map((u) => [u, new Error("caído")]));
const TODAS_LAS_LISTAS = [URLS.acciones, URLS.cedears, URLS.bonos, URLS.obligaciones, URLS.letras];

describe("precios vigentes", () => {
  it("junta el precio de cada moneda y la variación del día", async () => {
    const { servicio } = crear();
    const { precios, desactualizado, datosDe } = await servicio.precios("u1", [AMZN, YM39]);
    const amzn = precios.get("i-amzn");
    expect(amzn?.porMoneda.ARS?.toString()).toBe("2775");
    expect(amzn?.porMoneda.USD_MEP?.toString()).toBe("1.805");
    expect(amzn?.variacionPct?.toString()).toBe("-1.6");
    expect(amzn?.fuente).toBe("MERCADO");
    expect(precios.get("i-ym39")?.porMoneda.USD_MEP?.toString()).toBe("110.2");
    expect(desactualizado).toBe(false);
    expect(datosDe).toEqual(AHORA_FIXTURES);
  });

  it("sin cotización usa el precio manual del usuario", async () => {
    const manual: PrecioManual = {
      precio: new Decimal(500),
      moneda: "ARS",
      cargadoEn: new Date("2026-09-20T12:00:00Z"),
    };
    const { servicio } = crear({}, new Map([["i-raro", manual]]));
    const { precios } = await servicio.precios("u1", [RARO]);
    expect(precios.get("i-raro")).toMatchObject({
      fuente: "MANUAL",
      porMoneda: { ARS: new Decimal(500) },
    });
  });

  it("con data912 caído no falla: usa los manuales y marca desactualizado", async () => {
    const manual: PrecioManual = {
      precio: new Decimal(3000),
      moneda: "ARS",
      cargadoEn: AHORA_FIXTURES,
    };
    const { servicio } = crear(caidas(...TODAS_LAS_LISTAS), new Map([["i-amzn", manual]]));
    const resultado = await servicio.precios("u1", [AMZN, YM39]);
    expect(resultado.desactualizado).toBe(true);
    expect(resultado.datosDe).toBeNull();
    expect(resultado.precios.get("i-amzn")?.fuente).toBe("MANUAL");
    expect(resultado.precios.has("i-ym39")).toBe(false);
  });
});

describe("dólar", () => {
  it("valor vigente del dólar de referencia", async () => {
    const dolar = await crear().servicio.dolarVigente("MEP");
    expect(dolar.valor.toString()).toBe("1556.5");
    expect(dolar.desactualizado).toBe(false);
  });

  it("si dolarapi falla, usa el último valor histórico y lo marca", async () => {
    const dolar = await crear(caidas(URLS.dolares)).servicio.dolarVigente("MEP");
    expect(dolar.valor.toString()).toBe("1557.3");
    expect(dolar.desactualizado).toBe(true);
  });

  it("para una fecha pasada usa el último valor hasta ese día (fines de semana incluidos)", async () => {
    const { servicio } = crear();
    expect((await servicio.dolarEnFecha("MEP", "2026-09-15")).toString()).toBe("1536.7");
    expect((await servicio.dolarEnFecha("MEP", "2026-09-20")).toString()).toBe("1540.1");
  });

  it("con la serie del dólar desordenada, toma igual el valor del día correcto", async () => {
    const desordenado = [...(leerFixture("argentinadatos-bolsa.json") as unknown[])].reverse();
    const { servicio } = crear({ [URLS.mepHistorico]: { json: desordenado } });
    expect((await servicio.dolarEnFecha("MEP", "2026-09-15")).toString()).toBe("1536.7");
    expect((await servicio.dolarEnFecha("MEP", "2026-09-20")).toString()).toBe("1540.1");
  });

  it("para hoy usa el valor vigente", async () => {
    expect((await crear().servicio.dolarEnFecha("MEP", "2026-09-28")).toString()).toBe("1556.5");
  });

  it("para hoy, si los dos proveedores del dólar fallan, pide cargar el tipo de cambio a mano", async () => {
    const error = await crear(caidas(URLS.dolares, URLS.mepHistorico))
      .servicio.dolarEnFecha("MEP", "2026-09-28")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorValidacion);
    expect((error as ErrorValidacion).message).toBe(
      "No tenemos el valor del dólar para el 28/09/2026. Cargá el tipo de cambio a mano.",
    );
    expect((error as ErrorValidacion).detalles?.[0]?.campo).toBe("tipoCambio");
  });

  it("para una fecha sin datos pide cargar el tipo de cambio a mano", async () => {
    const error = await crear()
      .servicio.dolarEnFecha("MEP", "2026-09-13")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorValidacion);
    expect((error as ErrorValidacion).message).toBe(
      "No tenemos el valor del dólar para el 13/09/2026. Cargá el tipo de cambio a mano.",
    );
    expect((error as ErrorValidacion).detalles?.[0]?.campo).toBe("tipoCambio");
  });
});

describe("histórico de precios", () => {
  it("un CEDEAR operado en dólares se convierte con el dólar de cada día", async () => {
    const historico = await crear().servicio.historico(AMZN, "USD_MEP", "MEP");
    expect(historico.disponible).toBe(true);
    expect(historico.moneda).toBe("USD_MEP");
    const ultimo = historico.puntos.at(-1);
    expect(ultimo?.fecha).toBe("2026-09-25");
    expect(ultimo?.cierre.toFixed(4)).toBe("1.8245");
  });

  it("en pesos devuelve la serie tal cual", async () => {
    const historico = await crear().servicio.historico(AMZN, "ARS", "MEP");
    expect(historico.puntos.at(-1)?.cierre.toString()).toBe("2820");
  });

  it("un día sin dólar propio usa el del día anterior; antes del primer dólar se descarta", async () => {
    // La serie del dólar arranca después del primer punto de AMZN (2026-09-14, sin dólar previo)
    // y no trae el 2026-09-22 (día hábil de AMZN sin dólar propio: usa el del 2026-09-21).
    const dolares = [
      { casa: "bolsa", compra: 1594, venta: 1600, fecha: "2026-09-15" },
      { casa: "bolsa", compra: 1595, venta: 1601, fecha: "2026-09-16" },
      { casa: "bolsa", compra: 1596, venta: 1602, fecha: "2026-09-17" },
      { casa: "bolsa", compra: 1597, venta: 1603, fecha: "2026-09-18" },
      { casa: "bolsa", compra: 1598, venta: 1604, fecha: "2026-09-21" },
      { casa: "bolsa", compra: 1599, venta: 1605, fecha: "2026-09-23" },
      { casa: "bolsa", compra: 1600, venta: 1606, fecha: "2026-09-24" },
      { casa: "bolsa", compra: 1601, venta: 1607, fecha: "2026-09-25" },
    ];
    const { servicio } = crear({ [URLS.mepHistorico]: { json: dolares } });
    const historico = await servicio.historico(AMZN, "USD_MEP", "MEP");
    expect(historico.disponible).toBe(true);
    // AMZN del 2026-09-22 cierra en 2840.0 (fixture); sin dólar propio ese día, se usa el del
    // 2026-09-21 (venta 1604): 2840.0 / 1604 = 1.7705735660847880299...
    const diaSinDolarPropio = historico.puntos.find((p) => p.fecha === "2026-09-22");
    expect(diaSinDolarPropio?.cierre.toFixed(4)).toBe("1.7706");
    // El primer punto de AMZN (2026-09-14) no tiene ningún dólar anterior o del mismo día: se descarta.
    expect(historico.puntos.find((p) => p.fecha === "2026-09-14")).toBeUndefined();
  });

  it("las ONs no tienen histórico y no se consulta la red", async () => {
    const { servicio, buscar } = crear();
    expect(await servicio.historico(YM39, "USD_MEP", "MEP")).toEqual({
      disponible: false,
      moneda: "USD_MEP",
      puntos: [],
    });
    expect(buscar.llamadas.filter((u) => u.includes("historical"))).toHaveLength(0);
  });
});

describe("estado del mercado", () => {
  it("abierto y al día", async () => {
    const estado = await crear().servicio.estado({
      datosDe: AHORA_FIXTURES,
      desactualizado: false,
    });
    expect(estado).toEqual({
      abierto: true,
      proximaActualizacionEn: "2026-09-28T18:01:00.000Z",
      datosDe: "2026-09-28T18:00:00.000Z",
      desactualizado: false,
      mensaje: "El mercado está abierto. Los precios se actualizan solos cada minuto.",
    });
  });

  it("con precios viejos lo dice con la hora argentina", async () => {
    const estado = await crear().servicio.estado({
      datosDe: new Date("2026-09-28T19:58:00Z"),
      desactualizado: true,
    });
    expect(estado.mensaje).toBe(
      "No pudimos actualizar los precios. Mostramos los de las 16:58 del 28/09.",
    );
  });

  it("sin ningún precio explica qué se usa en su lugar", async () => {
    const estado = await crear().servicio.estado({ datosDe: null, desactualizado: true });
    expect(estado.mensaje).toBe(
      "No pudimos obtener los precios del mercado. Se usan los precios que cargaste a mano o, si no hay, lo que pagaste.",
    );
  });
});
