import { Data912Proveedor } from "../../src/proveedores/cotizaciones/data912.proveedor";
import { DolarApiProveedor } from "../../src/proveedores/dolar/dolarapi.proveedor";
import { ArgentinaDatosProveedor } from "../../src/proveedores/dolar/argentinadatos.proveedor";
import { crearBuscarFalso, leerFixture, type BuscarFalso, type RespuestaFalsa } from "./http-falso";

export const URLS = {
  acciones: "https://data912.com/live/arg_stocks",
  cedears: "https://data912.com/live/arg_cedears",
  bonos: "https://data912.com/live/arg_bonds",
  obligaciones: "https://data912.com/live/arg_corp",
  letras: "https://data912.com/live/arg_notes",
  historicoAmzn: "https://data912.com/historical/cedears/AMZN",
  historicoYpfd: "https://data912.com/historical/stocks/YPFD",
  dolares: "https://dolarapi.com/v1/dolares",
  mepHistorico: "https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa",
  feriados2026: "https://api.argentinadatos.com/v1/feriados/2026",
} as const;

/** Mediodía de un lunes hábil (15:00 en Argentina), el día en que se tomaron los fixtures. */
export const AHORA_FIXTURES = new Date("2026-09-28T18:00:00Z");

export function rutasDeFixtures(): Record<string, RespuestaFalsa> {
  return {
    [URLS.acciones]: { json: leerFixture("data912-arg_stocks.json") },
    [URLS.cedears]: { json: leerFixture("data912-arg_cedears.json") },
    [URLS.bonos]: { json: leerFixture("data912-arg_bonds.json") },
    [URLS.obligaciones]: { json: leerFixture("data912-arg_corp.json") },
    [URLS.letras]: { json: leerFixture("data912-arg_notes.json") },
    [URLS.historicoAmzn]: { json: leerFixture("data912-historico-cedears-AMZN.json") },
    [URLS.historicoYpfd]: { json: leerFixture("data912-historico-sin-datos.json") },
    [URLS.dolares]: { json: leerFixture("dolarapi-dolares.json") },
    [URLS.mepHistorico]: { json: leerFixture("argentinadatos-bolsa.json") },
    [URLS.feriados2026]: { json: leerFixture("argentinadatos-feriados-2026.json") },
  };
}

export interface ProveedoresPrueba {
  cotizaciones: Data912Proveedor;
  dolarActual: DolarApiProveedor;
  argentinaDatos: ArgentinaDatosProveedor;
  buscar: BuscarFalso;
}

export function crearProveedoresPrueba(
  opciones: {
    ahora?: () => Date;
    rutasExtra?: Record<string, RespuestaFalsa | RespuestaFalsa[]>;
  } = {},
): ProveedoresPrueba {
  const buscar = crearBuscarFalso({ ...rutasDeFixtures(), ...opciones.rutasExtra });
  const comunes = {
    buscar,
    ahora: opciones.ahora ?? (() => AHORA_FIXTURES),
    registrar: () => {},
    timeoutMs: 100,
    reintentos: 0,
  };
  return {
    cotizaciones: new Data912Proveedor(comunes),
    dolarActual: new DolarApiProveedor(comunes),
    argentinaDatos: new ArgentinaDatosProveedor(comunes),
    buscar,
  };
}
