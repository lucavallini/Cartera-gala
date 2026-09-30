import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type Prisma } from "../../generado/prisma/client";

/** Cliente normal o cliente dentro de una transacción: los repositorios aceptan ambos. */
export type ClienteBD = PrismaClient | Prisma.TransactionClient;

export function crearClienteBD(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
