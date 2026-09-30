import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AutenticacionServicio } from "../../../src/modulos/autenticacion/autenticacion.servicio";
import { UsuariosRepositorio } from "../../../src/modulos/autenticacion/usuarios.repositorio";
import { SesionesRepositorio } from "../../../src/modulos/autenticacion/sesiones.repositorio";
import { ServicioContrasenas } from "../../../src/modulos/autenticacion/contrasenas";
import { ServicioTokens } from "../../../src/modulos/autenticacion/tokens";
import {
  ErrorConflicto,
  ErrorNoAutorizado,
  ErrorProhibido,
  ErrorValidacion,
} from "../../../src/compartido/errores";
import { crearBasePrueba, type BasePrueba } from "../../utilidades/base-datos-prueba";

const SECRETO = "secreto-de-prueba-".padEnd(40, "x");
const CTX = { userAgent: "vitest", ip: "127.0.0.1" };
const DATOS = { nombre: "Luca", email: "luca@prueba.com", password: "clave-segura-123" };

describe("AutenticacionServicio", () => {
  let base: BasePrueba;
  let reloj: Date;
  let tokens: ServicioTokens;
  let servicio: AutenticacionServicio;

  function crearServicio(registroHabilitado = true) {
    const ahora = () => reloj;
    tokens = new ServicioTokens(SECRETO, 15, 30, ahora);
    return new AutenticacionServicio(
      base.bd,
      new UsuariosRepositorio(base.bd),
      new SesionesRepositorio(base.bd),
      new ServicioContrasenas(),
      tokens,
      { registroHabilitado },
      ahora,
    );
  }

  function avanzar(milisegundos: number) {
    reloj = new Date(reloj.getTime() + milisegundos);
  }

  beforeEach(async () => {
    base = await crearBasePrueba();
    reloj = new Date("2026-09-28T12:00:00Z");
    servicio = crearServicio();
  });
  afterEach(async () => {
    await base.cerrar();
  });

  describe("registro", () => {
    it("crea el usuario con su cartera Principal y abre sesión", async () => {
      const { respuesta, refresh } = await servicio.registrar(
        { ...DATOS, email: "  Luca@Prueba.COM " },
        CTX,
      );
      expect(respuesta.usuario).toMatchObject({
        nombre: "Luca",
        email: "luca@prueba.com",
        rol: "USUARIO",
      });
      expect(await tokens.verificarAcceso(respuesta.tokenAcceso)).toEqual({
        usuarioId: respuesta.usuario.id,
        rol: "USUARIO",
      });
      expect(refresh.token.length).toBeGreaterThan(20);
      const carteras = await base.bd.cartera.findMany({
        where: { usuarioId: respuesta.usuario.id },
      });
      expect(carteras).toHaveLength(1);
      expect(carteras[0]).toMatchObject({ nombre: "Principal", esPrincipal: true });
    });

    it("guarda la contraseña hasheada, nunca en claro", async () => {
      const { respuesta } = await servicio.registrar(DATOS, CTX);
      const usuario = await base.bd.usuario.findUniqueOrThrow({
        where: { id: respuesta.usuario.id },
      });
      expect(usuario.hashPassword.startsWith("$argon2id$")).toBe(true);
      expect(usuario.hashPassword).not.toContain(DATOS.password);
    });

    it("rechaza un email ya registrado aunque cambien las mayúsculas", async () => {
      await servicio.registrar(DATOS, CTX);
      await expect(servicio.registrar({ ...DATOS, email: "LUCA@prueba.com" }, CTX)).rejects.toThrow(
        ErrorConflicto,
      );
    });

    it("no permite registrarse si el registro está deshabilitado", async () => {
      servicio = crearServicio(false);
      await expect(servicio.registrar(DATOS, CTX)).rejects.toThrow(ErrorProhibido);
    });

    it("crearUsuario permite crear un administrador", async () => {
      const admin = await servicio.crearUsuario({ ...DATOS, rol: "ADMIN" });
      expect(admin.rol).toBe("ADMIN");
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await servicio.registrar(DATOS, CTX);
    });

    it("entra con email en otra combinación de mayúsculas y con espacios", async () => {
      const { respuesta } = await servicio.login(
        { email: "  LUCA@Prueba.com ", password: DATOS.password },
        CTX,
      );
      expect(respuesta.usuario.email).toBe("luca@prueba.com");
    });

    it("usa el mismo mensaje para contraseña incorrecta y email inexistente", async () => {
      await expect(
        servicio.login({ email: DATOS.email, password: "mala-clave-123" }, CTX),
      ).rejects.toThrow("Email o contraseña incorrectos.");
      await expect(
        servicio.login({ email: "nadie@prueba.com", password: "x" }, CTX),
      ).rejects.toThrow("Email o contraseña incorrectos.");
    });
  });

  describe("refresh", () => {
    it("rota el token: el nuevo es distinto y el viejo queda reemplazado", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      const renovado = await servicio.refrescar(inicial.refresh.token, CTX);
      expect(renovado.refresh.token).not.toBe(inicial.refresh.token);
      const vieja = await base.bd.sesion.findUniqueOrThrow({
        where: { tokenHash: tokens.hashearRefresh(inicial.refresh.token) },
      });
      expect(vieja.revocadaEn).not.toBeNull();
      expect(vieja.reemplazadaPorId).not.toBeNull();
    });

    it("reusar un token rotado hace más de 10 s revoca toda la cadena", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      const renovado = await servicio.refrescar(inicial.refresh.token, CTX);
      avanzar(11_000);
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow(
        ErrorNoAutorizado,
      );
      await expect(servicio.refrescar(renovado.refresh.token, CTX)).rejects.toThrow(
        ErrorNoAutorizado,
      );
    });

    it("dos pestañas que refrescan a la vez: la segunda recibe 401 pero la sesión sigue viva", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      const renovado = await servicio.refrescar(inicial.refresh.token, CTX);
      avanzar(2_000);
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toMatchObject({
        codigo: "REFRESH_YA_ROTADO",
        status: 401,
      });
      const siguiente = await servicio.refrescar(renovado.refresh.token, CTX);
      expect(siguiente.respuesta.usuario.email).toBe(DATOS.email);
    });

    it("dos refrescos simultáneos con el mismo token: uno rota, el otro no deja una sesión suelta", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      const resultados = await Promise.allSettled([
        servicio.refrescar(inicial.refresh.token, CTX),
        servicio.refrescar(inicial.refresh.token, CTX),
      ]);
      const cumplidos = resultados.filter((r) => r.status === "fulfilled");
      const rechazados = resultados.filter((r) => r.status === "rejected");
      expect(cumplidos).toHaveLength(1);
      expect(rechazados).toHaveLength(1);
      expect(rechazados[0]?.reason).toMatchObject({ codigo: "REFRESH_YA_ROTADO" });
      const vivas = await base.bd.sesion.count({
        where: { usuarioId: inicial.respuesta.usuario.id, revocadaEn: null },
      });
      expect(vivas).toBe(1);
    });

    it("rechaza un refresh vencido", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      avanzar(31 * 86_400_000);
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow(
        "Tu sesión venció",
      );
    });

    it("rechaza la ausencia de token y un token desconocido", async () => {
      await expect(servicio.refrescar(undefined, CTX)).rejects.toThrow(ErrorNoAutorizado);
      await expect(servicio.refrescar("inventado", CTX)).rejects.toThrow(ErrorNoAutorizado);
    });
  });

  describe("logout", () => {
    it("revoca la sesión y el refresh deja de servir", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      await servicio.logout(inicial.refresh.token);
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow(
        ErrorNoAutorizado,
      );
    });

    it("sin token no hace nada y no falla", async () => {
      await expect(servicio.logout(undefined)).resolves.toBeUndefined();
    });
  });

  describe("cambio de contraseña", () => {
    it("exige la contraseña actual correcta", async () => {
      const { respuesta } = await servicio.registrar(DATOS, CTX);
      await expect(
        servicio.cambiarPassword(respuesta.usuario.id, {
          passwordActual: "equivocada-123",
          passwordNueva: "nueva-clave-segura",
        }),
      ).rejects.toThrow(ErrorValidacion);
    });

    it("rechaza una contraseña nueva igual a la actual", async () => {
      const { respuesta } = await servicio.registrar(DATOS, CTX);
      await expect(
        servicio.cambiarPassword(respuesta.usuario.id, {
          passwordActual: DATOS.password,
          passwordNueva: DATOS.password,
        }),
      ).rejects.toThrow("distinta de la actual");
    });

    it("cambia la contraseña, conserva la sesión actual y cierra las demás", async () => {
      const actual = await servicio.registrar(DATOS, CTX);
      const otra = await servicio.login({ email: DATOS.email, password: DATOS.password }, CTX);
      await servicio.cambiarPassword(
        actual.respuesta.usuario.id,
        { passwordActual: DATOS.password, passwordNueva: "nueva-clave-segura" },
        actual.refresh.token,
      );
      await expect(
        servicio.login({ email: DATOS.email, password: DATOS.password }, CTX),
      ).rejects.toThrow(ErrorNoAutorizado);
      await expect(
        servicio.login({ email: DATOS.email, password: "nueva-clave-segura" }, CTX),
      ).resolves.toBeDefined();
      await expect(servicio.refrescar(otra.refresh.token, CTX)).rejects.toThrow(ErrorNoAutorizado);
      await expect(servicio.refrescar(actual.refresh.token, CTX)).resolves.toBeDefined();
    });
  });

  it("yo devuelve los datos del usuario sin el hash", async () => {
    const { respuesta } = await servicio.registrar(DATOS, CTX);
    const yo = await servicio.yo(respuesta.usuario.id);
    expect(yo).toEqual({
      id: respuesta.usuario.id,
      nombre: "Luca",
      email: "luca@prueba.com",
      rol: "USUARIO",
      monedaBase: "USD_MEP",
      dolarReferencia: "MEP",
      metodoCosto: "PRECIO_PROMEDIO",
    });
  });
});
