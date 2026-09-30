import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  crearAppPrueba,
  extraerCookieRefresh,
  registrarUsuario,
  type AppPrueba,
} from "../../utilidades/app-prueba";

describe("API de autenticación", () => {
  let prueba: AppPrueba;
  beforeAll(async () => {
    prueba = await crearAppPrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("registro: 201, sesión y cookie httpOnly/strict en /api/auth", async () => {
    const respuesta = await request(prueba.app)
      .post("/api/auth/registro")
      .send({ nombre: "Luca", email: "Registro@Prueba.com", password: "clave-segura-123" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario.email).toBe("registro@prueba.com");
    expect(typeof respuesta.body.tokenAcceso).toBe("string");
    const cookie = String(respuesta.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).not.toContain("Secure");
  });

  it("registro inválido: 400 con un detalle por campo", async () => {
    const respuesta = await request(prueba.app)
      .post("/api/auth/registro")
      .send({ nombre: "", email: "no-es-email", password: "corta" });
    expect(respuesta.status).toBe(400);
    const campos = respuesta.body.error.detalles.map((d: { campo: string }) => d.campo).sort();
    expect(campos).toEqual(["email", "nombre", "password"]);
    const password = respuesta.body.error.detalles.find(
      (d: { campo: string }) => d.campo === "password",
    );
    expect(password.mensaje).toBe("La contraseña necesita al menos 10 caracteres.");
  });

  it("login correcto e incorrecto", async () => {
    await registrarUsuario(prueba.app, { email: "login@prueba.com" });
    const bien = await request(prueba.app)
      .post("/api/auth/login")
      .send({ email: " LOGIN@prueba.com", password: "clave-segura-123" });
    expect(bien.status).toBe(200);
    const mal = await request(prueba.app)
      .post("/api/auth/login")
      .send({ email: "login@prueba.com", password: "equivocada-123" });
    expect(mal.status).toBe(401);
    expect(mal.body.error.mensaje).toBe("Email o contraseña incorrectos.");
  });

  it("/yo con token, sin token y con token basura", async () => {
    const { token, usuario } = await registrarUsuario(prueba.app);
    const conToken = await request(prueba.app)
      .get("/api/auth/yo")
      .set("Authorization", `Bearer ${token}`);
    expect(conToken.status).toBe(200);
    expect(conToken.body.id).toBe(usuario.id);
    expect((await request(prueba.app).get("/api/auth/yo")).status).toBe(401);
    const basura = await request(prueba.app)
      .get("/api/auth/yo")
      .set("Authorization", "Bearer basura");
    expect(basura.status).toBe(401);
  });

  it("refrescar rota la cookie y la vieja deja de servir", async () => {
    const { cookie } = await registrarUsuario(prueba.app);
    const renovada = await request(prueba.app).post("/api/auth/refrescar").set("Cookie", cookie);
    expect(renovada.status).toBe(200);
    const cookieNueva = extraerCookieRefresh(renovada);
    expect(cookieNueva).not.toBe(cookie);
    const reuso = await request(prueba.app).post("/api/auth/refrescar").set("Cookie", cookie);
    expect(reuso.status).toBe(401);
  });

  it("dos pestañas refrescando a la vez: una rota y la otra recibe REFRESH_YA_ROTADO", async () => {
    const { cookie } = await registrarUsuario(prueba.app);
    const [a, b] = await Promise.all([
      request(prueba.app).post("/api/auth/refrescar").set("Cookie", cookie),
      request(prueba.app).post("/api/auth/refrescar").set("Cookie", cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
    const rechazada = a.status === 401 ? a : b;
    expect(rechazada.body.error.codigo).toBe("REFRESH_YA_ROTADO");
  });

  it("logout: 204, borra la cookie y el refresh deja de servir", async () => {
    const { cookie } = await registrarUsuario(prueba.app);
    const salida = await request(prueba.app).post("/api/auth/logout").set("Cookie", cookie);
    expect(salida.status).toBe(204);
    expect(String(salida.headers["set-cookie"])).toContain("cartera_refresh=;");
    const despues = await request(prueba.app).post("/api/auth/refrescar").set("Cookie", cookie);
    expect(despues.status).toBe(401);
  });

  it("cambio de contraseña y login con la nueva", async () => {
    const { token, cookie } = await registrarUsuario(prueba.app, { email: "cambio@prueba.com" });
    const cambio = await request(prueba.app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", cookie)
      .send({ passwordActual: "clave-segura-123", passwordNueva: "otra-clave-segura" });
    expect(cambio.status).toBe(204);
    const login = await request(prueba.app)
      .post("/api/auth/login")
      .send({ email: "cambio@prueba.com", password: "otra-clave-segura" });
    expect(login.status).toBe(200);
  });
});

describe("API de autenticación con configuración especial", () => {
  it("registro deshabilitado: 403 explicado", async () => {
    const prueba = await crearAppPrueba({ REGISTRO_HABILITADO: "false" });
    const respuesta = await request(prueba.app)
      .post("/api/auth/registro")
      .send({ nombre: "X", email: "x@prueba.com", password: "clave-segura-123" });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.mensaje).toContain("deshabilitado");
    await prueba.cerrar();
  });

  it("límite de intentos: al superar el máximo responde 429", async () => {
    const prueba = await crearAppPrueba({ LOGIN_INTENTOS_MAX: "2" });
    const intento = () =>
      request(prueba.app).post("/api/auth/login").send({ email: "a@b.com", password: "x" });
    expect((await intento()).status).toBe(401);
    expect((await intento()).status).toBe(401);
    const tercero = await intento();
    expect(tercero.status).toBe(429);
    expect(tercero.body.error.codigo).toBe("DEMASIADOS_INTENTOS");
    await prueba.cerrar();
  });

  it("detrás de un proxy, el límite de intentos cuenta por IP real y no bloquea a todos", async () => {
    const prueba = await crearAppPrueba({ LOGIN_INTENTOS_MAX: "2", TRUST_PROXY: "true" });
    const intentoDesde = (ip: string) =>
      request(prueba.app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ email: "a@b.com", password: "x" });
    expect((await intentoDesde("203.0.113.1")).status).toBe(401);
    expect((await intentoDesde("203.0.113.1")).status).toBe(401);
    expect((await intentoDesde("203.0.113.1")).status).toBe(429);
    expect((await intentoDesde("198.51.100.7")).status).toBe(401);
    await prueba.cerrar();
  });

  it("el cambio de contraseña también tiene límite de intentos", async () => {
    const prueba = await crearAppPrueba({ LOGIN_INTENTOS_MAX: "2" });
    const { token } = await registrarUsuario(prueba.app);
    const intento = () =>
      request(prueba.app)
        .patch("/api/auth/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ passwordActual: "adivinando-123", passwordNueva: "otra-clave-segura" });
    expect((await intento()).status).toBe(400);
    expect((await intento()).status).toBe(400);
    const tercero = await intento();
    expect(tercero.status).toBe(429);
    await prueba.cerrar();
  });

  it("en producción la cookie es Secure", async () => {
    const prueba = await crearAppPrueba({ NODE_ENV: "production" });
    const respuesta = await request(prueba.app)
      .post("/api/auth/registro")
      .send({ nombre: "X", email: "prod@prueba.com", password: "clave-segura-123" });
    expect(String(respuesta.headers["set-cookie"])).toContain("Secure");
    await prueba.cerrar();
  });
});
