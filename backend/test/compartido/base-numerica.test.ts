import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Decimal, aDecimal, aNumero } from "../../src/compartido/decimal";
import {
  aFechaDia,
  aTextoDia,
  esTextoDiaValido,
  fechaCortaEn,
  formatoDia,
  formatoFechaCorta,
  hoyEn,
} from "../../src/compartido/fechas";
import {
  formatearMoneda,
  formatearMonedaAbreviada,
  formatearNumero,
  formatearPorcentaje,
  textoMoneda,
} from "../../src/compartido/formato";
import {
  esquemaDecimalNoNegativo,
  esquemaDecimalPositivo,
  esquemaFechaDia,
} from "../../src/compartido/esquemas";
import "../../src/compartido/validacion";

describe("decimal", () => {
  it("convierte sin perder precisión y redondea solo para mostrar", () => {
    expect(aDecimal(0.1).plus(aDecimal("0.2")).toString()).toBe("0.3");
    expect(aDecimal({ toString: () => "105.53" }).toString()).toBe("105.53");
    expect(aNumero(new Decimal("2.345"), 2)).toBe(2.35);
  });
});

describe("fechas", () => {
  it("los días se guardan como medianoche UTC y vuelven igual", () => {
    expect(aFechaDia("2026-05-10").toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(aTextoDia(aFechaDia("2026-05-10"))).toBe("2026-05-10");
    expect(formatoFechaCorta(aFechaDia("2026-05-10"))).toBe("10/05/2026");
  });

  it("valida días reales", () => {
    expect(esTextoDiaValido("2026-02-28")).toBe(true);
    expect(esTextoDiaValido("2026-02-30")).toBe(false);
    expect(esTextoDiaValido("10/05/2026")).toBe(false);
  });

  it("el día de hoy depende de la zona horaria argentina", () => {
    const tardeDeNoche = new Date("2026-09-29T01:00:00Z");
    expect(hoyEn("America/Argentina/Buenos_Aires", tardeDeNoche)).toBe("2026-09-28");
  });
});

describe("fechas cortas", () => {
  const zona = "America/Argentina/Buenos_Aires";

  it("un día AAAA-MM-DD se muestra dd/mm/aaaa o dd/mm", () => {
    expect(formatoDia("2026-05-10")).toBe("10/05/2026");
    expect(formatoDia("2026-05-10", false)).toBe("10/05");
  });

  it("la fecha corta es la del día en la zona horaria, no la del día UTC", () => {
    // 23:30 del 27/09 en Argentina = 02:30Z del 28/09.
    const tardeDeNoche = new Date("2026-09-28T02:30:00Z");
    expect(fechaCortaEn(zona, tardeDeNoche)).toBe("27/09/2026");
    expect(fechaCortaEn(zona, tardeDeNoche, false)).toBe("27/09");
    expect(fechaCortaEn(zona, new Date("2026-09-28T15:00:00Z"))).toBe("28/09/2026");
  });
});

describe("formato es-AR", () => {
  it("números, montos y porcentajes", () => {
    expect(formatearNumero(new Decimal("1234.5"))).toBe("1.234,5");
    expect(formatearMoneda(new Decimal("48320"), "USD_MEP")).toBe("US$ 48.320,00");
    expect(formatearMoneda(new Decimal("2785"), "ARS", 0)).toBe("$ 2.785");
    expect(formatearMonedaAbreviada(new Decimal("74900000"), "ARS")).toBe("$ 74,9 M");
    expect(formatearMonedaAbreviada(new Decimal("3140.4"), "USD")).toBe("US$ 3.140");
    expect(formatearPorcentaje(new Decimal("6.94"))).toBe("+6,9%");
    expect(formatearPorcentaje(new Decimal("-0.44"))).toBe("-0,4%");
    expect(formatearPorcentaje(new Decimal("0.44"), false)).toBe("0,4%");
  });

  it("nombre llano de cada moneda", () => {
    expect(textoMoneda("ARS")).toBe("Pesos");
    expect(textoMoneda("USD_MEP")).toBe("Dólar MEP");
    expect(textoMoneda("USD_CCL")).toBe("Dólar cable");
    expect(textoMoneda("USD_EXTERIOR")).toBe("Dólar exterior");
  });
});

describe("esquemas numéricos", () => {
  const esquema = z.object({
    cantidad: esquemaDecimalPositivo,
    comision: esquemaDecimalNoNegativo,
    fecha: esquemaFechaDia,
  });

  it("acepta números o textos numéricos y devuelve Decimal", () => {
    const r = esquema.parse({ cantidad: "10.5", comision: 0, fecha: "2026-05-10" });
    expect(r.cantidad.toString()).toBe("10.5");
    expect(r.comision.toString()).toBe("0");
    expect(r.fecha).toBe("2026-05-10");
  });

  it("rechaza con mensajes llanos", () => {
    const r = esquema.safeParse({ cantidad: 0, comision: -1, fecha: "2026-13-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((p) => p.message)).toEqual([
        "Tiene que ser un número mayor a cero.",
        "No puede ser negativo.",
        "Poné una fecha válida con el formato AAAA-MM-DD.",
      ]);
    }
  });

  it("rechaza textos que no son números", () => {
    const r = esquema.safeParse({ cantidad: "diez", comision: 0, fecha: "2026-05-10" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues[0]?.message).toBe("Tiene que ser un número mayor a cero.");
  });
});
