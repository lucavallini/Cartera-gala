import { describe, expect, it } from "vitest";
import { derivarCatalogo } from "../../../src/modulos/instrumentos/catalogo";
import { Decimal } from "../../../src/compartido/decimal";
import type { ListasMercado } from "../../../src/proveedores/cotizaciones/proveedor-cotizaciones";
import { crearProveedoresPrueba } from "../../utilidades/proveedores-prueba";

async function catalogoDeFixtures() {
  const { valor } = await crearProveedoresPrueba().cotizaciones.listas();
  return new Map(derivarCatalogo(valor).map((i) => [i.ticker, i]));
}

function fila(simbolo: string) {
  return { simbolo, precio: new Decimal(1), variacionPct: null };
}

describe("derivarCatalogo", () => {
  it("agrupa las variantes en dólares con su instrumento en pesos", async () => {
    const catalogo = await catalogoDeFixtures();
    expect(catalogo.get("AMZN")).toMatchObject({
      tipo: "CEDEAR",
      simbolos: { ARS: "AMZN", USD_MEP: "AMZND", USD_CCL: "AMZNC" },
    });
    expect(catalogo.get("YPFD")?.simbolos).toEqual({ ARS: "YPFD", USD_MEP: "YPFDD" });
    expect(catalogo.has("AMZND")).toBe(false);
    expect(catalogo.has("YPF")).toBe(false);
  });

  it("las ONs se identifican por su ticker en O", async () => {
    const catalogo = await catalogoDeFixtures();
    expect(catalogo.get("YM39O")).toMatchObject({
      tipo: "ON",
      simbolos: { ARS: "YM39O", USD_MEP: "YM39D", USD_CCL: "YM39C" },
    });
    expect(catalogo.get("HVS1O")?.simbolos).toEqual({ ARS: "HVS1O", USD_MEP: "HVS1D" });
  });

  it("la renta fija cotiza cada 100 nominales y el resto por unidad", async () => {
    const catalogo = await catalogoDeFixtures();
    expect(catalogo.get("AL30")?.factorPrecio.toString()).toBe("0.01");
    expect(catalogo.get("YM39O")?.factorPrecio.toString()).toBe("0.01");
    expect(catalogo.get("D30S6")).toMatchObject({ tipo: "LETRA" });
    expect(catalogo.get("D30S6")?.factorPrecio.toString()).toBe("0.01");
    expect(catalogo.get("AMZN")?.factorPrecio.toString()).toBe("1");
  });

  it("arma un instrumento por ticker", async () => {
    expect((await catalogoDeFixtures()).size).toBe(38);
  });

  it("una ON que solo cotiza en dólares igual queda con su ticker en O", () => {
    const listas: ListasMercado = {
      ACCIONES: [],
      CEDEARS: [],
      BONOS: [],
      OBLIGACIONES: [fila("ZZZ1D")],
      LETRAS: [],
    };
    expect(derivarCatalogo(listas)).toEqual([
      {
        ticker: "ZZZ1O",
        tipo: "ON",
        simbolos: { USD_MEP: "ZZZ1D" },
        factorPrecio: new Decimal("0.01"),
      },
    ]);
  });

  it("un ticker repetido en dos familias queda una sola vez, con la primera", () => {
    const listas: ListasMercado = {
      ACCIONES: [fila("DUPL")],
      CEDEARS: [fila("DUPL")],
      BONOS: [],
      OBLIGACIONES: [],
      LETRAS: [],
    };
    expect(derivarCatalogo(listas).map((i) => [i.ticker, i.tipo])).toEqual([["DUPL", "ACCION"]]);
  });
});
