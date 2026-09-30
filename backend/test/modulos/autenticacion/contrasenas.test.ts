import { describe, expect, it } from "vitest";
import { ServicioContrasenas } from "../../../src/modulos/autenticacion/contrasenas";

describe("ServicioContrasenas", () => {
  const contrasenas = new ServicioContrasenas();

  it("hashea con argon2id y verifica la contraseña correcta", async () => {
    const hash = await contrasenas.hashear("una clave segura");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("una clave segura");
    expect(await contrasenas.verificar(hash, "una clave segura")).toBe(true);
  });

  it("rechaza una contraseña distinta, incluso con espacios de más", async () => {
    const hash = await contrasenas.hashear("una clave segura");
    expect(await contrasenas.verificar(hash, "una clave segura ")).toBe(false);
    expect(await contrasenas.verificar(hash, "otra clave")).toBe(false);
  });

  it("devuelve false ante un hash corrupto en lugar de romper", async () => {
    expect(await contrasenas.verificar("no-es-un-hash", "lo que sea")).toBe(false);
  });
});
