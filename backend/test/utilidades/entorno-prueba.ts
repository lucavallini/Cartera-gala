import { cargarEntorno, type Entorno } from "../../src/config/entorno";

export function entornoPrueba(extra: Record<string, string> = {}): Entorno {
  return cargarEntorno({
    NODE_ENV: "test",
    DATABASE_URL: "file:no-se-usa-en-tests.db",
    JWT_SECRETO: "secreto-de-prueba-".padEnd(40, "x"),
    LOGIN_INTENTOS_MAX: "1000",
    ...extra,
  });
}
