import { describe, expect, it } from "vitest";
import { HorarioMercado } from "../../../src/modulos/mercado/horario-mercado";
import { crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";

const ZONA = "America/Argentina/Buenos_Aires";

function horario(momento: string, feriadosCaidos = false) {
  const ahora = () => new Date(momento);
  const { argentinaDatos } = crearProveedoresPrueba({
    ahora,
    rutasExtra: feriadosCaidos ? { [URLS.feriados2026]: new Error("timeout") } : {},
  });
  return new HorarioMercado(argentinaDatos, ZONA, ahora);
}

describe("HorarioMercado (BYMA: lunes a viernes de 11 a 17, hora argentina)", () => {
  it.each([
    ["lunes 15:00", "2026-09-28T18:00:00Z", true],
    ["lunes 10:59", "2026-09-28T13:59:00Z", false],
    ["lunes 11:00", "2026-09-28T14:00:00Z", true],
    ["lunes 17:00 (ya cerró)", "2026-09-28T20:00:00Z", false],
    ["sábado 15:00", "2026-09-26T18:00:00Z", false],
    ["feriado 12/10 a las 15:00", "2026-10-12T18:00:00Z", false],
  ])("%s", async (_caso, momento, abierto) => {
    expect(await horario(momento).estaAbierto()).toBe(abierto);
  });

  it("si no se pueden consultar los feriados, un día hábil se toma como abierto", async () => {
    expect(await horario("2026-09-28T18:00:00Z", true).estaAbierto()).toBe(true);
  });
});
