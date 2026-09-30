import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CarteraDto, Pagina } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";

describe("API de carteras", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;

  const como = (usuario: UsuarioLogueado) => ({
    get: (ruta: string) =>
      request(prueba.app).get(ruta).set("Authorization", `Bearer ${usuario.token}`),
    post: (ruta: string, cuerpo: object) =>
      request(prueba.app).post(ruta).set("Authorization", `Bearer ${usuario.token}`).send(cuerpo),
    patch: (ruta: string, cuerpo: object) =>
      request(prueba.app).patch(ruta).set("Authorization", `Bearer ${usuario.token}`).send(cuerpo),
    delete: (ruta: string) =>
      request(prueba.app).delete(ruta).set("Authorization", `Bearer ${usuario.token}`),
  });

  async function carteras(usuario: UsuarioLogueado, consulta = ""): Promise<CarteraDto[]> {
    const respuesta = await como(usuario).get(`/api/carteras${consulta}`).expect(200);
    return (respuesta.body as Pagina<CarteraDto>).items;
  }

  async function volverAPrincipalOriginal(usuario: UsuarioLogueado) {
    const original = (await carteras(usuario)).find((c) => c.nombre === "Principal");
    await como(usuario).patch(`/api/carteras/${original?.id}`, { esPrincipal: true }).expect(200);
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("al registrarse cada usuario tiene su cartera Principal", async () => {
    const lista = await carteras(ana);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nombre: "Principal", esPrincipal: true, archivada: false });
  });

  it("crea, obtiene y audita una cartera", async () => {
    const creada = await como(ana).post("/api/carteras", {
      nombre: "Jubilación",
      descripcion: "Largo plazo",
    });
    expect(creada.status).toBe(201);
    expect(creada.body).toMatchObject({
      nombre: "Jubilación",
      descripcion: "Largo plazo",
      esPrincipal: false,
    });
    const obtenida = await como(ana).get(`/api/carteras/${creada.body.id}`);
    expect(obtenida.body.nombre).toBe("Jubilación");
    const auditoria = await prueba.bd.registroAuditoria.findMany({
      where: { entidadId: creada.body.id },
    });
    expect(auditoria.map((r) => r.accion)).toEqual(["CREAR"]);
  });

  it("rechaza un nombre repetido explicando cuál", async () => {
    const respuesta = await como(ana).post("/api/carteras", { nombre: "Principal" });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toBe('Ya tenés una cartera llamada "Principal".');
  });

  it("valida el nombre: vacío y demasiado largo", async () => {
    const vacio = await como(ana).post("/api/carteras", { nombre: "   " });
    expect(vacio.status).toBe(400);
    expect(vacio.body.error.detalles[0]).toEqual({
      campo: "nombre",
      mensaje: "Poné un nombre para la cartera.",
    });
    const largo = await como(ana).post("/api/carteras", { nombre: "x".repeat(61) });
    expect(largo.status).toBe(400);
    expect(largo.body.error.detalles[0].mensaje).toBe("El nombre puede tener hasta 60 caracteres.");
  });

  it("ordenar por un campo inválido explica las opciones en lenguaje llano", async () => {
    const respuesta = await como(ana).get("/api/carteras?orden=noExiste");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].mensaje).toBe(
      "Valores posibles: orden, nombre, fecha de carga.",
    );
  });

  it("rechaza una edición vacía", async () => {
    const [principal] = await carteras(ana);
    const respuesta = await como(ana).patch(`/api/carteras/${principal?.id}`, {});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].mensaje).toBe("No mandaste ningún cambio.");
  });

  it("marcar otra como principal desmarca la anterior", async () => {
    const nueva = await como(ana).post("/api/carteras", { nombre: "Trading" }).expect(201);
    await como(ana).patch(`/api/carteras/${nueva.body.id}`, { esPrincipal: true }).expect(200);
    const principales = (await carteras(ana)).filter((c) => c.esPrincipal);
    expect(principales.map((c) => c.nombre)).toEqual(["Trading"]);
    await volverAPrincipalOriginal(ana);
  });

  it("no acepta esPrincipal:false y explica cómo cambiarla", async () => {
    const [principal] = (await carteras(ana)).filter((c) => c.esPrincipal);
    const respuesta = await como(ana).patch(`/api/carteras/${principal?.id}`, {
      esPrincipal: false,
    });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toContain("marcá otra como principal");
  });

  it("no deja archivar ni borrar la principal", async () => {
    const [principal] = (await carteras(ana)).filter((c) => c.esPrincipal);
    const archivar = await como(ana).patch(`/api/carteras/${principal?.id}`, { archivada: true });
    expect(archivar.status).toBe(409);
    const borrar = await como(ana).delete(`/api/carteras/${principal?.id}`);
    expect(borrar.status).toBe(409);
    expect(borrar.body.error.mensaje).toContain("Marcá otra como principal primero");
  });

  it("marcar como principal una cartera archivada la desarchiva", async () => {
    const creada = await como(ana).post("/api/carteras", { nombre: "Vieja" }).expect(201);
    await como(ana).patch(`/api/carteras/${creada.body.id}`, { archivada: true }).expect(200);
    const principal = await como(ana).patch(`/api/carteras/${creada.body.id}`, {
      esPrincipal: true,
    });
    expect(principal.status).toBe(200);
    expect(principal.body).toMatchObject({ esPrincipal: true, archivada: false });
    await volverAPrincipalOriginal(ana);
  });

  it("el listado oculta las archivadas salvo que se pidan", async () => {
    const creada = await como(ana).post("/api/carteras", { nombre: "Archivada" }).expect(201);
    await como(ana).patch(`/api/carteras/${creada.body.id}`, { archivada: true }).expect(200);
    expect((await carteras(ana)).map((c) => c.nombre)).not.toContain("Archivada");
    expect((await carteras(ana, "?incluirArchivadas=true")).map((c) => c.nombre)).toContain(
      "Archivada",
    );
  });

  it("borra (lógicamente) una cartera que no es la principal", async () => {
    const creada = await como(ana).post("/api/carteras", { nombre: "Para borrar" }).expect(201);
    expect((await como(ana).delete(`/api/carteras/${creada.body.id}`)).status).toBe(204);
    expect((await como(ana).get(`/api/carteras/${creada.body.id}`)).status).toBe(404);
    const recreada = await como(ana).post("/api/carteras", { nombre: "Para borrar" });
    expect(recreada.status).toBe(201);
  });

  it("aislamiento: otro usuario no ve, no edita y no borra carteras ajenas", async () => {
    const deAna = await como(ana).post("/api/carteras", { nombre: "Privada de Ana" }).expect(201);
    const ruta = `/api/carteras/${deAna.body.id}`;
    expect((await como(beto).get(ruta)).status).toBe(404);
    expect((await como(beto).patch(ruta, { nombre: "Hackeada" })).status).toBe(404);
    expect((await como(beto).delete(ruta)).status).toBe(404);
    expect((await carteras(beto)).map((c) => c.nombre)).toEqual(["Principal"]);
    expect((await como(ana).get(ruta)).body.nombre).toBe("Privada de Ana");
  });

  it("cada cartera nueva va al final del orden", async () => {
    const usuario = await registrarUsuario(prueba.app);
    const primera = await como(usuario).post("/api/carteras", { nombre: "Uno" }).expect(201);
    const segunda = await como(usuario).post("/api/carteras", { nombre: "Dos" }).expect(201);
    expect(primera.body.orden).toBe(1);
    expect(segunda.body.orden).toBe(2);
    expect((await carteras(usuario)).map((c) => c.nombre)).toEqual(["Principal", "Uno", "Dos"]);
  });

  it("detecta el nombre repetido sin importar mayúsculas ni espacios", async () => {
    const respuesta = await como(ana).post("/api/carteras", { nombre: "  PRINCIPAL " });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toBe('Ya tenés una cartera llamada "Principal".');
  });

  it("al cambiar la principal también queda auditado el cambio de la anterior", async () => {
    const usuario = await registrarUsuario(prueba.app);
    const [original] = await carteras(usuario);
    const nueva = await como(usuario).post("/api/carteras", { nombre: "Nueva" }).expect(201);
    await como(usuario).patch(`/api/carteras/${nueva.body.id}`, { esPrincipal: true }).expect(200);
    const registros = await prueba.bd.registroAuditoria.findMany({
      where: { entidadId: original?.id, accion: "EDITAR" },
    });
    expect(registros).toHaveLength(1);
    expect(registros[0]?.antes).toMatchObject({ esPrincipal: true });
    expect(registros[0]?.despues).toMatchObject({ esPrincipal: false });
  });

  it("rechaza una página absurda con un 400 explicado", async () => {
    const respuesta = await como(ana).get("/api/carteras?pagina=9000000000000");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].campo).toBe("pagina");
  });

  it("una página más allá de la última devuelve lista vacía con los totales", async () => {
    const respuesta = await como(ana).get("/api/carteras?pagina=99");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.items).toEqual([]);
    expect(respuesta.body.pagina).toBe(99);
    expect(respuesta.body.total).toBeGreaterThan(0);
  });

  it("rechaza ordenar por un campo no permitido", async () => {
    const respuesta = await como(ana).get("/api/carteras?orden=usuarioId");
    expect(respuesta.status).toBe(400);
  });
});
