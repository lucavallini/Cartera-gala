import { describe, expect, it } from "vitest";
import { cargarEntorno } from "../../src/config/entorno";

const minimo = { DATABASE_URL: "file:./x.db", JWT_SECRETO: "s".repeat(32) };

describe("cargarEntorno", () => {
  it("aplica los valores por defecto", () => {
    const entorno = cargarEntorno(minimo);
    expect(entorno.NODE_ENV).toBe("development");
    expect(entorno.PORT).toBe(3000);
    expect(entorno.CORS_ORIGEN).toBe("http://localhost:4200");
    expect(entorno.JWT_ACCESO_MINUTOS).toBe(15);
    expect(entorno.REFRESH_DIAS).toBe(30);
    expect(entorno.REGISTRO_HABILITADO).toBe(true);
    expect(entorno.LOGIN_INTENTOS_MAX).toBe(10);
    expect(entorno.LOGIN_VENTANA_MINUTOS).toBe(15);
    expect(entorno.ZONA_HORARIA).toBe("America/Argentina/Buenos_Aires");
  });

  it("convierte números y booleanos que llegan como texto", () => {
    const entorno = cargarEntorno({ ...minimo, PORT: "8080", REGISTRO_HABILITADO: "false" });
    expect(entorno.PORT).toBe(8080);
    expect(entorno.REGISTRO_HABILITADO).toBe(false);
  });

  it("dice qué variables faltan", () => {
    expect(() => cargarEntorno({})).toThrow(/DATABASE_URL/);
    expect(() => cargarEntorno({})).toThrow(/JWT_SECRETO/);
  });

  it("rechaza un secreto JWT corto explicando el mínimo", () => {
    expect(() => cargarEntorno({ ...minimo, JWT_SECRETO: "corto" })).toThrow(/al menos 32/);
  });

  it("rechaza el secreto de ejemplo del .env.example y dice cómo generar uno", () => {
    expect(() =>
      cargarEntorno({
        ...minimo,
        JWT_SECRETO: "cambiar-por-un-secreto-aleatorio-de-al-menos-32-caracteres",
      }),
    ).toThrow(/Cambiá JWT_SECRETO.*randomBytes/s);
  });

  it("rechaza un booleano mal escrito", () => {
    expect(() => cargarEntorno({ ...minimo, REGISTRO_HABILITADO: "si" })).toThrow(
      /REGISTRO_HABILITADO/,
    );
  });
});
