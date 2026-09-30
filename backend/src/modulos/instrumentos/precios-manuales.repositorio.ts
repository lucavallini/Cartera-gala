import type { Moneda } from "@cartera/contratos";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { aDecimal, type Decimal } from "../../compartido/decimal";

export interface PrecioManual {
  precio: Decimal;
  moneda: Moneda;
  cargadoEn: Date;
}

/** Precio que carga cada usuario para un activo que no tiene cotización. */
export class PreciosManualesRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  async deUsuario(
    usuarioId: string,
    instrumentoIds: readonly string[],
  ): Promise<Map<string, PrecioManual>> {
    const filas = await this.bd.instrumentoUsuario.findMany({
      where: { usuarioId, instrumentoId: { in: [...instrumentoIds] }, precioManual: { not: null } },
    });
    const precios = new Map<string, PrecioManual>();
    for (const fila of filas) {
      if (fila.precioManual && fila.precioManualMoneda && fila.precioManualEn) {
        precios.set(fila.instrumentoId, {
          precio: aDecimal(fila.precioManual),
          moneda: fila.precioManualMoneda,
          cargadoEn: fila.precioManualEn,
        });
      }
    }
    return precios;
  }

  async fijar(
    usuarioId: string,
    instrumentoId: string,
    precio: Decimal,
    moneda: Moneda,
    ahora: Date,
  ): Promise<void> {
    const datos = {
      precioManual: precio.toString(),
      precioManualMoneda: moneda,
      precioManualEn: ahora,
    };
    await this.bd.instrumentoUsuario.upsert({
      where: { usuarioId_instrumentoId: { usuarioId, instrumentoId } },
      create: { usuarioId, instrumentoId, ...datos },
      update: datos,
    });
  }

  async quitar(usuarioId: string, instrumentoId: string): Promise<void> {
    await this.bd.instrumentoUsuario.updateMany({
      where: { usuarioId, instrumentoId },
      data: { precioManual: null, precioManualMoneda: null, precioManualEn: null },
    });
  }
}
