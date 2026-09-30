import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Usuario } from "../../src/generado/prisma/client";
import { ErrorNoEncontrado, ErrorValidacion } from "../../src/compartido/errores";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";
import { crearUsuarioPrueba } from "../utilidades/fabricas";
import { CuentasPruebaRepositorio } from "../utilidades/cuentas-prueba";

const listadoBase = { pagina: 1, porPagina: 20, direccion: "asc" as const };

describe("RepositorioDelUsuario", () => {
  let base: BasePrueba;
  let repositorio: CuentasPruebaRepositorio;
  let ana: Usuario;
  let beto: Usuario;

  beforeEach(async () => {
    base = await crearBasePrueba();
    repositorio = new CuentasPruebaRepositorio(base.bd);
    ana = await crearUsuarioPrueba(base.bd);
    beto = await crearUsuarioPrueba(base.bd);
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("crea asignando el dueño", async () => {
    const cuenta = await repositorio.crear(ana.id, { broker: "Bull Market" });
    expect(cuenta.usuarioId).toBe(ana.id);
  });

  it("no deja ver el registro de otro usuario", async () => {
    const cuenta = await repositorio.crear(ana.id, { broker: "IOL" });
    await expect(repositorio.obtener(beto.id, cuenta.id)).rejects.toThrow(ErrorNoEncontrado);
    await expect(repositorio.obtener(beto.id, cuenta.id)).rejects.toThrow(
      "No se encontró la cuenta.",
    );
    expect(await repositorio.buscar(beto.id, cuenta.id)).toBeNull();
  });

  it("lista solo lo del usuario, sin borrados, ordenado y paginado", async () => {
    await repositorio.crear(ana.id, { broker: "C" });
    await repositorio.crear(ana.id, { broker: "A" });
    const borrada = await repositorio.crear(ana.id, { broker: "B-borrada" });
    await repositorio.crear(ana.id, { broker: "B" });
    await repositorio.crear(beto.id, { broker: "De Beto" });
    await repositorio.borrar(ana.id, borrada.id);

    const pagina1 = await repositorio.listar(ana.id, { ...listadoBase, porPagina: 2 });
    expect(pagina1.items.map((c) => c.broker)).toEqual(["A", "B"]);
    expect(pagina1).toMatchObject({ total: 3, pagina: 1, porPagina: 2, totalPaginas: 2 });

    const pagina2 = await repositorio.listar(ana.id, { ...listadoBase, porPagina: 2, pagina: 2 });
    expect(pagina2.items.map((c) => c.broker)).toEqual(["C"]);

    const descendente = await repositorio.listar(ana.id, { ...listadoBase, direccion: "desc" });
    expect(descendente.items.map((c) => c.broker)).toEqual(["C", "B", "A"]);
  });

  it("una página más allá de la última devuelve lista vacía con los totales correctos", async () => {
    await repositorio.crear(ana.id, { broker: "A" });
    await repositorio.crear(ana.id, { broker: "B" });
    await repositorio.crear(ana.id, { broker: "C" });
    const pagina = await repositorio.listar(ana.id, { ...listadoBase, porPagina: 2, pagina: 9 });
    expect(pagina).toEqual({ items: [], total: 3, pagina: 9, porPagina: 2, totalPaginas: 2 });
  });

  it("con valores empatados desempata por id, así la paginación no repite ni omite", async () => {
    const creadas = [];
    for (let i = 0; i < 4; i += 1) creadas.push(await repositorio.crear(ana.id, { broker: "IOL" }));
    const idsOrdenados = creadas.map((c) => c.id).sort();
    const vistos: string[] = [];
    for (let pagina = 1; pagina <= 4; pagina += 1) {
      const resultado = await repositorio.listar(ana.id, {
        ...listadoBase,
        direccion: "desc",
        porPagina: 1,
        pagina,
      });
      vistos.push(...resultado.items.map((c) => c.id));
    }
    expect(vistos).toEqual(idsOrdenados);
  });

  it("sin registros informa una sola página vacía", async () => {
    const pagina = await repositorio.listar(ana.id, listadoBase);
    expect(pagina).toEqual({ items: [], total: 0, pagina: 1, porPagina: 20, totalPaginas: 1 });
  });

  it("rechaza ordenar por un campo no permitido, diciendo cuáles sí", async () => {
    await expect(
      repositorio.listar(ana.id, { ...listadoBase, orden: "hashPassword" }),
    ).rejects.toThrow(ErrorValidacion);
    try {
      await repositorio.listar(ana.id, { ...listadoBase, orden: "hashPassword" });
    } catch (error) {
      expect((error as ErrorValidacion).detalles?.[0]?.mensaje).toContain("broker, creadoEn");
    }
  });

  it("los filtros no pueden pisar el alcance del usuario", async () => {
    await repositorio.crear(beto.id, { broker: "De Beto" });
    const pagina = await repositorio.listar(ana.id, {
      ...listadoBase,
      filtros: { usuarioId: beto.id },
    });
    expect(pagina.items).toEqual([]);
  });

  it("no deja editar ni borrar lo de otro usuario", async () => {
    const cuenta = await repositorio.crear(ana.id, { broker: "IOL" });
    await expect(repositorio.editar(beto.id, cuenta.id, { broker: "X" })).rejects.toThrow(
      ErrorNoEncontrado,
    );
    await expect(repositorio.borrar(beto.id, cuenta.id)).rejects.toThrow(ErrorNoEncontrado);
    expect((await repositorio.obtener(ana.id, cuenta.id)).broker).toBe("IOL");
  });

  it("borra de forma lógica: la fila queda con fecha de eliminación", async () => {
    const cuenta = await repositorio.crear(ana.id, { broker: "IOL" });
    await repositorio.borrar(ana.id, cuenta.id);
    await expect(repositorio.obtener(ana.id, cuenta.id)).rejects.toThrow(ErrorNoEncontrado);
    const fila = await base.bd.cuenta.findUniqueOrThrow({ where: { id: cuenta.id } });
    expect(fila.eliminadoEn).toBeInstanceOf(Date);
  });
});
