import { describe, expect, it } from "vitest";
import { ServicioTokens } from "../../../src/modulos/autenticacion/tokens";
import { ErrorNoAutorizado } from "../../../src/compartido/errores";

const SECRETO = "secreto-de-prueba-".padEnd(40, "x");
const INICIO = new Date("2026-09-28T12:00:00Z");

describe("ServicioTokens", () => {
  it("firma y verifica un token de acceso", async () => {
    const tokens = new ServicioTokens(SECRETO, 15, 30, () => INICIO);
    const emitido = await tokens.firmarAcceso({ usuarioId: "u1", rol: "ADMIN" });
    expect(emitido.expiraEn.toISOString()).toBe("2026-09-28T12:15:00.000Z");
    expect(await tokens.verificarAcceso(emitido.token)).toEqual({ usuarioId: "u1", rol: "ADMIN" });
  });

  it("rechaza un token vencido", async () => {
    const emisor = new ServicioTokens(SECRETO, 15, 30, () => INICIO);
    const { token } = await emisor.firmarAcceso({ usuarioId: "u1", rol: "USUARIO" });
    const mas16Minutos = new ServicioTokens(
      SECRETO,
      15,
      30,
      () => new Date(INICIO.getTime() + 16 * 60_000),
    );
    await expect(mas16Minutos.verificarAcceso(token)).rejects.toThrow(ErrorNoAutorizado);
  });

  it("rechaza un token firmado con otro secreto o alterado", async () => {
    const otro = new ServicioTokens("otro-secreto-".padEnd(40, "y"), 15, 30, () => INICIO);
    const tokens = new ServicioTokens(SECRETO, 15, 30, () => INICIO);
    const { token } = await otro.firmarAcceso({ usuarioId: "u1", rol: "ADMIN" });
    await expect(tokens.verificarAcceso(token)).rejects.toThrow(ErrorNoAutorizado);
    await expect(tokens.verificarAcceso("basura")).rejects.toThrow(ErrorNoAutorizado);
  });

  it("genera refresh tokens únicos, con hash determinístico y vencimiento en días", () => {
    const tokens = new ServicioTokens(SECRETO, 15, 30, () => INICIO);
    const a = tokens.generarRefresh();
    const b = tokens.generarRefresh();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(tokens.hashearRefresh(a.token));
    expect(a.hash).not.toBe(a.token);
    expect(a.expiraEn.toISOString()).toBe("2026-10-28T12:00:00.000Z");
  });
});
