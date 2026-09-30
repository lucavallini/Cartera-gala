import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "../../src/generado/prisma/client";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";

const TABLAS_DEL_MODELO = [
  "Alerta",
  "Cartera",
  "Cotizacion",
  "Cuenta",
  "Etiqueta",
  "FlujoProgramado",
  "Importacion",
  "IndiceEconomico",
  "InformeNoticias",
  "Instrumento",
  "InstrumentoEtiqueta",
  "InstrumentoUsuario",
  "Noticia",
  "NoticiaInstrumento",
  "Notificacion",
  "ObjetivoAsignacion",
  "Operacion",
  "RegistroAuditoria",
  "Sesion",
  "SnapshotCartera",
  "TipoCambio",
  "Usuario",
];

describe("base de datos", () => {
  let base: BasePrueba;
  beforeEach(async () => {
    base = await crearBasePrueba();
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("tiene exactamente las tablas del modelo", async () => {
    const filas = await base.bd.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type = 'table'`;
    const tablas = filas
      .map((fila) => fila.name)
      .filter((nombre) => !nombre.startsWith("_prisma") && !nombre.startsWith("sqlite_"))
      .sort();
    expect(tablas).toEqual([...TABLAS_DEL_MODELO].sort());
  });

  it("guarda Decimal sin errores de redondeo", async () => {
    const instrumento = await base.bd.instrumento.create({
      data: {
        ticker: "AL30",
        tipo: "BONO",
        mercado: "BYMA",
        simbolos: { ARS: "AL30", USD_MEP: "AL30D" },
        factorPrecio: new Prisma.Decimal("0.1").plus("0.2"),
      },
    });
    const leido = await base.bd.instrumento.findUniqueOrThrow({ where: { id: instrumento.id } });
    expect(leido.factorPrecio.toString()).toBe("0.3");
    expect(leido.simbolos).toEqual({ ARS: "AL30", USD_MEP: "AL30D" });
  });

  it("cada base de prueba está aislada de las demás", async () => {
    await base.bd.usuario.create({
      data: { nombre: "A", email: "a@prueba.com", hashPassword: "x" },
    });
    const otra = await crearBasePrueba();
    expect(await otra.bd.usuario.count()).toBe(0);
    await otra.cerrar();
  });
});
