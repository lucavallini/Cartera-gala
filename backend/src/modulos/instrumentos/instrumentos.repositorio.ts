import type { Instrumento, Prisma, PrismaClient } from "../../generado/prisma/client";
import { aJson } from "../../compartido/json";
import type { InstrumentoDeCatalogo } from "./catalogo";

const MERCADO = "BYMA";
/** Más de mil activos: la sincronización necesita más que el límite por defecto de 5 s. */
const TIMEOUT_SINCRONIZACION_MS = 120_000;

export type EdicionInstrumento = Pick<
  Prisma.InstrumentoUpdateInput,
  "nombre" | "emisor" | "sector"
>;

/** Catálogo compartido por todos los usuarios. Nunca se borra ni se desactiva solo: puede haber tenencias que lo referencian. */
export class InstrumentosRepositorio {
  constructor(private readonly bd: PrismaClient) {}

  contar(): Promise<number> {
    return this.bd.instrumento.count();
  }

  /** Alta o actualización de cada activo. No toca los datos que completan las personas. */
  async sincronizar(items: readonly InstrumentoDeCatalogo[]): Promise<void> {
    await this.bd.$transaction(
      async (tx) => {
        for (const item of items) {
          const datos = {
            tipo: item.tipo,
            simbolos: aJson(item.simbolos),
            factorPrecio: item.factorPrecio.toString(),
          };
          await tx.instrumento.upsert({
            where: { ticker_mercado: { ticker: item.ticker, mercado: MERCADO } },
            create: {
              ...datos,
              ticker: item.ticker,
              mercado: MERCADO,
              tickerSubyacente: item.tipo === "CEDEAR" ? item.ticker : null,
            },
            update: datos,
          });
        }
      },
      { timeout: TIMEOUT_SINCRONIZACION_MS },
    );
  }

  porTickers(tickers: readonly string[]): Promise<Instrumento[]> {
    return this.bd.instrumento.findMany({ where: { ticker: { in: [...tickers] }, activo: true } });
  }

  porPrefijo(prefijo: string, limite: number): Promise<Instrumento[]> {
    return this.bd.instrumento.findMany({
      where: { ticker: { startsWith: prefijo }, activo: true },
      orderBy: { ticker: "asc" },
      take: limite,
    });
  }

  porIds(ids: readonly string[]): Promise<Instrumento[]> {
    return this.bd.instrumento.findMany({ where: { id: { in: [...ids] } } });
  }

  buscarPorId(id: string): Promise<Instrumento | null> {
    return this.bd.instrumento.findUnique({ where: { id } });
  }

  editar(id: string, datos: EdicionInstrumento): Promise<Instrumento> {
    return this.bd.instrumento.update({ where: { id }, data: datos });
  }
}
