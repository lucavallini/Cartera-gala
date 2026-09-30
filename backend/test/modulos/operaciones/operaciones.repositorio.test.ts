import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Usuario } from "../../../src/generado/prisma/client";
import { OperacionesRepositorio } from "../../../src/modulos/operaciones/operaciones.repositorio";
import { crearBasePrueba, type BasePrueba } from "../../utilidades/base-datos-prueba";
import { crearUsuarioPrueba } from "../../utilidades/fabricas";

describe("OperacionesRepositorio.deCarteras", () => {
  let base: BasePrueba;
  let repositorio: OperacionesRepositorio;
  let ana: Usuario;
  let beto: Usuario;
  let carteraDeAna: string;

  beforeEach(async () => {
    base = await crearBasePrueba();
    repositorio = new OperacionesRepositorio(base.bd);
    ana = await crearUsuarioPrueba(base.bd);
    beto = await crearUsuarioPrueba(base.bd);
    const cartera = await base.bd.cartera.create({
      data: { usuarioId: ana.id, nombre: "Cartera de Ana" },
    });
    carteraDeAna = cartera.id;
    await base.bd.operacion.create({
      data: {
        carteraId: carteraDeAna,
        tipo: "DEPOSITO",
        fechaConcertacion: new Date("2026-09-01"),
        moneda: "ARS",
        montoNeto: "1000",
      },
    });
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("devuelve la historia de una cartera del usuario dueño", async () => {
    const operaciones = await repositorio.deCarteras([carteraDeAna], ana.id);
    expect(operaciones).toHaveLength(1);
  });

  it("defensa en profundidad: con una cartera ajena devuelve [] aunque el id sea correcto", async () => {
    const operaciones = await repositorio.deCarteras([carteraDeAna], beto.id);
    expect(operaciones).toEqual([]);
  });
});
