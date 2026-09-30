import { describe, expect, it } from "vitest";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../src/motor/operaciones/registro-manejadores";
import { precioPromedio, simular } from "../../src/motor/simulacion";
import { crearOperacion as op } from "../utilidades/operaciones-motor";

const registro = crearRegistroManejadores();
const ppp = estrategiaDeCosto("PRECIO_PROMEDIO");

describe("simulación", () => {
  const inicial = op("TENENCIA_INICIAL", { id: "ini", cantidad: 72, precio: 2500 });
  const venta = op("VENTA", { id: "venta", cantidad: 50, precio: 3000, fecha: "2026-03-01" });

  it("muestra la tenencia y el precio promedio antes y después de una compra", () => {
    const compra = op("COMPRA", { cantidad: 100, precio: 2785, fecha: "2026-02-01" });
    const resultado = simular([inicial], { accion: "crear", operacion: compra }, ppp, registro);
    if (!resultado.valida) throw new Error(resultado.mensaje);
    expect(resultado.antes?.cantidad.toString()).toBe("72");
    expect(resultado.despues?.cantidad.toString()).toBe("172");
    expect(resultado.antes && precioPromedio(resultado.antes)?.toString()).toBe("2500");
    expect(resultado.despues && precioPromedio(resultado.despues)?.toFixed(2)).toBe("2665.70");
  });

  it("borrar una compra que deja a una venta posterior sin tenencia es inválido y explica por qué", () => {
    const resultado = simular([inicial, venta], { accion: "borrar", id: "ini" }, ppp, registro);
    expect(resultado).toEqual({
      valida: false,
      mensaje: "El 01/03/2026 vendés 50 AMZN, pero en ese momento tenías 0.",
    });
  });

  it("editar reemplaza la operación por la nueva versión", () => {
    const editada = { ...inicial, cantidad: inicial.cantidad?.mul(2) ?? null };
    const resultado = simular(
      [inicial, venta],
      { accion: "editar", operacion: editada },
      ppp,
      registro,
    );
    if (!resultado.valida) throw new Error(resultado.mensaje);
    expect(resultado.despues?.cantidad.toString()).toBe("94");
  });

  it("una operación sin activo no tiene posición afectada", () => {
    const deposito = op("DEPOSITO", { instrumentoId: null, ticker: null, monto: 1000 });
    const resultado = simular([], { accion: "crear", operacion: deposito }, ppp, registro);
    expect(resultado).toEqual({ valida: true, antes: null, despues: null });
  });
});
