import { describe, expect, it, vi } from "vitest";
import type { ProveedorCotizaciones } from "../../../src/proveedores/cotizaciones/proveedor-cotizaciones";
import { InstrumentosServicio } from "../../../src/modulos/instrumentos/instrumentos.servicio";
import type { InstrumentosRepositorio } from "../../../src/modulos/instrumentos/instrumentos.repositorio";
import type { PreciosManualesRepositorio } from "../../../src/modulos/instrumentos/precios-manuales.repositorio";

const LISTAS_VACIAS = { ACCIONES: [], CEDEARS: [], BONOS: [], OBLIGACIONES: [], LETRAS: [] };

describe("InstrumentosServicio.asegurarCatalogo: sincronización concurrente", () => {
  it("tres pedidos simultáneos disparan una sola sincronización", async () => {
    let llamadasAListas = 0;
    // `contar()` y `listas()` ceden el control (microtarea) para que, sin el arreglo, las tres
    // llamadas concurrentes pasen la verificación del mutex antes de que ninguna lo tome.
    const contar = vi.fn(async () => {
      await Promise.resolve();
      return 0;
    });
    const sincronizar = vi.fn(async () => undefined);
    const instrumentos = {
      contar,
      sincronizar,
    } as unknown as InstrumentosRepositorio;
    const precios = {} as unknown as PreciosManualesRepositorio;
    const proveedor: ProveedorCotizaciones = {
      listas: vi.fn(async () => {
        llamadasAListas++;
        await Promise.resolve();
        return { valor: LISTAS_VACIAS, obtenidoEn: new Date(), desactualizado: false };
      }),
      historico: vi.fn(),
    };
    const servicio = new InstrumentosServicio(instrumentos, precios, proveedor, () => new Date());

    await Promise.all([
      servicio.asegurarCatalogo(),
      servicio.asegurarCatalogo(),
      servicio.asegurarCatalogo(),
    ]);

    expect(llamadasAListas).toBe(1);
  });
});
