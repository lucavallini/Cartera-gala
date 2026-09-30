import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Cuenta, Prisma, Usuario } from "../../src/generado/prisma/client";
import { AuditoriaRepositorio } from "../../src/compartido/auditoria/auditoria.repositorio";
import {
  ServicioAuditado,
  type PasoPrevio,
} from "../../src/compartido/auditoria/servicio-auditado";
import { ErrorNoEncontrado } from "../../src/compartido/errores";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";
import { crearUsuarioPrueba } from "../utilidades/fabricas";
import {
  CuentasPruebaRepositorio,
  type EdicionCuentaPrueba,
  type NuevaCuentaPrueba,
} from "../utilidades/cuentas-prueba";

class CuentasPruebaServicio extends ServicioAuditado<
  Cuenta,
  NuevaCuentaPrueba,
  Prisma.CuentaUncheckedCreateInput,
  EdicionCuentaPrueba
> {
  protected readonly entidadAuditada = "CuentaPrueba";
  crear(usuarioId: string, datos: NuevaCuentaPrueba, pasoPrevio?: PasoPrevio) {
    return this.crearAuditado(usuarioId, datos, pasoPrevio);
  }
  editar(usuarioId: string, id: string, datos: EdicionCuentaPrueba) {
    return this.editarAuditado(usuarioId, id, datos);
  }
  borrar(usuarioId: string, id: string) {
    return this.borrarAuditado(usuarioId, id);
  }
}

describe("ServicioAuditado", () => {
  let base: BasePrueba;
  let auditoria: AuditoriaRepositorio;
  let servicio: CuentasPruebaServicio;
  let ana: Usuario;
  let beto: Usuario;

  beforeEach(async () => {
    base = await crearBasePrueba();
    auditoria = new AuditoriaRepositorio(base.bd);
    servicio = new CuentasPruebaServicio(base.bd, new CuentasPruebaRepositorio(base.bd), auditoria);
    ana = await crearUsuarioPrueba(base.bd);
    beto = await crearUsuarioPrueba(base.bd);
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("al crear registra CREAR con el estado nuevo", async () => {
    const cuenta = await servicio.crear(ana.id, { broker: "IOL", alias: "principal" });
    const [registro] = await auditoria.listarDeEntidad("CuentaPrueba", cuenta.id);
    expect(registro).toMatchObject({ usuarioId: ana.id, accion: "CREAR", antes: null });
    expect(registro?.despues).toMatchObject({ broker: "IOL", alias: "principal" });
  });

  it("al editar registra el antes y el después", async () => {
    const cuenta = await servicio.crear(ana.id, { broker: "IOL" });
    await servicio.editar(ana.id, cuenta.id, { broker: "Bull Market" });
    const registros = await auditoria.listarDeEntidad("CuentaPrueba", cuenta.id);
    const edicion = registros.find((r) => r.accion === "EDITAR");
    expect(edicion?.antes).toMatchObject({ broker: "IOL" });
    expect(edicion?.despues).toMatchObject({ broker: "Bull Market" });
  });

  it("al borrar registra BORRAR", async () => {
    const cuenta = await servicio.crear(ana.id, { broker: "IOL" });
    await servicio.borrar(ana.id, cuenta.id);
    const registros = await auditoria.listarDeEntidad("CuentaPrueba", cuenta.id);
    expect(registros.map((r) => r.accion)).toEqual(["CREAR", "BORRAR"]);
  });

  it("si el paso previo falla, no queda ni el registro ni la auditoría", async () => {
    await expect(
      servicio.crear(ana.id, { broker: "IOL" }, async () => {
        throw new Error("falla a propósito");
      }),
    ).rejects.toThrow("falla a propósito");
    expect(await base.bd.cuenta.count()).toBe(0);
    expect(await base.bd.registroAuditoria.count()).toBe(0);
  });

  it("no audita ni cambia nada al intentar editar lo de otro usuario", async () => {
    const cuenta = await servicio.crear(ana.id, { broker: "IOL" });
    await expect(servicio.editar(beto.id, cuenta.id, { broker: "X" })).rejects.toThrow(
      ErrorNoEncontrado,
    );
    const registros = await auditoria.listarDeEntidad("CuentaPrueba", cuenta.id);
    expect(registros.map((r) => r.accion)).toEqual(["CREAR"]);
  });
});
