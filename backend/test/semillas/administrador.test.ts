import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sembrarAdministrador } from "../../src/semillas/administrador";
import { crearContenedor, type Contenedor } from "../../src/contenedor";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";
import { entornoPrueba } from "../utilidades/entorno-prueba";

const DATOS = { ADMIN_EMAIL: " Admin@Cartera.com ", ADMIN_PASSWORD: "clave-admin-segura" };

describe("sembrarAdministrador", () => {
  let base: BasePrueba;
  let contenedor: Contenedor;
  beforeEach(async () => {
    base = await crearBasePrueba();
    contenedor = crearContenedor(entornoPrueba(), base.bd);
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("crea el administrador con su cartera Principal", async () => {
    expect(await sembrarAdministrador(contenedor.autenticacion.servicio, DATOS)).toBe("CREADO");
    const admin = await base.bd.usuario.findUniqueOrThrow({
      where: { email: "admin@cartera.com" },
      include: { carteras: true },
    });
    expect(admin.rol).toBe("ADMIN");
    expect(admin.nombre).toBe("Administrador");
    expect(admin.carteras.map((c) => c.nombre)).toEqual(["Principal"]);
  });

  it("correrlo dos veces no falla ni duplica", async () => {
    await sembrarAdministrador(contenedor.autenticacion.servicio, DATOS);
    expect(await sembrarAdministrador(contenedor.autenticacion.servicio, DATOS)).toBe("YA_EXISTIA");
    expect(await base.bd.usuario.count()).toBe(1);
  });

  it("si el email ya es de un usuario común, avisa que no hay administrador en vez de mentir", async () => {
    await contenedor.autenticacion.servicio.crearUsuario({
      nombre: "Se registró antes",
      email: "admin@cartera.com",
      password: "clave-de-usuario-comun",
      rol: "USUARIO",
    });
    await expect(sembrarAdministrador(contenedor.autenticacion.servicio, DATOS)).rejects.toThrow(
      /ya existe como usuario común/,
    );
  });

  it("rechaza la contraseña de ejemplo del .env.example", async () => {
    await expect(
      sembrarAdministrador(contenedor.autenticacion.servicio, {
        ADMIN_EMAIL: "admin@cartera.local",
        ADMIN_PASSWORD: "cambiar-esta-clave",
      }),
    ).rejects.toThrow(/Cambiá ADMIN_PASSWORD/);
  });

  it("explica qué falta o está mal", async () => {
    await expect(sembrarAdministrador(contenedor.autenticacion.servicio, {})).rejects.toThrow(
      /ADMIN_EMAIL/,
    );
    await expect(
      sembrarAdministrador(contenedor.autenticacion.servicio, {
        ADMIN_EMAIL: "a@b.com",
        ADMIN_PASSWORD: "corta",
      }),
    ).rejects.toThrow(/al menos 10/);
  });
});
