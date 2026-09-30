# Plan 1 — Fundaciones del backend · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando el backend base de la app de cartera: monorepo, configuración validada, manejo de errores, esquema Prisma completo (22 modelos), repositorios y auditoría reutilizables, autenticación real (registro, login, refresh rotado, cambio de contraseña) y los ABM de carteras y cuentas con aislamiento por usuario.

**Architecture:** Monorepo con npm workspaces (`contratos/` con tipos compartidos, `backend/` con Express 5). El backend se organiza en capas (rutas → controladores → servicios → repositorios) con clases base que centralizan paginación, borrado lógico, alcance por usuario y auditoría. Cada módulo expone una fábrica en su `index.ts` y `contenedor.ts` compone todo.

**Tech Stack:** Node ≥ 22 · TypeScript ~6.0.3 · Express 5 · Prisma 7.10.0 + `@prisma/adapter-better-sqlite3` · zod 4 · argon2 · jose · Vitest 5 · supertest · ESLint 10 + typescript-eslint + eslint-plugin-boundaries 7 · Prettier 3.

**Spec:** `docs/superpowers/specs/2026-09-28-cartera-inversiones-design.md` (secciones 1, 3, 3.1, 4, 5.1, 5.5 —solo auth, carteras y cuentas—, 5.7, 5.8, 5.9, 8 y 9).

**Serie de planes de la etapa 1:** este es el plan 1 de 4.
Plan 2: motor e instrumentos (catálogo, cotizaciones, dólar, operaciones, valuación, resumen).
Plan 3: integraciones (flujos y calendario, noticias con IA, importación/exportación, glosario, tareas).
Plan 4: frontend Angular.

## Global Constraints

- **Git lo maneja Luca.** Prohibido `git add`, `git commit`, `git branch`, `git checkout -b`, `git push`, `git init`. Cada tarea termina mostrando `git status --short` para dejar a la vista qué cambió.
- Node `>=22`. TypeScript **`~6.0.3`** (Angular 22 y typescript-eslint exigen `<6.1`; no usar la 7).
- Prisma **exactamente `7.10.0`** (`prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3`). La etiqueta `latest` apunta a una RC 8: no usarla.
- Prisma 7: `prisma migrate dev` **no** genera el cliente; siempre correr `prisma generate` después. El cliente se genera en `backend/src/generado/prisma/` y se importa desde `.../generado/prisma/client` (enums desde `.../generado/prisma/enums`).
- Importes, cantidades, precios y tasas: `Decimal`, nunca `Float`.
- TypeScript `strict`, sin `any`, sin `!` (non-null assertion). Importaciones de solo tipos con `import type`.
- Nombres de dominio en castellano; sufijos fijos: `.rutas.ts`, `.controlador.ts`, `.servicio.ts`, `.repositorio.ts`, `.esquemas.ts`.
- Mensajes de error para el usuario en castellano, que digan qué está mal y cómo corregirlo. Formato de error de la API: `{ "error": { "codigo", "mensaje", "detalles"? } }`.
- Reglas de capas (ESLint): un controlador o archivo de rutas no importa repositorios, proveedores ni el cliente generado; el motor no importa servicios, repositorios, controladores, proveedores ni el cliente generado.
- Contraseñas: argon2id, mínimo 10 caracteres, máximo 200. Token de acceso JWT 15 min; refresh opaco en cookie `httpOnly`, `SameSite=Strict`, `Secure` en producción, `Path=/api/auth`, rotado en cada uso.
- El `.env` vive en `backend/` (se copia de `backend/.env.example`).
- Todos los comandos se corren desde la raíz del repo salvo que se indique `cd backend`.

## Review Focus

1. **Refresco simultáneo desde dos pestañas** con la misma cookie: el segundo pedido no debe cerrar la sesión del usuario (hay una gracia de 10 s en la que el reuso del token recién rotado responde 401 sin revocar la cadena). Test en la Tarea 8.
2. **Correr `npm run db:seed` dos veces**: la segunda vez informa que el administrador ya existía y no falla. Test en la Tarea 12.
3. **Login con el email en otra combinación de mayúsculas o con espacios** (`"  Luca@Mail.com "`) tras registrarse con `luca@mail.com`: debe entrar. Test en la Tarea 8.
4. **Pedir una página más allá de la última** (`?pagina=9` con 3 registros): lista vacía con `total` y `totalPaginas` correctos, no error. Test en la Tarea 5.
5. **Marcar como principal una cartera archivada**: queda principal y desarchivada, nunca "principal y archivada". Test en la Tarea 10.

---

## Estructura de archivos de este plan

```
Cartera-gala/
├── package.json                      workspaces + scripts globales
├── tsconfig.base.json                opciones de TS compartidas
├── eslint.config.js                  reglas de estilo y de capas
├── .prettierrc.json · .prettierignore · .gitignore
├── contratos/
│   ├── package.json · tsconfig.json
│   └── src/
│       ├── index.ts                  re-exporta todo
│       ├── comunes.ts                enums compartidos como uniones de strings
│       ├── errores.ts                forma de la respuesta de error
│       ├── paginacion.ts             Pagina<T>
│       ├── autenticacion.ts          DTOs de auth
│       ├── carteras.ts               DTOs de carteras
│       └── cuentas.ts                DTOs de cuentas
└── backend/
    ├── package.json · tsconfig.json · vitest.config.ts · prisma.config.ts · .env.example
    ├── prisma/
    │   ├── schema.prisma             los 22 modelos
    │   ├── migrations/               generada por Prisma
    │   └── seed.ts                   crea el administrador
    ├── src/
    │   ├── app.ts                    arma Express (middlewares, rutas, errores)
    │   ├── server.ts                 arranca el servidor
    │   ├── contenedor.ts             composición de módulos
    │   ├── config/entorno.ts         variables de entorno validadas
    │   ├── tipos/express.d.ts        req.usuario
    │   ├── semillas/administrador.ts lógica del seed (testeable)
    │   ├── compartido/
    │   │   ├── errores.ts            ErrorApp y subclases
    │   │   ├── validacion.ts         validar() con zod
    │   │   ├── paginacion.ts         esquema de listado y armado de páginas
    │   │   ├── json.ts               aJson() para columnas JSON
    │   │   ├── base-datos/cliente.ts crearClienteBD(), ClienteBD
    │   │   ├── repositorios/         delegado-prisma.ts · repositorio-base.ts · repositorio-del-usuario.ts
    │   │   ├── auditoria/            auditoria.repositorio.ts · servicio-auditado.ts
    │   │   └── http/                 manejador-errores.ts · ruta-no-encontrada.ts · usuario-de.ts · parametros.ts · controlador-crud.ts · rutas-crud.ts
    │   └── modulos/
    │       ├── autenticacion/        contrasenas.ts · tokens.ts · usuarios.repositorio.ts · sesiones.repositorio.ts · autenticacion.servicio.ts · autenticacion.esquemas.ts · autenticacion.controlador.ts · autenticacion.rutas.ts · requiere-autenticacion.ts · index.ts
    │       ├── carteras/             carteras.repositorio.ts · carteras.servicio.ts · carteras.esquemas.ts · carteras.controlador.ts · carteras.rutas.ts · index.ts
    │       └── cuentas/              (misma forma que carteras)
    └── test/
        ├── preparar-plantilla.ts     globalSetup: migra una base plantilla
        ├── utilidades/               base-datos-prueba.ts · entorno-prueba.ts · app-prueba.ts · fabricas.ts · cuentas-prueba.ts
        ├── config/ · compartido/ · modulos/ · semillas/   (espejan src/)
```

---

### Task 1: Monorepo, herramientas y app mínima

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`
- Create: `contratos/package.json`, `contratos/tsconfig.json`, `contratos/src/index.ts`, `contratos/src/comunes.ts`, `contratos/src/errores.ts`, `contratos/src/paginacion.ts`
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/src/app.ts`
- Test: `backend/test/app.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `crearApp(): Express` (se reemplaza en la Tarea 9 por `crearApp(contenedor)`); tipos `RolUsuario`, `Moneda`, `TipoDolar`, `MetodoCosto`, `DetalleError`, `RespuestaError`, `Pagina<T>` en `@cartera/contratos`.

- [ ] **Step 1: Crear los archivos raíz**

`package.json`:
```json
{
  "name": "cartera-gala",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": ["contratos", "backend"],
  "scripts": {
    "dev": "npm run dev -w @cartera/backend",
    "test": "npm run test --workspaces --if-present",
    "tipos": "npm run tipos --workspaces --if-present",
    "lint": "eslint .",
    "formato": "prettier --write .",
    "formato:verificar": "prettier --check .",
    "db:migrate": "npm run db:migrate -w @cartera/backend",
    "db:seed": "npm run db:seed -w @cartera/backend"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`eslint.config.js`:
```js
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/generado/**", "**/dist/**", "**/.angular/**", "**/coverage/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["backend/src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { project: "backend/tsconfig.json" } },
      "boundaries/include": ["backend/src/**/*"],
      "boundaries/elements": [
        { type: "motor", pattern: "backend/src/motor" },
        { type: "proveedores", pattern: "backend/src/proveedores" },
        { type: "generado", pattern: "backend/src/generado" },
      ],
      "boundaries/files": [
        { category: "rutas", pattern: "**/*.rutas.ts" },
        { category: "controlador", pattern: "**/*.controlador.ts" },
        { category: "servicio", pattern: "**/*.servicio.ts" },
        { category: "repositorio", pattern: "**/*.repositorio.ts" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { file: { categories: { anyOf: ["rutas", "controlador"] } } },
              disallow: {
                to: [
                  { file: { categories: "repositorio" } },
                  { element: { type: "generado" } },
                  { element: { type: "proveedores" } },
                ],
              },
            },
            {
              from: { element: { type: "motor" } },
              disallow: {
                to: [
                  { file: { categories: { anyOf: ["rutas", "controlador", "servicio", "repositorio"] } } },
                  { element: { type: "generado" } },
                  { element: { type: "proveedores" } },
                ],
              },
            },
            {
              from: { element: { type: "proveedores" } },
              disallow: {
                to: [
                  { file: { categories: { anyOf: ["rutas", "controlador", "servicio", "repositorio"] } } },
                  { element: { type: "generado" } },
                ],
              },
            },
          ],
        },
      ],
    },
  },
);
```

`.prettierrc.json`:
```json
{ "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:
```
node_modules
**/generado
**/migrations
package-lock.json
docs
/*.html
*.db
```

`.gitignore`:
```
node_modules/
backend/src/generado/
backend/.env
*.db
*.db-journal
backend/test/.plantilla.db
coverage/
dist/
.angular/
```

- [ ] **Step 2: Crear el paquete `contratos`**

`contratos/package.json`:
```json
{
  "name": "@cartera/contratos",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "tipos": "tsc -p ." }
}
```

`contratos/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src"] }
```

`contratos/src/comunes.ts`:
```ts
export type RolUsuario = "ADMIN" | "USUARIO";
export type Moneda = "ARS" | "USD_MEP" | "USD_CCL" | "USD_EXTERIOR";
export type TipoDolar = "OFICIAL" | "MEP" | "CCL" | "BLUE" | "MAYORISTA" | "CRIPTO";
export type MetodoCosto = "PRECIO_PROMEDIO" | "FIFO";
```

`contratos/src/errores.ts`:
```ts
export interface DetalleError {
  campo: string;
  mensaje: string;
}

export interface RespuestaError {
  error: {
    codigo: string;
    mensaje: string;
    detalles?: DetalleError[];
  };
}
```

`contratos/src/paginacion.ts`:
```ts
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}
```

`contratos/src/index.ts`:
```ts
export * from "./comunes";
export * from "./errores";
export * from "./paginacion";
```

- [ ] **Step 3: Crear el paquete `backend` e instalar dependencias**

`backend/package.json`:
```json
{
  "name": "@cartera/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "test": "vitest run",
    "test:vigilar": "vitest",
    "tipos": "tsc -p ."
  },
  "dependencies": {
    "@cartera/contratos": "*"
  }
}
```

`backend/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "prisma", "prisma.config.ts", "vitest.config.ts"]
}
```

`backend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

Instalar:
```bash
npm install -D typescript@~6.0.3 @types/node@^22 eslint@^10 typescript-eslint eslint-plugin-boundaries@^7 eslint-import-resolver-typescript prettier@^3
npm install -w @cartera/backend express@^5
npm install -D -w @cartera/backend vitest@^5 supertest @types/supertest @types/express tsx
```
Expected: sin errores; `node_modules/@cartera/contratos` es un enlace a `contratos/`.

- [ ] **Step 4: Escribir el test que falla**

`backend/test/app.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { crearApp } from "../src/app";

describe("app", () => {
  it("responde el chequeo de salud", async () => {
    const respuesta = await request(crearApp()).get("/api/salud");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });
});
```

- [ ] **Step 5: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend`
Expected: FAIL — no se puede resolver `../src/app`.

- [ ] **Step 6: Implementar la app mínima**

`backend/src/app.ts`:
```ts
import express, { type Express } from "express";

export function crearApp(): Express {
  const app = express();
  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });
  return app;
}
```

- [ ] **Step 7: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: 1 test PASS; `tsc` sin errores en `contratos` y `backend`; ESLint sin problemas.

- [ ] **Step 8: Verificar que la regla de capas funciona (y limpiar)**

```bash
mkdir -p backend/src/modulos/_verificacion
printf 'export const dato = 1;\n' > backend/src/modulos/_verificacion/x.repositorio.ts
printf 'import { dato } from "./x.repositorio";\nexport const copia = dato;\n' > backend/src/modulos/_verificacion/x.controlador.ts
npx eslint backend/src/modulos/_verificacion; echo "salida=$?"
rm -rf backend/src/modulos/_verificacion
```
Expected: un error `boundaries/dependencies` ("Dependencies to file of category "repositorio" are not allowed in file of category "controlador"") y `salida=1`. Después del `rm`, la carpeta no existe.

- [ ] **Step 9: Mostrar el estado**

Run: `git status --short`
Expected: aparecen los archivos nuevos sin agregar. No correr `git add`.

---

### Task 2: Configuración de entorno validada

**Files:**
- Create: `backend/src/config/entorno.ts`, `backend/.env.example`
- Test: `backend/test/config/entorno.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `cargarEntorno(fuente?: Record<string, string | undefined>): Entorno` y `type Entorno` con: `NODE_ENV: "development" | "test" | "production"`, `PORT: number`, `DATABASE_URL: string`, `CORS_ORIGEN: string`, `JWT_SECRETO: string`, `JWT_ACCESO_MINUTOS: number`, `REFRESH_DIAS: number`, `REGISTRO_HABILITADO: boolean`, `LOGIN_INTENTOS_MAX: number`, `LOGIN_VENTANA_MINUTOS: number`, `ZONA_HORARIA: string`.

- [ ] **Step 1: Instalar zod y dotenv**

Run: `npm install -w @cartera/backend zod@^4 dotenv`

- [ ] **Step 2: Escribir el test que falla**

`backend/test/config/entorno.test.ts`:
```ts
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

  it("rechaza un booleano mal escrito", () => {
    expect(() => cargarEntorno({ ...minimo, REGISTRO_HABILITADO: "si" })).toThrow(
      /REGISTRO_HABILITADO/,
    );
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/config`
Expected: FAIL — no se puede resolver `../../src/config/entorno`.

- [ ] **Step 4: Implementar**

`backend/src/config/entorno.ts`:
```ts
import { z } from "zod";

const booleano = z
  .enum(["true", "false"], { message: 'Tiene que ser "true" o "false".' })
  .transform((valor) => valor === "true");

const entero = z.coerce.number().int().positive();

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: entero.default(3000),
  DATABASE_URL: z.string({ message: "Falta la ruta de la base de datos." }).min(1),
  CORS_ORIGEN: z.url().default("http://localhost:4200"),
  JWT_SECRETO: z
    .string({ message: "Falta el secreto para firmar los tokens." })
    .min(32, "Tiene que tener al menos 32 caracteres."),
  JWT_ACCESO_MINUTOS: entero.default(15),
  REFRESH_DIAS: entero.default(30),
  REGISTRO_HABILITADO: booleano.default(true),
  LOGIN_INTENTOS_MAX: entero.default(10),
  LOGIN_VENTANA_MINUTOS: entero.default(15),
  ZONA_HORARIA: z.string().default("America/Argentina/Buenos_Aires"),
});

export type Entorno = z.output<typeof esquemaEntorno>;

export function cargarEntorno(fuente: Record<string, string | undefined> = process.env): Entorno {
  const resultado = esquemaEntorno.safeParse(fuente);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((problema) => `${problema.path.join(".")}: ${problema.message}`)
      .join("\n  ");
    throw new Error(`La configuración del .env no es válida:\n  ${problemas}`);
  }
  return resultado.data;
}
```

`backend/.env.example`:
```bash
# Entorno: development | test | production
NODE_ENV=development
# Puerto del backend
PORT=3000
# Base de datos. En local es un archivo SQLite dentro de backend/
DATABASE_URL="file:./cartera.db"
# Dirección del frontend (para CORS)
CORS_ORIGEN=http://localhost:4200

# Secreto para firmar los tokens de acceso. Mínimo 32 caracteres, aleatorio.
# Generar uno con: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRETO=cambiar-por-un-secreto-aleatorio-de-al-menos-32-caracteres
# Minutos que dura el token de acceso
JWT_ACCESO_MINUTOS=15
# Días que dura una sesión sin actividad
REFRESH_DIAS=30
# true = cualquiera puede crearse una cuenta; false = solo el administrador
REGISTRO_HABILITADO=true
# Límite de intentos de login/registro por IP dentro de la ventana
LOGIN_INTENTOS_MAX=10
LOGIN_VENTANA_MINUTOS=15
ZONA_HORARIA=America/Argentina/Buenos_Aires
```

- [ ] **Step 5: Correr tests y tipos**

Run: `npm test -w @cartera/backend -- test/config && npm run tipos`
Expected: 5 tests PASS; `tsc` sin errores.

- [ ] **Step 6: Mostrar el estado**

Run: `git status --short`

---

### Task 3: Errores, validación y middleware de errores

**Files:**
- Create: `backend/src/compartido/errores.ts`, `backend/src/compartido/validacion.ts`, `backend/src/compartido/http/manejador-errores.ts`, `backend/src/compartido/http/ruta-no-encontrada.ts`
- Test: `backend/test/compartido/validacion.test.ts`, `backend/test/compartido/manejador-errores.test.ts`

**Interfaces:**
- Consumes: `DetalleError`, `RespuestaError` de `@cartera/contratos`.
- Produces:
  - `abstract class ErrorApp extends Error { codigo: string; status: number; detalles?: DetalleError[] }`
  - `ErrorValidacion(mensaje?, detalles?)` 400 `VALIDACION` · `ErrorNoAutorizado(mensaje?)` 401 `NO_AUTORIZADO` · `ErrorProhibido(mensaje?)` 403 `PROHIBIDO` · `ErrorNoEncontrado(entidad)` 404 `NO_ENCONTRADO` · `ErrorConflicto(mensaje)` 409 `CONFLICTO` · `ErrorDemasiadosIntentos(mensaje?)` 429 `DEMASIADOS_INTENTOS` · `ErrorProveedorExterno(mensaje)` 502 `PROVEEDOR_EXTERNO`
  - `validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T>`
  - `crearManejadorErrores(registrar?: (error: unknown) => void): ErrorRequestHandler`
  - `rutaNoEncontrada: RequestHandler`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/test/compartido/validacion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validar } from "../../src/compartido/validacion";
import { ErrorNoEncontrado, ErrorValidacion } from "../../src/compartido/errores";

const esquema = z.object({
  nombre: z.string().min(2, "Mínimo 2 letras."),
  datos: z.object({ edad: z.number().int("Tiene que ser un número entero.") }),
});

describe("validar", () => {
  it("devuelve los datos cuando son válidos", () => {
    expect(validar(esquema, { nombre: "Ana", datos: { edad: 30 } })).toEqual({
      nombre: "Ana",
      datos: { edad: 30 },
    });
  });

  it("lanza ErrorValidacion con un detalle por campo, con la ruta completa", () => {
    try {
      validar(esquema, { nombre: "A", datos: { edad: 1.5 } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorValidacion);
      const detalles = (error as ErrorValidacion).detalles;
      expect(detalles).toEqual(
        expect.arrayContaining([
          { campo: "nombre", mensaje: "Mínimo 2 letras." },
          { campo: "datos.edad", mensaje: "Tiene que ser un número entero." },
        ]),
      );
    }
  });
});

describe("errores", () => {
  it("ErrorNoEncontrado arma el mensaje con la entidad", () => {
    const error = new ErrorNoEncontrado("la cartera");
    expect(error.message).toBe("No se encontró la cartera.");
    expect(error.status).toBe(404);
    expect(error.codigo).toBe("NO_ENCONTRADO");
    expect(error.name).toBe("ErrorNoEncontrado");
  });
});
```

`backend/test/compartido/manejador-errores.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { crearManejadorErrores } from "../../src/compartido/http/manejador-errores";
import { rutaNoEncontrada } from "../../src/compartido/http/ruta-no-encontrada";
import { ErrorConflicto, ErrorValidacion } from "../../src/compartido/errores";

function appCon(manejador: RequestHandler, registrar: (error: unknown) => void = () => {}) {
  const app = express();
  app.use(express.json());
  app.post("/prueba", manejador);
  app.use(rutaNoEncontrada);
  app.use(crearManejadorErrores(registrar));
  return app;
}

describe("manejador de errores", () => {
  it("responde un ErrorApp con su status, código y mensaje", async () => {
    const app = appCon(() => {
      throw new ErrorConflicto('Ya tenés una cartera llamada "Principal".');
    });
    const respuesta = await request(app).post("/prueba").send({});
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: { codigo: "CONFLICTO", mensaje: 'Ya tenés una cartera llamada "Principal".' },
    });
  });

  it("incluye los detalles de validación", async () => {
    const app = appCon(async () => {
      throw new ErrorValidacion("Revisá los datos.", [{ campo: "nombre", mensaje: "Falta." }]);
    });
    const respuesta = await request(app).post("/prueba").send({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles).toEqual([{ campo: "nombre", mensaje: "Falta." }]);
  });

  it("oculta los errores inesperados y los registra", async () => {
    const registrar = vi.fn();
    const app = appCon(() => {
      throw new Error("detalle interno que no debe salir");
    }, registrar);
    const respuesta = await request(app).post("/prueba").send({});
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.codigo).toBe("ERROR_INTERNO");
    expect(JSON.stringify(respuesta.body)).not.toContain("detalle interno");
    expect(registrar).toHaveBeenCalledOnce();
  });

  it("explica cuando el cuerpo no es JSON válido", async () => {
    const app = appCon((_req, res) => {
      res.json({});
    });
    const respuesta = await request(app)
      .post("/prueba")
      .set("Content-Type", "application/json")
      .send("{mal json");
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe("JSON_INVALIDO");
  });

  it("responde 404 en JSON para rutas inexistentes", async () => {
    const respuesta = await request(appCon(() => {})).get("/no-existe");
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toEqual({
      codigo: "NO_ENCONTRADO",
      mensaje: "No se encontró la ruta GET /no-existe.",
    });
  });
});
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm test -w @cartera/backend -- test/compartido`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar los errores**

`backend/src/compartido/errores.ts`:
```ts
import type { DetalleError } from "@cartera/contratos";

export abstract class ErrorApp extends Error {
  protected constructor(
    readonly codigo: string,
    mensaje: string,
    readonly status: number,
    readonly detalles?: DetalleError[],
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErrorValidacion extends ErrorApp {
  constructor(mensaje = "Hay datos inválidos. Revisá los campos marcados.", detalles?: DetalleError[]) {
    super("VALIDACION", mensaje, 400, detalles);
  }
}

export class ErrorNoAutorizado extends ErrorApp {
  constructor(mensaje = "Tenés que iniciar sesión.") {
    super("NO_AUTORIZADO", mensaje, 401);
  }
}

export class ErrorProhibido extends ErrorApp {
  constructor(mensaje = "No tenés permiso para hacer esto.") {
    super("PROHIBIDO", mensaje, 403);
  }
}

export class ErrorNoEncontrado extends ErrorApp {
  /** @param entidad con artículo, por ejemplo "la cartera". */
  constructor(entidad: string) {
    super("NO_ENCONTRADO", `No se encontró ${entidad}.`, 404);
  }
}

export class ErrorConflicto extends ErrorApp {
  constructor(mensaje: string) {
    super("CONFLICTO", mensaje, 409);
  }
}

export class ErrorDemasiadosIntentos extends ErrorApp {
  constructor(mensaje = "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.") {
    super("DEMASIADOS_INTENTOS", mensaje, 429);
  }
}

export class ErrorProveedorExterno extends ErrorApp {
  constructor(mensaje: string) {
    super("PROVEEDOR_EXTERNO", mensaje, 502);
  }
}
```

- [ ] **Step 4: Implementar la validación**

`backend/src/compartido/validacion.ts`:
```ts
import { z } from "zod";
import { ErrorValidacion } from "./errores";

z.config(z.locales.es());

export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorValidacion(
      "Hay datos inválidos. Revisá los campos marcados.",
      resultado.error.issues.map((problema) => ({
        campo: problema.path.join("."),
        mensaje: problema.message,
      })),
    );
  }
  return resultado.data;
}
```

- [ ] **Step 5: Implementar el middleware de errores y el 404**

`backend/src/compartido/http/manejador-errores.ts`:
```ts
import type { ErrorRequestHandler } from "express";
import type { DetalleError, RespuestaError } from "@cartera/contratos";
import { ErrorApp } from "../errores";

interface ErrorDeCuerpo {
  type: string;
  status: number;
}

function esErrorDeCuerpo(error: unknown): error is ErrorDeCuerpo {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string" &&
    "status" in error &&
    typeof error.status === "number"
  );
}

function cuerpo(codigo: string, mensaje: string, detalles?: DetalleError[]): RespuestaError {
  return { error: detalles ? { codigo, mensaje, detalles } : { codigo, mensaje } };
}

export function crearManejadorErrores(
  registrar: (error: unknown) => void = console.error,
): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof ErrorApp) {
      res.status(error.status).json(cuerpo(error.codigo, error.message, error.detalles));
      return;
    }
    if (esErrorDeCuerpo(error)) {
      if (error.type === "entity.parse.failed") {
        res.status(400).json(cuerpo("JSON_INVALIDO", "El cuerpo del pedido no es JSON válido."));
        return;
      }
      if (error.type === "entity.too.large") {
        res.status(413).json(cuerpo("DEMASIADO_GRANDE", "El pedido es demasiado grande."));
        return;
      }
    }
    registrar(error);
    res
      .status(500)
      .json(
        cuerpo(
          "ERROR_INTERNO",
          "Ocurrió un error inesperado. Probá de nuevo en unos segundos.",
        ),
      );
  };
}
```

`backend/src/compartido/http/ruta-no-encontrada.ts`:
```ts
import type { RequestHandler } from "express";
import { ErrorNoEncontrado } from "../errores";

export const rutaNoEncontrada: RequestHandler = (req) => {
  throw new ErrorNoEncontrado(`la ruta ${req.method} ${req.path}`);
};
```

- [ ] **Step 6: Correr tests, tipos y lint**

Run: `npm test -w @cartera/backend && npm run tipos && npm run lint`
Expected: todos PASS; sin errores de tipos ni de lint.

- [ ] **Step 7: Mostrar el estado**

Run: `git status --short`

---

### Task 4: Esquema Prisma completo, cliente y base de pruebas

**Files:**
- Create: `backend/prisma/schema.prisma`, `backend/prisma.config.ts`, `backend/src/compartido/base-datos/cliente.ts`
- Create: `backend/test/preparar-plantilla.ts`, `backend/test/utilidades/base-datos-prueba.ts`
- Modify: `backend/vitest.config.ts`, `backend/package.json` (scripts), `backend/src/compartido/http/manejador-errores.ts` (conflictos de Prisma)
- Test: `backend/test/compartido/base-datos.test.ts`, `backend/test/compartido/manejador-errores-prisma.test.ts`

**Interfaces:**
- Consumes: `crearManejadorErrores` (Tarea 3).
- Produces:
  - `type ClienteBD = PrismaClient | Prisma.TransactionClient`
  - `crearClienteBD(url: string): PrismaClient`
  - (tests) `RUTA_PLANTILLA: string`; `crearBasePrueba(): Promise<{ bd: PrismaClient; cerrar: () => Promise<void> }>`

- [ ] **Step 1: Instalar Prisma 7.10.0 con el adaptador de SQLite**

```bash
npm install -w @cartera/backend @prisma/client@7.10.0 @prisma/adapter-better-sqlite3@7.10.0
npm install -D -w @cartera/backend prisma@7.10.0 @types/better-sqlite3
```

- [ ] **Step 2: Escribir la configuración de Prisma**

`backend/prisma.config.ts`:
```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

- [ ] **Step 3: Escribir el esquema completo**

`backend/prisma/schema.prisma` (validado con `prisma validate` y migrado en una prueba previa; copiar tal cual):
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generado/prisma"
}

datasource db {
  provider = "sqlite"
}

// ───────────── Enums ─────────────

enum Rol {
  ADMIN
  USUARIO
}

enum Moneda {
  ARS
  USD_MEP
  USD_CCL
  USD_EXTERIOR
}

enum TipoDolar {
  OFICIAL
  MEP
  CCL
  BLUE
  MAYORISTA
  CRIPTO
}

enum MetodoCosto {
  PRECIO_PROMEDIO
  FIFO
}

enum TipoInstrumento {
  ACCION
  CEDEAR
  ON
  BONO
  LETRA
  FCI
  ETF_EXTERIOR
  CAUCION
  PLAZO_FIJO
  CRIPTO
  OPCION
  FUTURO
  INDICE
  OTRO
}

enum Mercado {
  BYMA
  MAE
  NYSE
  NASDAQ
  CRIPTO
  FONDO
  BANCO
  OTRO
}

enum TipoAjuste {
  NINGUNO
  CER
  DOLAR_LINKED
  TASA_FIJA
  BADLAR
  TAMAR
  UVA
  OTRO
}

enum Ley {
  ARGENTINA
  NUEVA_YORK
  OTRA
}

enum TipoOperacion {
  TENENCIA_INICIAL
  COMPRA
  VENTA
  DIVIDENDO
  RENTA
  AMORTIZACION
  SUSCRIPCION_FCI
  RESCATE_FCI
  DEPOSITO
  EXTRACCION
  COMPRA_MONEDA
  VENTA_MONEDA
  CAUCION_COLOCACION
  CAUCION_VENCIMIENTO
  COMISION
  IMPUESTO
  SPLIT
  CANJE
  TRANSFERENCIA_ENTRADA
  TRANSFERENCIA_SALIDA
  AJUSTE
}

enum OrigenOperacion {
  MANUAL
  IMPORTACION
  SISTEMA
}

enum DimensionAsignacion {
  TIPO
  INSTRUMENTO
  SECTOR
  MONEDA
  PAIS
  ETIQUETA
}

enum TipoAlerta {
  PRECIO_MAYOR_A
  PRECIO_MENOR_A
  VARIACION_DIARIA
  VENCIMIENTO
  COBRO_PROXIMO
  NOTICIA
}

enum CanalNotificacion {
  APP
  EMAIL
  TELEGRAM
}

enum Impacto {
  POSITIVO
  NEGATIVO
  NEUTRAL
}

enum EstadoImportacion {
  VISTA_PREVIA
  CONFIRMADA
  ERROR
  REVERTIDA
}

enum TipoIndice {
  IPC
  CER
  UVA
  BADLAR
  TAMAR
}

enum AccionAuditoria {
  CREAR
  EDITAR
  BORRAR
  RESTAURAR
}

// ───────────── Usuarios y acceso ─────────────

model Usuario {
  id              String      @id @default(cuid())
  nombre          String
  email           String      @unique
  hashPassword    String
  rol             Rol         @default(USUARIO)
  monedaBase      Moneda      @default(USD_MEP)
  dolarReferencia TipoDolar   @default(MEP)
  metodoCosto     MetodoCosto @default(PRECIO_PROMEDIO)
  preferencias    Json?
  creadoEn        DateTime    @default(now())
  actualizadoEn   DateTime    @updatedAt
  eliminadoEn     DateTime?

  sesiones             Sesion[]
  carteras             Cartera[]
  cuentas              Cuenta[]
  instrumentos         InstrumentoUsuario[]
  etiquetas            Etiqueta[]
  instrumentoEtiquetas InstrumentoEtiqueta[]
  alertas              Alerta[]
  notificaciones       Notificacion[]
  informesNoticias     InformeNoticias[]
  importaciones        Importacion[]
  auditorias           RegistroAuditoria[]
  flujosCargados       FlujoProgramado[]
}

model Sesion {
  id               String    @id @default(cuid())
  usuarioId        String
  tokenHash        String    @unique
  expiraEn         DateTime
  userAgent        String?
  ip               String?
  revocadaEn       DateTime?
  reemplazadaPorId String?   @unique
  creadoEn         DateTime  @default(now())
  actualizadoEn    DateTime  @updatedAt

  usuario        Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  reemplazadaPor Sesion? @relation("RotacionSesion", fields: [reemplazadaPorId], references: [id])
  reemplazaA     Sesion? @relation("RotacionSesion")

  @@index([usuarioId])
}

// ───────────── Estructura de la cartera ─────────────

model Cartera {
  id            String    @id @default(cuid())
  usuarioId     String
  nombre        String
  descripcion   String?
  esPrincipal   Boolean   @default(false)
  archivada     Boolean   @default(false)
  orden         Int       @default(0)
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt
  eliminadoEn   DateTime?

  usuario          Usuario              @relation(fields: [usuarioId], references: [id])
  operaciones      Operacion[]
  snapshots        SnapshotCartera[]
  objetivos        ObjetivoAsignacion[]
  informesNoticias InformeNoticias[]
  importaciones    Importacion[]

  @@index([usuarioId])
}

model Cuenta {
  id              String    @id @default(cuid())
  usuarioId       String
  broker          String
  numeroComitente String?
  alias           String?
  creadoEn        DateTime  @default(now())
  actualizadoEn   DateTime  @updatedAt
  eliminadoEn     DateTime?

  usuario       Usuario       @relation(fields: [usuarioId], references: [id])
  operaciones   Operacion[]
  importaciones Importacion[]

  @@index([usuarioId])
}

// ───────────── Catálogo de instrumentos ─────────────

model Instrumento {
  id               String          @id @default(cuid())
  ticker           String
  nombre           String?
  tipo             TipoInstrumento
  mercado          Mercado
  emisor           String?
  sector           String?
  industria        String?
  pais             String?
  isin             String?
  tickerSubyacente String?
  ratioCedear      String?
  simbolos         Json
  factorPrecio     Decimal         @default(1)
  valorNominal     Decimal?
  fechaEmision     DateTime?
  fechaVencimiento DateTime?
  tasaCupon        Decimal?
  frecuenciaCupon  Int?
  ley              Ley?
  tipoAjuste       TipoAjuste      @default(NINGUNO)
  activo           Boolean         @default(true)
  atributos        Json?
  creadoEn         DateTime        @default(now())
  actualizadoEn    DateTime        @updatedAt

  flujos       FlujoProgramado[]
  operaciones  Operacion[]
  cotizaciones Cotizacion[]
  usuarios     InstrumentoUsuario[]
  etiquetas    InstrumentoEtiqueta[]
  alertas      Alerta[]
  noticias     NoticiaInstrumento[]

  @@unique([ticker, mercado])
}

model FlujoProgramado {
  id                  String   @id @default(cuid())
  instrumentoId       String
  fecha               DateTime
  renta               Decimal  @default(0)
  amortizacion        Decimal  @default(0)
  moneda              Moneda
  cargadoPorUsuarioId String?
  creadoEn            DateTime @default(now())
  actualizadoEn       DateTime @updatedAt

  instrumento Instrumento @relation(fields: [instrumentoId], references: [id])
  cargadoPor  Usuario?    @relation(fields: [cargadoPorUsuarioId], references: [id])

  @@unique([instrumentoId, fecha])
}

// ───────────── Movimientos ─────────────

model Operacion {
  id                     String          @id @default(cuid())
  carteraId              String
  cuentaId               String?
  instrumentoId          String?
  tipo                   TipoOperacion
  fechaConcertacion      DateTime
  fechaLiquidacion       DateTime?
  cantidad               Decimal?
  precio                 Decimal?
  moneda                 Moneda
  tipoCambio             Decimal?
  comision               Decimal         @default(0)
  derechosMercado        Decimal         @default(0)
  iva                    Decimal         @default(0)
  otrosGastos            Decimal         @default(0)
  montoNeto              Decimal?
  ratio                  Decimal?
  operacionRelacionadaId String?
  origen                 OrigenOperacion @default(MANUAL)
  importacionId          String?
  notas                  String?
  creadoEn               DateTime        @default(now())
  actualizadoEn          DateTime        @updatedAt
  eliminadoEn            DateTime?

  cartera              Cartera      @relation(fields: [carteraId], references: [id])
  cuenta               Cuenta?      @relation(fields: [cuentaId], references: [id])
  instrumento          Instrumento? @relation(fields: [instrumentoId], references: [id])
  importacion          Importacion? @relation(fields: [importacionId], references: [id])
  operacionRelacionada Operacion?   @relation("OperacionesRelacionadas", fields: [operacionRelacionadaId], references: [id])
  relacionadas         Operacion[]  @relation("OperacionesRelacionadas")

  @@index([carteraId, fechaConcertacion])
  @@index([instrumentoId])
  @@index([importacionId])
}

// ───────────── Datos de mercado e historia ─────────────

model Cotizacion {
  id            String   @id @default(cuid())
  instrumentoId String
  fecha         DateTime
  moneda        Moneda
  apertura      Decimal?
  maximo        Decimal?
  minimo        Decimal?
  cierre        Decimal
  volumen       Decimal?
  fuente        String
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  instrumento Instrumento @relation(fields: [instrumentoId], references: [id])

  @@unique([instrumentoId, fecha, moneda])
}

model TipoCambio {
  id            String    @id @default(cuid())
  fecha         DateTime
  tipo          TipoDolar
  compra        Decimal?
  venta         Decimal
  fuente        String
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt

  @@unique([fecha, tipo])
}

model IndiceEconomico {
  id            String     @id @default(cuid())
  tipo          TipoIndice
  fecha         DateTime
  valor         Decimal
  fuente        String
  creadoEn      DateTime   @default(now())
  actualizadoEn DateTime   @updatedAt

  @@unique([tipo, fecha])
}

model SnapshotCartera {
  id                      String   @id @default(cuid())
  carteraId               String
  fecha                   DateTime
  valorArs                Decimal
  valorUsd                Decimal
  invertidoArs            Decimal
  invertidoUsd            Decimal
  efectivoArs             Decimal
  efectivoUsd             Decimal
  resultadoRealizadoUsd   Decimal
  resultadoNoRealizadoUsd Decimal
  flujoNetoDelDiaUsd      Decimal
  creadoEn                DateTime @default(now())
  actualizadoEn           DateTime @updatedAt

  cartera Cartera @relation(fields: [carteraId], references: [id])

  @@unique([carteraId, fecha])
}

// ───────────── Herramientas del inversor ─────────────

model InstrumentoUsuario {
  id                  String    @id @default(cuid())
  usuarioId           String
  instrumentoId       String
  enSeguimiento       Boolean   @default(false)
  precioObjetivo      Decimal?
  notas               String?
  sectorPersonalizado String?
  precioManual        Decimal?
  precioManualMoneda  Moneda?
  precioManualEn      DateTime?
  creadoEn            DateTime  @default(now())
  actualizadoEn       DateTime  @updatedAt

  usuario     Usuario     @relation(fields: [usuarioId], references: [id])
  instrumento Instrumento @relation(fields: [instrumentoId], references: [id])

  @@unique([usuarioId, instrumentoId])
}

model Etiqueta {
  id            String    @id @default(cuid())
  usuarioId     String
  nombre        String
  color         String
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt
  eliminadoEn   DateTime?

  usuario      Usuario               @relation(fields: [usuarioId], references: [id])
  instrumentos InstrumentoEtiqueta[]

  @@index([usuarioId])
}

model InstrumentoEtiqueta {
  usuarioId     String
  instrumentoId String
  etiquetaId    String
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  usuario     Usuario     @relation(fields: [usuarioId], references: [id])
  instrumento Instrumento @relation(fields: [instrumentoId], references: [id])
  etiqueta    Etiqueta    @relation(fields: [etiquetaId], references: [id])

  @@id([usuarioId, instrumentoId, etiquetaId])
}

model ObjetivoAsignacion {
  id                 String              @id @default(cuid())
  carteraId          String
  dimension          DimensionAsignacion
  clave              String
  porcentajeObjetivo Decimal
  creadoEn           DateTime            @default(now())
  actualizadoEn      DateTime            @updatedAt

  cartera Cartera @relation(fields: [carteraId], references: [id])

  @@unique([carteraId, dimension, clave])
}

model Alerta {
  id                String            @id @default(cuid())
  usuarioId         String
  instrumentoId     String?
  tipo              TipoAlerta
  umbral            Decimal?
  canal             CanalNotificacion @default(APP)
  activa            Boolean           @default(true)
  ultimaDisparadaEn DateTime?
  creadoEn          DateTime          @default(now())
  actualizadoEn     DateTime          @updatedAt
  eliminadoEn       DateTime?

  usuario        Usuario        @relation(fields: [usuarioId], references: [id])
  instrumento    Instrumento?   @relation(fields: [instrumentoId], references: [id])
  notificaciones Notificacion[]

  @@index([usuarioId])
}

model Notificacion {
  id            String    @id @default(cuid())
  usuarioId     String
  alertaId      String?
  titulo        String
  cuerpo        String
  leidaEn       DateTime?
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt

  usuario Usuario @relation(fields: [usuarioId], references: [id])
  alerta  Alerta? @relation(fields: [alertaId], references: [id])

  @@index([usuarioId, leidaEn])
}

// ───────────── Noticias, importación y auditoría ─────────────

model Noticia {
  id                 String   @id @default(cuid())
  url                String   @unique
  titulo             String
  fuente             String
  publicadaEn        DateTime
  resumenIa          String?
  impacto            Impacto?
  explicacionImpacto String?
  creadoEn           DateTime @default(now())
  actualizadoEn      DateTime @updatedAt

  instrumentos NoticiaInstrumento[]
}

model NoticiaInstrumento {
  noticiaId     String
  instrumentoId String
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  noticia     Noticia     @relation(fields: [noticiaId], references: [id])
  instrumento Instrumento @relation(fields: [instrumentoId], references: [id])

  @@id([noticiaId, instrumentoId])
}

model InformeNoticias {
  id             String   @id @default(cuid())
  usuarioId      String
  carteraId      String
  generadoEn     DateTime @default(now())
  resumenGeneral String?
  noticiaIds     Json
  iaDisponible   Boolean
  creadoEn       DateTime @default(now())
  actualizadoEn  DateTime @updatedAt

  usuario Usuario @relation(fields: [usuarioId], references: [id])
  cartera Cartera @relation(fields: [carteraId], references: [id])

  @@index([usuarioId, carteraId])
}

model Importacion {
  id              String            @id @default(cuid())
  usuarioId       String
  carteraId       String
  cuentaId        String?
  formato         String
  nombreArchivo   String
  estado          EstadoImportacion @default(VISTA_PREVIA)
  filasLeidas     Int               @default(0)
  filasImportadas Int               @default(0)
  filas           Json?
  errores         Json?
  confirmadaEn    DateTime?
  revertidaEn     DateTime?
  creadoEn        DateTime          @default(now())
  actualizadoEn   DateTime          @updatedAt

  usuario     Usuario     @relation(fields: [usuarioId], references: [id])
  cartera     Cartera     @relation(fields: [carteraId], references: [id])
  cuenta      Cuenta?     @relation(fields: [cuentaId], references: [id])
  operaciones Operacion[]

  @@index([usuarioId])
}

model RegistroAuditoria {
  id        String          @id @default(cuid())
  usuarioId String
  entidad   String
  entidadId String
  accion    AccionAuditoria
  antes     Json?
  despues   Json?
  fecha     DateTime        @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id])

  @@index([entidad, entidadId])
  @@index([usuarioId])
}
```

- [ ] **Step 4: Agregar los scripts de base de datos**

En `backend/package.json`, dentro de `"scripts"`, agregar estas entradas (dejar las existentes):
```json
    "db:generar": "prisma generate",
    "db:migrate": "prisma migrate dev && prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "postinstall": "prisma generate"
```

- [ ] **Step 5: Crear la migración inicial y generar el cliente**

```bash
cp backend/.env.example backend/.env
cd backend && npx prisma migrate dev --name inicial && npx prisma generate && cd ..
```
Expected: se crea `backend/prisma/migrations/<fecha>_inicial/migration.sql`, "Your database is now in sync with your schema" y "Generated Prisma Client (7.10.0) to ./src/generado/prisma".

- [ ] **Step 6: Crear el cliente de base de datos**

`backend/src/compartido/base-datos/cliente.ts`:
```ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type Prisma } from "../../generado/prisma/client";

/** Cliente normal o cliente dentro de una transacción: los repositorios aceptan ambos. */
export type ClienteBD = PrismaClient | Prisma.TransactionClient;

export function crearClienteBD(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
```

- [ ] **Step 7: Crear la infraestructura de bases de prueba**

`backend/test/preparar-plantilla.ts`:
```ts
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTORIO_TEST = path.dirname(fileURLToPath(import.meta.url));
const DIRECTORIO_BACKEND = path.resolve(DIRECTORIO_TEST, "..");

/** Base migrada una sola vez; cada test la copia para trabajar aislado. */
export const RUTA_PLANTILLA = path.join(DIRECTORIO_TEST, ".plantilla.db");

export default function prepararPlantilla(): void {
  rmSync(RUTA_PLANTILLA, { force: true });
  execSync("npx prisma migrate deploy", {
    cwd: DIRECTORIO_BACKEND,
    env: { ...process.env, DATABASE_URL: `file:${RUTA_PLANTILLA}` },
    stdio: "pipe",
  });
}
```

`backend/test/utilidades/base-datos-prueba.ts`:
```ts
import { randomUUID } from "node:crypto";
import { copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "../../src/generado/prisma/client";
import { crearClienteBD } from "../../src/compartido/base-datos/cliente";
import { RUTA_PLANTILLA } from "../preparar-plantilla";

export interface BasePrueba {
  bd: PrismaClient;
  cerrar: () => Promise<void>;
}

export async function crearBasePrueba(): Promise<BasePrueba> {
  const ruta = path.join(tmpdir(), `cartera-prueba-${randomUUID()}.db`);
  copyFileSync(RUTA_PLANTILLA, ruta);
  const bd = crearClienteBD(`file:${ruta}`);
  return {
    bd,
    cerrar: async () => {
      await bd.$disconnect();
      rmSync(ruta, { force: true });
    },
  };
}
```

Reemplazar `backend/vitest.config.ts` por:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/preparar-plantilla.ts"],
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 8: Escribir los tests que fallan**

`backend/test/compartido/base-datos.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "../../src/generado/prisma/client";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";

const TABLAS_DEL_MODELO = [
  "Alerta", "Cartera", "Cotizacion", "Cuenta", "Etiqueta", "FlujoProgramado", "Importacion",
  "IndiceEconomico", "InformeNoticias", "Instrumento", "InstrumentoEtiqueta",
  "InstrumentoUsuario", "Noticia", "NoticiaInstrumento", "Notificacion", "ObjetivoAsignacion",
  "Operacion", "RegistroAuditoria", "Sesion", "SnapshotCartera", "TipoCambio", "Usuario",
];

describe("base de datos", () => {
  let base: BasePrueba;
  beforeEach(async () => {
    base = await crearBasePrueba();
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("tiene exactamente las tablas del modelo", async () => {
    const filas = await base.bd.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type = 'table'`;
    const tablas = filas
      .map((fila) => fila.name)
      .filter((nombre) => !nombre.startsWith("_prisma") && !nombre.startsWith("sqlite_"))
      .sort();
    expect(tablas).toEqual([...TABLAS_DEL_MODELO].sort());
  });

  it("guarda Decimal sin errores de redondeo", async () => {
    const instrumento = await base.bd.instrumento.create({
      data: {
        ticker: "AL30",
        tipo: "BONO",
        mercado: "BYMA",
        simbolos: { ARS: "AL30", USD_MEP: "AL30D" },
        factorPrecio: new Prisma.Decimal("0.1").plus("0.2"),
      },
    });
    const leido = await base.bd.instrumento.findUniqueOrThrow({ where: { id: instrumento.id } });
    expect(leido.factorPrecio.toString()).toBe("0.3");
    expect(leido.simbolos).toEqual({ ARS: "AL30", USD_MEP: "AL30D" });
  });

  it("cada base de prueba está aislada de las demás", async () => {
    await base.bd.usuario.create({
      data: { nombre: "A", email: "a@prueba.com", hashPassword: "x" },
    });
    const otra = await crearBasePrueba();
    expect(await otra.bd.usuario.count()).toBe(0);
    await otra.cerrar();
  });
});
```


`backend/test/compartido/manejador-errores-prisma.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { crearManejadorErrores } from "../../src/compartido/http/manejador-errores";
import { crearBasePrueba, type BasePrueba } from "../utilidades/base-datos-prueba";

describe("manejador de errores con Prisma", () => {
  let base: BasePrueba;
  beforeEach(async () => {
    base = await crearBasePrueba();
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it("convierte una violación de unicidad en 409 explicado", async () => {
    const app = express();
    app.post("/duplicar", async (_req, res) => {
      const datos = { nombre: "A", email: "repetido@prueba.com", hashPassword: "x" };
      await base.bd.usuario.create({ data: datos });
      await base.bd.usuario.create({ data: datos });
      res.json({});
    });
    app.use(crearManejadorErrores(() => {}));
    const respuesta = await request(app).post("/duplicar");
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toEqual({
      codigo: "CONFLICTO",
      mensaje: "Ya existe un registro con esos datos.",
    });
  });
});
```

- [ ] **Step 9: Correrlos y ver cuál falla**

Run: `npm test -w @cartera/backend -- test/compartido`
Expected: `base-datos.test.ts` PASS (la infraestructura ya existe); `manejador-errores-prisma.test.ts` FAIL con status 500 en lugar de 409.

- [ ] **Step 10: Mapear la violación de unicidad en el middleware**

En `backend/src/compartido/http/manejador-errores.ts`:

Agregar el import, debajo de `import { ErrorApp } from "../errores";`:
```ts
import { Prisma } from "../../generado/prisma/client";

const CODIGO_PRISMA_UNICIDAD = "P2002";
```

Y dentro de la función devuelta, inmediatamente después del bloque `if (error instanceof ErrorApp) { ... }`, agregar:
```ts
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === CODIGO_PRISMA_UNICIDAD
    ) {
      res.status(409).json(cuerpo("CONFLICTO", "Ya existe un registro con esos datos."));
      return;
    }
```

- [ ] **Step 11: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 12: Mostrar el estado**

Run: `git status --short`
Expected: aparecen `backend/prisma/`, `backend/prisma.config.ts`, etc. **No** aparecen `backend/.env`, `backend/cartera.db` ni `backend/src/generado/` (están en `.gitignore`).

---

### Task 5: Paginación y repositorios base

**Files:**
- Create: `backend/src/compartido/paginacion.ts`, `backend/src/compartido/repositorios/delegado-prisma.ts`, `backend/src/compartido/repositorios/repositorio-base.ts`, `backend/src/compartido/repositorios/repositorio-del-usuario.ts`
- Create: `backend/test/utilidades/fabricas.ts`, `backend/test/utilidades/cuentas-prueba.ts`
- Test: `backend/test/compartido/repositorios.test.ts`

**Interfaces:**
- Consumes: `ClienteBD` (Tarea 4); `ErrorNoEncontrado`, `ErrorValidacion` (Tarea 3); `Pagina<T>` de contratos.
- Produces:
  - `esquemaConsultaListado` (zod) · `type ConsultaListado = { pagina: number; porPagina: number; orden?: string; direccion: "asc" | "desc" }` · `interface OpcionesListado extends ConsultaListado { filtros?: Record<string, unknown> }` · `construirPagina<T>(items, total, opciones): Pagina<T>` · `mapearPagina<T, U>(pagina, mapear): Pagina<U>`
  - `type Donde = Record<string, unknown>` · `interface DelegadoPrisma<TModelo, TCrear, TEditar>`
  - `abstract class RepositorioBase<TModelo extends { id: string }, TCrear, TEditar>` con métodos protegidos `buscarEn`, `obtenerEn`, `listarEn`, `crearEn`, `editarEn`, `borrarEn`
  - `abstract class RepositorioDelUsuario<TModelo, TNuevo, TCrear, TEditar>` con métodos públicos:
    `buscar(usuarioId, id, bd?)`, `obtener(usuarioId, id, bd?)`, `listar(usuarioId, opciones, bd?)`, `crear(usuarioId, datos: TNuevo, bd?)`, `editar(usuarioId, id, datos: TEditar, bd?)`, `borrar(usuarioId, id, bd?)`; hooks `alcance(usuarioId): Donde` y `conDueno(usuarioId, datos: TNuevo): TCrear`
  - (tests) `crearUsuarioPrueba(bd, datos?)`, `CuentasPruebaRepositorio`, `type NuevaCuentaPrueba`, `type EdicionCuentaPrueba`

- [ ] **Step 1: Crear las utilidades de test**

`backend/test/utilidades/fabricas.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, Usuario } from "../../src/generado/prisma/client";

export function crearUsuarioPrueba(
  bd: PrismaClient,
  datos: Partial<Prisma.UsuarioCreateInput> = {},
): Promise<Usuario> {
  return bd.usuario.create({
    data: {
      nombre: "Usuario de prueba",
      email: `fabrica-${randomUUID()}@prueba.com`,
      hashPassword: "hash-que-no-se-usa",
      ...datos,
    },
  });
}
```

`backend/test/utilidades/cuentas-prueba.ts`:
```ts
import type { Cuenta, Prisma } from "../../src/generado/prisma/client";
import type { ClienteBD } from "../../src/compartido/base-datos/cliente";
import { RepositorioDelUsuario } from "../../src/compartido/repositorios/repositorio-del-usuario";

export type NuevaCuentaPrueba = Omit<Prisma.CuentaUncheckedCreateInput, "usuarioId">;
export type EdicionCuentaPrueba = Pick<Prisma.CuentaUncheckedUpdateInput, "broker" | "alias">;

/** Repositorio concreto mínimo para probar las clases base. */
export class CuentasPruebaRepositorio extends RepositorioDelUsuario<
  Cuenta,
  NuevaCuentaPrueba,
  Prisma.CuentaUncheckedCreateInput,
  EdicionCuentaPrueba
> {
  protected readonly entidad = "la cuenta";
  protected readonly camposOrdenables = ["broker", "creadoEn"] as const;
  protected readonly ordenPorDefecto = "broker";

  protected delegado(bd: ClienteBD) {
    return bd.cuenta;
  }

  protected conDueno(usuarioId: string, datos: NuevaCuentaPrueba) {
    return { ...datos, usuarioId };
  }
}
```

- [ ] **Step 2: Escribir el test que falla**

`backend/test/compartido/repositorios.test.ts`:
```ts
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
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/compartido/repositorios`
Expected: FAIL — no se puede resolver `repositorio-del-usuario`.

- [ ] **Step 4: Implementar la paginación**

`backend/src/compartido/paginacion.ts`:
```ts
import { z } from "zod";
import type { Pagina } from "@cartera/contratos";

export const POR_PAGINA_POR_DEFECTO = 20;
export const POR_PAGINA_MAXIMO = 100;

export const esquemaConsultaListado = z.object({
  pagina: z.coerce.number().int().min(1, "La página empieza en 1.").default(1),
  porPagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(POR_PAGINA_MAXIMO, `Se pueden pedir hasta ${POR_PAGINA_MAXIMO} por página.`)
    .default(POR_PAGINA_POR_DEFECTO),
  orden: z.string().optional(),
  direccion: z.enum(["asc", "desc"]).default("asc"),
});

export type ConsultaListado = z.output<typeof esquemaConsultaListado>;

export interface OpcionesListado extends ConsultaListado {
  filtros?: Record<string, unknown>;
}

export function construirPagina<T>(
  items: T[],
  total: number,
  opciones: Pick<OpcionesListado, "pagina" | "porPagina">,
): Pagina<T> {
  return {
    items,
    total,
    pagina: opciones.pagina,
    porPagina: opciones.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / opciones.porPagina)),
  };
}

export function mapearPagina<T, U>(pagina: Pagina<T>, mapear: (item: T) => U): Pagina<U> {
  return { ...pagina, items: pagina.items.map(mapear) };
}
```

- [ ] **Step 5: Implementar el delegado y el repositorio base**

`backend/src/compartido/repositorios/delegado-prisma.ts`:
```ts
export type Donde = Record<string, unknown>;

/**
 * La parte de un delegate de Prisma (bd.cartera, bd.cuenta, …) que usan los repositorios base.
 * Los delegates reales la cumplen estructuralmente; el compilador verifica los tipos de datos.
 */
export interface DelegadoPrisma<TModelo, TCrear, TEditar> {
  findFirst(args: { where: Donde }): PromiseLike<TModelo | null>;
  findMany(args: {
    where: Donde;
    orderBy: Record<string, "asc" | "desc">;
    skip: number;
    take: number;
  }): PromiseLike<TModelo[]>;
  count(args: { where: Donde }): PromiseLike<number>;
  create(args: { data: TCrear }): PromiseLike<TModelo>;
  update(args: { where: { id: string }; data: TEditar | { eliminadoEn: Date } }): PromiseLike<TModelo>;
}
```

`backend/src/compartido/repositorios/repositorio-base.ts`:
```ts
import type { Pagina } from "@cartera/contratos";
import type { ClienteBD } from "../base-datos/cliente";
import { ErrorNoEncontrado, ErrorValidacion } from "../errores";
import { construirPagina, type OpcionesListado } from "../paginacion";
import type { DelegadoPrisma, Donde } from "./delegado-prisma";

/**
 * Base de los repositorios de entidades con borrado lógico (columna `eliminadoEn`).
 * Centraliza búsqueda, paginación, orden validado, alta, edición y borrado lógico.
 * Cada operación recibe un `alcance` (condición extra) que las subclases fijan.
 */
export abstract class RepositorioBase<TModelo extends { id: string }, TCrear, TEditar> {
  /** Nombre con artículo para los mensajes: "la cartera". */
  protected abstract readonly entidad: string;
  protected abstract readonly camposOrdenables: readonly string[];
  protected abstract readonly ordenPorDefecto: string;

  constructor(protected readonly bd: ClienteBD) {}

  protected abstract delegado(bd: ClienteBD): DelegadoPrisma<TModelo, TCrear, TEditar>;

  protected buscarEn(alcance: Donde, id: string, bd: ClienteBD = this.bd): Promise<TModelo | null> {
    return Promise.resolve(
      this.delegado(bd).findFirst({ where: { ...alcance, id, eliminadoEn: null } }),
    );
  }

  protected async obtenerEn(alcance: Donde, id: string, bd: ClienteBD = this.bd): Promise<TModelo> {
    const encontrado = await this.buscarEn(alcance, id, bd);
    if (!encontrado) throw new ErrorNoEncontrado(this.entidad);
    return encontrado;
  }

  protected async listarEn(
    alcance: Donde,
    opciones: OpcionesListado,
    bd: ClienteBD = this.bd,
  ): Promise<Pagina<TModelo>> {
    const orden = opciones.orden ?? this.ordenPorDefecto;
    if (!this.camposOrdenables.includes(orden)) {
      throw new ErrorValidacion("No se puede ordenar por ese campo.", [
        { campo: "orden", mensaje: `Valores posibles: ${this.camposOrdenables.join(", ")}.` },
      ]);
    }
    // El alcance va después de los filtros para que un filtro nunca lo pise.
    const where: Donde = { ...opciones.filtros, ...alcance, eliminadoEn: null };
    const delegado = this.delegado(bd);
    const [items, total] = await Promise.all([
      delegado.findMany({
        where,
        orderBy: { [orden]: opciones.direccion },
        skip: (opciones.pagina - 1) * opciones.porPagina,
        take: opciones.porPagina,
      }),
      delegado.count({ where }),
    ]);
    return construirPagina(items, total, opciones);
  }

  protected crearEn(datos: TCrear, bd: ClienteBD = this.bd): Promise<TModelo> {
    return Promise.resolve(this.delegado(bd).create({ data: datos }));
  }

  protected async editarEn(
    alcance: Donde,
    id: string,
    datos: TEditar,
    bd: ClienteBD = this.bd,
  ): Promise<TModelo> {
    await this.obtenerEn(alcance, id, bd);
    return this.delegado(bd).update({ where: { id }, data: datos });
  }

  protected async borrarEn(alcance: Donde, id: string, bd: ClienteBD = this.bd): Promise<TModelo> {
    await this.obtenerEn(alcance, id, bd);
    return this.delegado(bd).update({ where: { id }, data: { eliminadoEn: new Date() } });
  }
}
```

- [ ] **Step 6: Implementar el repositorio con alcance por usuario**

`backend/src/compartido/repositorios/repositorio-del-usuario.ts`:
```ts
import type { Pagina } from "@cartera/contratos";
import type { ClienteBD } from "../base-datos/cliente";
import type { OpcionesListado } from "../paginacion";
import type { Donde } from "./delegado-prisma";
import { RepositorioBase } from "./repositorio-base";

/**
 * Repositorio de datos que pertenecen a un usuario. Todas sus operaciones públicas exigen
 * el `usuarioId` y filtran por él: no hay forma de leer o tocar datos ajenos por olvido.
 */
export abstract class RepositorioDelUsuario<
  TModelo extends { id: string },
  TNuevo,
  TCrear,
  TEditar,
> extends RepositorioBase<TModelo, TCrear, TEditar> {
  /** Condición que limita a los registros del usuario. Por defecto, la columna `usuarioId`. */
  protected alcance(usuarioId: string): Donde {
    return { usuarioId };
  }

  /** Completa los datos de un registro nuevo con su dueño. */
  protected abstract conDueno(usuarioId: string, datos: TNuevo): TCrear;

  buscar(usuarioId: string, id: string, bd?: ClienteBD): Promise<TModelo | null> {
    return this.buscarEn(this.alcance(usuarioId), id, bd);
  }

  obtener(usuarioId: string, id: string, bd?: ClienteBD): Promise<TModelo> {
    return this.obtenerEn(this.alcance(usuarioId), id, bd);
  }

  listar(usuarioId: string, opciones: OpcionesListado, bd?: ClienteBD): Promise<Pagina<TModelo>> {
    return this.listarEn(this.alcance(usuarioId), opciones, bd);
  }

  crear(usuarioId: string, datos: TNuevo, bd?: ClienteBD): Promise<TModelo> {
    return this.crearEn(this.conDueno(usuarioId, datos), bd);
  }

  editar(usuarioId: string, id: string, datos: TEditar, bd?: ClienteBD): Promise<TModelo> {
    return this.editarEn(this.alcance(usuarioId), id, datos, bd);
  }

  borrar(usuarioId: string, id: string, bd?: ClienteBD): Promise<TModelo> {
    return this.borrarEn(this.alcance(usuarioId), id, bd);
  }
}
```

- [ ] **Step 7: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS. Si `tsc` marca incompatibilidad entre `bd.cuenta` y `DelegadoPrisma`, revisar que `EdicionCuentaPrueba` sea un `Pick` de `CuentaUncheckedUpdateInput` (no un tipo propio).

- [ ] **Step 8: Mostrar el estado**

Run: `git status --short`

---

### Task 6: Auditoría y servicio auditado

**Files:**
- Create: `backend/src/compartido/json.ts`, `backend/src/compartido/auditoria/auditoria.repositorio.ts`, `backend/src/compartido/auditoria/servicio-auditado.ts`
- Test: `backend/test/compartido/servicio-auditado.test.ts`

**Interfaces:**
- Consumes: `RepositorioDelUsuario` (Tarea 5), `ClienteBD` (Tarea 4), test utils `CuentasPruebaRepositorio`, `crearUsuarioPrueba`.
- Produces:
  - `aJson(valor: unknown): Prisma.InputJsonValue`
  - `interface EntradaAuditoria { usuarioId: string; entidad: string; entidadId: string; accion: AccionAuditoria; antes: unknown; despues: unknown }`
  - `class AuditoriaRepositorio { registrar(entrada, bd?): Promise<void>; listarDeEntidad(entidad, entidadId, bd?): Promise<RegistroAuditoria[]> }`
  - `type PasoPrevio = (tx: ClienteBD) => Promise<void>`
  - `abstract class ServicioAuditado<TModelo, TNuevo, TCrear, TEditar>` con `protected abstract readonly entidadAuditada: string` y métodos protegidos `crearAuditado(usuarioId, datos, pasoPrevio?)`, `editarAuditado(usuarioId, id, datos, pasoPrevio?)`, `borrarAuditado(usuarioId, id, pasoPrevio?)`

- [ ] **Step 1: Escribir el test que falla**

`backend/test/compartido/servicio-auditado.test.ts`:
```ts
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
    servicio = new CuentasPruebaServicio(
      base.bd,
      new CuentasPruebaRepositorio(base.bd),
      auditoria,
    );
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
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/compartido/servicio-auditado`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar `aJson` y el repositorio de auditoría**

`backend/src/compartido/json.ts`:
```ts
import type { Prisma } from "../generado/prisma/client";

/** Convierte un valor (con fechas y Decimal) a JSON plano para guardarlo en una columna Json. */
export function aJson(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}
```

`backend/src/compartido/auditoria/auditoria.repositorio.ts`:
```ts
import { Prisma, type RegistroAuditoria } from "../../generado/prisma/client";
import type { AccionAuditoria } from "../../generado/prisma/enums";
import type { ClienteBD } from "../base-datos/cliente";
import { aJson } from "../json";

export interface EntradaAuditoria {
  usuarioId: string;
  entidad: string;
  entidadId: string;
  accion: AccionAuditoria;
  antes: unknown;
  despues: unknown;
}

function columnaJson(valor: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return valor === null || valor === undefined ? Prisma.JsonNull : aJson(valor);
}

/** Tabla técnica de solo agregar: no usa RepositorioBase porque no tiene borrado lógico. */
export class AuditoriaRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  async registrar(entrada: EntradaAuditoria, bd: ClienteBD = this.bd): Promise<void> {
    await bd.registroAuditoria.create({
      data: {
        usuarioId: entrada.usuarioId,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        accion: entrada.accion,
        antes: columnaJson(entrada.antes),
        despues: columnaJson(entrada.despues),
      },
    });
  }

  listarDeEntidad(
    entidad: string,
    entidadId: string,
    bd: ClienteBD = this.bd,
  ): Promise<RegistroAuditoria[]> {
    return bd.registroAuditoria.findMany({
      where: { entidad, entidadId },
      orderBy: { fecha: "asc" },
    });
  }
}
```

- [ ] **Step 4: Implementar el servicio auditado**

`backend/src/compartido/auditoria/servicio-auditado.ts`:
```ts
import type { PrismaClient } from "../../generado/prisma/client";
import type { ClienteBD } from "../base-datos/cliente";
import type { RepositorioDelUsuario } from "../repositorios/repositorio-del-usuario";
import type { AuditoriaRepositorio } from "./auditoria.repositorio";

/** Trabajo extra que corre dentro de la misma transacción, antes del cambio principal. */
export type PasoPrevio = (tx: ClienteBD) => Promise<void>;

/**
 * Base de los servicios de entidades editables por el usuario. Cada alta, edición o borrado
 * se hace en una transacción junto con su registro en RegistroAuditoria.
 */
export abstract class ServicioAuditado<TModelo extends { id: string }, TNuevo, TCrear, TEditar> {
  /** Nombre de la entidad en la auditoría: "Cartera", "Cuenta", … */
  protected abstract readonly entidadAuditada: string;

  constructor(
    protected readonly bd: PrismaClient,
    protected readonly repositorio: RepositorioDelUsuario<TModelo, TNuevo, TCrear, TEditar>,
    protected readonly auditoria: AuditoriaRepositorio,
  ) {}

  protected crearAuditado(usuarioId: string, datos: TNuevo, pasoPrevio?: PasoPrevio): Promise<TModelo> {
    return this.bd.$transaction(async (tx) => {
      await pasoPrevio?.(tx);
      const creado = await this.repositorio.crear(usuarioId, datos, tx);
      await this.auditoria.registrar(
        { usuarioId, entidad: this.entidadAuditada, entidadId: creado.id, accion: "CREAR", antes: null, despues: creado },
        tx,
      );
      return creado;
    });
  }

  protected editarAuditado(
    usuarioId: string,
    id: string,
    datos: TEditar,
    pasoPrevio?: PasoPrevio,
  ): Promise<TModelo> {
    return this.bd.$transaction(async (tx) => {
      const antes = await this.repositorio.obtener(usuarioId, id, tx);
      await pasoPrevio?.(tx);
      const despues = await this.repositorio.editar(usuarioId, id, datos, tx);
      await this.auditoria.registrar(
        { usuarioId, entidad: this.entidadAuditada, entidadId: id, accion: "EDITAR", antes, despues },
        tx,
      );
      return despues;
    });
  }

  protected borrarAuditado(usuarioId: string, id: string, pasoPrevio?: PasoPrevio): Promise<void> {
    return this.bd.$transaction(async (tx) => {
      const antes = await this.repositorio.obtener(usuarioId, id, tx);
      await pasoPrevio?.(tx);
      await this.repositorio.borrar(usuarioId, id, tx);
      await this.auditoria.registrar(
        { usuarioId, entidad: this.entidadAuditada, entidadId: id, accion: "BORRAR", antes, despues: null },
        tx,
      );
    });
  }
}
```

- [ ] **Step 5: Correr tests, tipos, lint y formato**

Run: `npm test && npm run tipos && npm run lint && npm run formato`
Expected: todo PASS; Prettier reacomoda líneas largas.

- [ ] **Step 6: Mostrar el estado**

Run: `git status --short`

---

### Task 7: Contraseñas y tokens

**Files:**
- Create: `backend/src/modulos/autenticacion/contrasenas.ts`, `backend/src/modulos/autenticacion/tokens.ts`
- Test: `backend/test/modulos/autenticacion/contrasenas.test.ts`, `backend/test/modulos/autenticacion/tokens.test.ts`

**Interfaces:**
- Consumes: `ErrorNoAutorizado` (Tarea 3); `RolUsuario` de contratos.
- Produces:
  - `LARGO_MINIMO_PASSWORD = 10`, `LARGO_MAXIMO_PASSWORD = 200`
  - `class ServicioContrasenas { hashear(plano): Promise<string>; verificar(hash, plano): Promise<boolean> }`
  - `interface CargaAcceso { usuarioId: string; rol: RolUsuario }` · `interface TokenEmitido { token: string; expiraEn: Date }` · `interface RefreshEmitido extends TokenEmitido { hash: string }`
  - `class ServicioTokens(secreto: string, minutosAcceso: number, diasRefresh: number, ahora?: () => Date)` con `firmarAcceso(carga): Promise<TokenEmitido>`, `verificarAcceso(token): Promise<CargaAcceso>`, `generarRefresh(): RefreshEmitido`, `hashearRefresh(token): string`

- [ ] **Step 1: Instalar argon2 y jose**

Run: `npm install -w @cartera/backend argon2 jose`

- [ ] **Step 2: Escribir los tests que fallan**

`backend/test/modulos/autenticacion/contrasenas.test.ts`:
```ts
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
```

`backend/test/modulos/autenticacion/tokens.test.ts`:
```ts
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
    const mas16Minutos = new ServicioTokens(SECRETO, 15, 30, () => new Date(INICIO.getTime() + 16 * 60_000));
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
```

- [ ] **Step 3: Correrlos y ver que fallan**

Run: `npm test -w @cartera/backend -- test/modulos/autenticacion`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Implementar**

`backend/src/modulos/autenticacion/contrasenas.ts`:
```ts
import argon2 from "argon2";

export const LARGO_MINIMO_PASSWORD = 10;
/** Tope para que nadie mande textos enormes que hagan lento el hash. */
export const LARGO_MAXIMO_PASSWORD = 200;

export class ServicioContrasenas {
  hashear(plano: string): Promise<string> {
    return argon2.hash(plano, { type: argon2.argon2id });
  }

  async verificar(hash: string, plano: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plano);
    } catch {
      return false;
    }
  }
}
```

`backend/src/modulos/autenticacion/tokens.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { RolUsuario } from "@cartera/contratos";
import { ErrorNoAutorizado } from "../../compartido/errores";

const EMISOR = "cartera-gala";
const ALGORITMO = "HS256";
const BYTES_REFRESH = 32;
const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 86_400_000;
const MENSAJE_SESION_INVALIDA = "Tu sesión venció o no es válida. Iniciá sesión de nuevo.";

export interface CargaAcceso {
  usuarioId: string;
  rol: RolUsuario;
}

export interface TokenEmitido {
  token: string;
  expiraEn: Date;
}

export interface RefreshEmitido extends TokenEmitido {
  /** Lo único que se guarda en la base: el token en claro solo viaja en la cookie. */
  hash: string;
}

function esRol(valor: unknown): valor is RolUsuario {
  return valor === "ADMIN" || valor === "USUARIO";
}

export class ServicioTokens {
  private readonly clave: Uint8Array;

  constructor(
    secreto: string,
    private readonly minutosAcceso: number,
    private readonly diasRefresh: number,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    this.clave = new TextEncoder().encode(secreto);
  }

  async firmarAcceso(carga: CargaAcceso): Promise<TokenEmitido> {
    const momento = this.ahora();
    const expiraEn = new Date(momento.getTime() + this.minutosAcceso * MS_POR_MINUTO);
    const token = await new SignJWT({ rol: carga.rol })
      .setProtectedHeader({ alg: ALGORITMO })
      .setSubject(carga.usuarioId)
      .setIssuer(EMISOR)
      .setIssuedAt(Math.floor(momento.getTime() / 1000))
      .setExpirationTime(Math.floor(expiraEn.getTime() / 1000))
      .sign(this.clave);
    return { token, expiraEn };
  }

  async verificarAcceso(token: string): Promise<CargaAcceso> {
    try {
      const { payload } = await jwtVerify(token, this.clave, {
        issuer: EMISOR,
        algorithms: [ALGORITMO],
        currentDate: this.ahora(),
      });
      if (typeof payload.sub !== "string" || !esRol(payload["rol"])) {
        throw new ErrorNoAutorizado(MENSAJE_SESION_INVALIDA);
      }
      return { usuarioId: payload.sub, rol: payload["rol"] };
    } catch {
      throw new ErrorNoAutorizado(MENSAJE_SESION_INVALIDA);
    }
  }

  generarRefresh(): RefreshEmitido {
    const token = randomBytes(BYTES_REFRESH).toString("base64url");
    return {
      token,
      hash: this.hashearRefresh(token),
      expiraEn: new Date(this.ahora().getTime() + this.diasRefresh * MS_POR_DIA),
    };
  }

  hashearRefresh(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
```

- [ ] **Step 5: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 6: Mostrar el estado**

Run: `git status --short`

---

### Task 8: Servicio de autenticación (registro, login, refresh, logout, contraseña)

**Files:**
- Create: `contratos/src/autenticacion.ts`
- Modify: `contratos/src/index.ts`
- Create: `backend/src/modulos/autenticacion/usuarios.repositorio.ts`, `backend/src/modulos/autenticacion/sesiones.repositorio.ts`, `backend/src/modulos/autenticacion/autenticacion.servicio.ts`
- Test: `backend/test/modulos/autenticacion/autenticacion.servicio.test.ts`

**Interfaces:**
- Consumes: `ServicioContrasenas`, `ServicioTokens` (Tarea 7); errores (Tarea 3); `crearBasePrueba` (Tarea 4).
- Produces:
  - contratos: `RegistroEntrada { nombre; email; password }`, `LoginEntrada { email; password }`, `CambioPasswordEntrada { passwordActual; passwordNueva }`, `UsuarioDto { id; nombre; email; rol: RolUsuario; monedaBase: Moneda; dolarReferencia: TipoDolar; metodoCosto: MetodoCosto }`, `SesionRespuesta { tokenAcceso: string; expiraEn: string; usuario: UsuarioDto }`
  - `CARTERA_INICIAL = "Principal"`, `GRACIA_REUSO_REFRESH_MS = 10_000`
  - `interface ContextoCliente { userAgent?: string; ip?: string }`
  - `interface ResultadoSesion { respuesta: SesionRespuesta; refresh: { token: string; expiraEn: Date } }`
  - `interface NuevoUsuario { nombre: string; email: string; password: string; rol: RolUsuario }`
  - `class AutenticacionServicio(bd, usuarios, sesiones, contrasenas, tokens, opciones: { registroHabilitado: boolean }, ahora?)` con `registrar(entrada, ctx)`, `crearUsuario(nuevo): Promise<Usuario>`, `login(entrada, ctx)`, `refrescar(token | undefined, ctx)`, `logout(token | undefined)`, `yo(usuarioId): Promise<UsuarioDto>`, `cambiarPassword(usuarioId, entrada, tokenRefreshActual?)`
  - `aUsuarioDto(usuario: Usuario): UsuarioDto`

- [ ] **Step 1: Agregar los contratos de autenticación**

`contratos/src/autenticacion.ts`:
```ts
import type { MetodoCosto, Moneda, RolUsuario, TipoDolar } from "./comunes";

export interface RegistroEntrada {
  nombre: string;
  email: string;
  password: string;
}

export interface LoginEntrada {
  email: string;
  password: string;
}

export interface CambioPasswordEntrada {
  passwordActual: string;
  passwordNueva: string;
}

export interface UsuarioDto {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  monedaBase: Moneda;
  dolarReferencia: TipoDolar;
  metodoCosto: MetodoCosto;
}

export interface SesionRespuesta {
  tokenAcceso: string;
  /** ISO 8601. */
  expiraEn: string;
  usuario: UsuarioDto;
}
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./autenticacion";
```

- [ ] **Step 2: Escribir el test que falla**

`backend/test/modulos/autenticacion/autenticacion.servicio.test.ts`:
```ts
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
      expect(respuesta.usuario).toMatchObject({ nombre: "Luca", email: "luca@prueba.com", rol: "USUARIO" });
      expect(await tokens.verificarAcceso(respuesta.tokenAcceso)).toEqual({
        usuarioId: respuesta.usuario.id,
        rol: "USUARIO",
      });
      expect(refresh.token.length).toBeGreaterThan(20);
      const carteras = await base.bd.cartera.findMany({ where: { usuarioId: respuesta.usuario.id } });
      expect(carteras).toHaveLength(1);
      expect(carteras[0]).toMatchObject({ nombre: "Principal", esPrincipal: true });
    });

    it("guarda la contraseña hasheada, nunca en claro", async () => {
      const { respuesta } = await servicio.registrar(DATOS, CTX);
      const usuario = await base.bd.usuario.findUniqueOrThrow({ where: { id: respuesta.usuario.id } });
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
      await expect(servicio.login({ email: DATOS.email, password: "mala-clave-123" }, CTX)).rejects.toThrow(
        "Email o contraseña incorrectos.",
      );
      await expect(servicio.login({ email: "nadie@prueba.com", password: "x" }, CTX)).rejects.toThrow(
        "Email o contraseña incorrectos.",
      );
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
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow(ErrorNoAutorizado);
      await expect(servicio.refrescar(renovado.refresh.token, CTX)).rejects.toThrow(ErrorNoAutorizado);
    });

    it("dos pestañas que refrescan a la vez: la segunda recibe 401 pero la sesión sigue viva", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      const renovado = await servicio.refrescar(inicial.refresh.token, CTX);
      avanzar(2_000);
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow(ErrorNoAutorizado);
      const siguiente = await servicio.refrescar(renovado.refresh.token, CTX);
      expect(siguiente.respuesta.usuario.email).toBe(DATOS.email);
    });

    it("rechaza un refresh vencido", async () => {
      const inicial = await servicio.registrar(DATOS, CTX);
      avanzar(31 * 86_400_000);
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow("Tu sesión venció");
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
      await expect(servicio.refrescar(inicial.refresh.token, CTX)).rejects.toThrow(ErrorNoAutorizado);
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
      await expect(servicio.login({ email: DATOS.email, password: DATOS.password }, CTX)).rejects.toThrow(
        ErrorNoAutorizado,
      );
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
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/autenticacion/autenticacion.servicio`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Implementar los repositorios de usuarios y sesiones**

`backend/src/modulos/autenticacion/usuarios.repositorio.ts`:
```ts
import type { Prisma, Usuario } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";

export class UsuariosRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  buscarPorEmail(email: string, bd: ClienteBD = this.bd): Promise<Usuario | null> {
    return bd.usuario.findFirst({ where: { email, eliminadoEn: null } });
  }

  buscarPorId(id: string, bd: ClienteBD = this.bd): Promise<Usuario | null> {
    return bd.usuario.findFirst({ where: { id, eliminadoEn: null } });
  }

  /** Crea el usuario y su cartera inicial en una sola escritura atómica. */
  crearConCarteraInicial(
    datos: Pick<Prisma.UsuarioCreateInput, "nombre" | "email" | "hashPassword" | "rol">,
    nombreCartera: string,
    bd: ClienteBD = this.bd,
  ): Promise<Usuario> {
    return bd.usuario.create({
      data: { ...datos, carteras: { create: { nombre: nombreCartera, esPrincipal: true } } },
    });
  }

  async actualizarHash(id: string, hashPassword: string, bd: ClienteBD = this.bd): Promise<void> {
    await bd.usuario.update({ where: { id }, data: { hashPassword } });
  }
}
```

`backend/src/modulos/autenticacion/sesiones.repositorio.ts`:
```ts
import type { Sesion } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";

export interface NuevaSesion {
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  userAgent: string | null;
  ip: string | null;
}

/** Tabla técnica: no usa RepositorioBase porque las sesiones se revocan, no se borran. */
export class SesionesRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  crear(datos: NuevaSesion, bd: ClienteBD = this.bd): Promise<Sesion> {
    return bd.sesion.create({ data: datos });
  }

  buscarPorHash(tokenHash: string, bd: ClienteBD = this.bd): Promise<Sesion | null> {
    return bd.sesion.findUnique({ where: { tokenHash } });
  }

  async marcarReemplazada(
    id: string,
    reemplazadaPorId: string,
    ahora: Date,
    bd: ClienteBD = this.bd,
  ): Promise<void> {
    await bd.sesion.update({ where: { id }, data: { revocadaEn: ahora, reemplazadaPorId } });
  }

  async revocar(id: string, ahora: Date, bd: ClienteBD = this.bd): Promise<void> {
    await bd.sesion.updateMany({ where: { id, revocadaEn: null }, data: { revocadaEn: ahora } });
  }

  /** Revoca la sesión y todas las que la fueron reemplazando. */
  async revocarCadenaDesde(id: string, ahora: Date, bd: ClienteBD = this.bd): Promise<void> {
    const visitadas = new Set<string>();
    let actual: string | null = id;
    while (actual && !visitadas.has(actual)) {
      visitadas.add(actual);
      const sesion: Sesion | null = await bd.sesion.findUnique({ where: { id: actual } });
      if (!sesion) return;
      await this.revocar(sesion.id, ahora, bd);
      actual = sesion.reemplazadaPorId;
    }
  }

  async revocarOtrasDelUsuario(
    usuarioId: string,
    exceptoId: string | null,
    ahora: Date,
    bd: ClienteBD = this.bd,
  ): Promise<void> {
    await bd.sesion.updateMany({
      where: { usuarioId, revocadaEn: null, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
      data: { revocadaEn: ahora },
    });
  }
}
```

- [ ] **Step 5: Implementar el servicio**

`backend/src/modulos/autenticacion/autenticacion.servicio.ts`:
```ts
import type {
  CambioPasswordEntrada,
  LoginEntrada,
  RegistroEntrada,
  RolUsuario,
  SesionRespuesta,
  UsuarioDto,
} from "@cartera/contratos";
import type { PrismaClient, Usuario } from "../../generado/prisma/client";
import {
  ErrorConflicto,
  ErrorNoAutorizado,
  ErrorProhibido,
  ErrorValidacion,
} from "../../compartido/errores";
import type { ServicioContrasenas } from "./contrasenas";
import type { SesionesRepositorio } from "./sesiones.repositorio";
import type { RefreshEmitido, ServicioTokens } from "./tokens";
import type { UsuariosRepositorio } from "./usuarios.repositorio";

export const CARTERA_INICIAL = "Principal";
/** Ventana en la que reusar un refresh recién rotado no se considera robo (dos pestañas). */
export const GRACIA_REUSO_REFRESH_MS = 10_000;

const MENSAJE_CREDENCIALES = "Email o contraseña incorrectos.";
const MENSAJE_SESION_TERMINADA = "Tu sesión terminó. Iniciá sesión de nuevo.";
const MENSAJE_SESION_VENCIDA = "Tu sesión venció. Iniciá sesión de nuevo.";
const PASSWORD_FICTICIA = "contrasena-ficticia-para-igualar-tiempos";

export interface ContextoCliente {
  userAgent?: string;
  ip?: string;
}

export interface ResultadoSesion {
  respuesta: SesionRespuesta;
  refresh: { token: string; expiraEn: Date };
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
}

export interface OpcionesAutenticacion {
  registroHabilitado: boolean;
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function aUsuarioDto(usuario: Usuario): UsuarioDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    monedaBase: usuario.monedaBase,
    dolarReferencia: usuario.dolarReferencia,
    metodoCosto: usuario.metodoCosto,
  };
}

export class AutenticacionServicio {
  private hashFicticio: Promise<string> | undefined;

  constructor(
    private readonly bd: PrismaClient,
    private readonly usuarios: UsuariosRepositorio,
    private readonly sesiones: SesionesRepositorio,
    private readonly contrasenas: ServicioContrasenas,
    private readonly tokens: ServicioTokens,
    private readonly opciones: OpcionesAutenticacion,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async registrar(entrada: RegistroEntrada, contexto: ContextoCliente): Promise<ResultadoSesion> {
    if (!this.opciones.registroHabilitado) {
      throw new ErrorProhibido(
        "El registro de cuentas nuevas está deshabilitado. Pedile acceso al administrador.",
      );
    }
    const usuario = await this.crearUsuario({ ...entrada, rol: "USUARIO" });
    return this.iniciarSesion(usuario, contexto);
  }

  /** Alta de usuario con su cartera inicial. La usan el registro y el seed del administrador. */
  async crearUsuario(nuevo: NuevoUsuario): Promise<Usuario> {
    const email = normalizarEmail(nuevo.email);
    if (await this.usuarios.buscarPorEmail(email)) {
      throw new ErrorConflicto("Ya existe una cuenta con ese email.");
    }
    const hashPassword = await this.contrasenas.hashear(nuevo.password);
    return this.usuarios.crearConCarteraInicial(
      { nombre: nuevo.nombre.trim(), email, hashPassword, rol: nuevo.rol },
      CARTERA_INICIAL,
    );
  }

  async login(entrada: LoginEntrada, contexto: ContextoCliente): Promise<ResultadoSesion> {
    const usuario = await this.usuarios.buscarPorEmail(normalizarEmail(entrada.email));
    const valida = usuario
      ? await this.contrasenas.verificar(usuario.hashPassword, entrada.password)
      : await this.verificarContraFicticia(entrada.password);
    if (!usuario || !valida) throw new ErrorNoAutorizado(MENSAJE_CREDENCIALES);
    return this.iniciarSesion(usuario, contexto);
  }

  async refrescar(tokenRefresh: string | undefined, contexto: ContextoCliente): Promise<ResultadoSesion> {
    if (!tokenRefresh) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    const sesion = await this.sesiones.buscarPorHash(this.tokens.hashearRefresh(tokenRefresh));
    if (!sesion) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    const ahora = this.ahora();

    if (sesion.revocadaEn) {
      const reusoInmediato =
        sesion.reemplazadaPorId !== null &&
        ahora.getTime() - sesion.revocadaEn.getTime() < GRACIA_REUSO_REFRESH_MS;
      if (!reusoInmediato) await this.sesiones.revocarCadenaDesde(sesion.id, ahora);
      throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    }
    if (sesion.expiraEn <= ahora) {
      await this.sesiones.revocar(sesion.id, ahora);
      throw new ErrorNoAutorizado(MENSAJE_SESION_VENCIDA);
    }
    const usuario = await this.usuarios.buscarPorId(sesion.usuarioId);
    if (!usuario) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);

    const refresh = this.tokens.generarRefresh();
    await this.bd.$transaction(async (tx) => {
      const nueva = await this.sesiones.crear(this.datosSesion(usuario.id, refresh, contexto), tx);
      await this.sesiones.marcarReemplazada(sesion.id, nueva.id, ahora, tx);
    });
    return this.armarResultado(usuario, refresh);
  }

  async logout(tokenRefresh: string | undefined): Promise<void> {
    if (!tokenRefresh) return;
    const sesion = await this.sesiones.buscarPorHash(this.tokens.hashearRefresh(tokenRefresh));
    if (sesion) await this.sesiones.revocar(sesion.id, this.ahora());
  }

  async yo(usuarioId: string): Promise<UsuarioDto> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    return aUsuarioDto(usuario);
  }

  async cambiarPassword(
    usuarioId: string,
    entrada: CambioPasswordEntrada,
    tokenRefreshActual?: string,
  ): Promise<void> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    if (!(await this.contrasenas.verificar(usuario.hashPassword, entrada.passwordActual))) {
      throw new ErrorValidacion("La contraseña actual no es correcta.", [
        { campo: "passwordActual", mensaje: "La contraseña actual no es correcta." },
      ]);
    }
    if (entrada.passwordActual === entrada.passwordNueva) {
      throw new ErrorValidacion("La contraseña nueva tiene que ser distinta de la actual.", [
        { campo: "passwordNueva", mensaje: "Tiene que ser distinta de la actual." },
      ]);
    }
    const hash = await this.contrasenas.hashear(entrada.passwordNueva);
    const sesionActual = tokenRefreshActual
      ? await this.sesiones.buscarPorHash(this.tokens.hashearRefresh(tokenRefreshActual))
      : null;
    await this.bd.$transaction(async (tx) => {
      await this.usuarios.actualizarHash(usuarioId, hash, tx);
      await this.sesiones.revocarOtrasDelUsuario(usuarioId, sesionActual?.id ?? null, this.ahora(), tx);
    });
  }

  private async iniciarSesion(usuario: Usuario, contexto: ContextoCliente): Promise<ResultadoSesion> {
    const refresh = this.tokens.generarRefresh();
    await this.sesiones.crear(this.datosSesion(usuario.id, refresh, contexto));
    return this.armarResultado(usuario, refresh);
  }

  private datosSesion(usuarioId: string, refresh: RefreshEmitido, contexto: ContextoCliente) {
    return {
      usuarioId,
      tokenHash: refresh.hash,
      expiraEn: refresh.expiraEn,
      userAgent: contexto.userAgent ?? null,
      ip: contexto.ip ?? null,
    };
  }

  private async armarResultado(usuario: Usuario, refresh: RefreshEmitido): Promise<ResultadoSesion> {
    const acceso = await this.tokens.firmarAcceso({ usuarioId: usuario.id, rol: usuario.rol });
    return {
      respuesta: {
        tokenAcceso: acceso.token,
        expiraEn: acceso.expiraEn.toISOString(),
        usuario: aUsuarioDto(usuario),
      },
      refresh: { token: refresh.token, expiraEn: refresh.expiraEn },
    };
  }

  /** Verifica contra un hash ficticio para que un email inexistente tarde lo mismo. */
  private async verificarContraFicticia(password: string): Promise<false> {
    this.hashFicticio ??= this.contrasenas.hashear(PASSWORD_FICTICIA);
    await this.contrasenas.verificar(await this.hashFicticio, password);
    return false;
  }
}
```

- [ ] **Step 6: Correr tests, tipos, lint y formato**

Run: `npm test && npm run tipos && npm run lint && npm run formato`
Expected: todo PASS.

- [ ] **Step 7: Mostrar el estado**

Run: `git status --short`

---

### Task 9: Autenticación por HTTP, contenedor y app completa

**Files:**
- Create: `backend/src/compartido/http/usuario-de.ts`, `backend/src/tipos/express.d.ts`
- Create: `backend/src/modulos/autenticacion/autenticacion.esquemas.ts`, `autenticacion.controlador.ts`, `autenticacion.rutas.ts`, `requiere-autenticacion.ts`, `index.ts` (todos en `backend/src/modulos/autenticacion/`)
- Create: `backend/src/contenedor.ts`
- Modify: `backend/src/app.ts` (reemplazo completo)
- Create: `backend/test/utilidades/entorno-prueba.ts`, `backend/test/utilidades/app-prueba.ts`
- Modify: `backend/test/app.test.ts` (reemplazo completo)
- Test: `backend/test/modulos/autenticacion/autenticacion.api.test.ts`

**Interfaces:**
- Consumes: `AutenticacionServicio`, `ServicioTokens`, `ServicioContrasenas`, repositorios (Tareas 7–8); `validar` (Tarea 3); `cargarEntorno`, `Entorno` (Tarea 2); `crearClienteBD` (Tarea 4).
- Produces:
  - `interface UsuarioAutenticado { id: string; rol: RolUsuario }` · `usuarioDe(req): UsuarioAutenticado`
  - `NOMBRE_COOKIE_REFRESH = "cartera_refresh"`, `RUTA_COOKIE_REFRESH = "/api/auth"`
  - `interface ModuloAutenticacion { servicio: AutenticacionServicio; requiereAutenticacion: RequestHandler; rutas: Router }` · `crearModuloAutenticacion(bd, entorno): ModuloAutenticacion`
  - `interface Contenedor { entorno: Entorno; bd: PrismaClient; auditoria: AuditoriaRepositorio; autenticacion: ModuloAutenticacion }` · `crearContenedor(entorno, bd?): Contenedor`
  - `crearApp(contenedor: Contenedor): Express`
  - (tests) `entornoPrueba(extra?)`, `crearAppPrueba(extra?): Promise<AppPrueba>`, `registrarUsuario(app, datos?): Promise<UsuarioLogueado>`, `extraerCookieRefresh(respuesta): string`

- [ ] **Step 1: Instalar los middlewares HTTP**

```bash
npm install -w @cartera/backend helmet cors cookie-parser express-rate-limit
npm install -D -w @cartera/backend @types/cors @types/cookie-parser
```

- [ ] **Step 2: Crear el tipado de `req.usuario`**

`backend/src/compartido/http/usuario-de.ts`:
```ts
import type { Request } from "express";
import type { RolUsuario } from "@cartera/contratos";
import { ErrorNoAutorizado } from "../errores";

export interface UsuarioAutenticado {
  id: string;
  rol: RolUsuario;
}

/** Devuelve el usuario que dejó el middleware de autenticación, o corta con 401. */
export function usuarioDe(req: Request): UsuarioAutenticado {
  if (!req.usuario) throw new ErrorNoAutorizado();
  return req.usuario;
}
```

`backend/src/tipos/express.d.ts`:
```ts
import type { UsuarioAutenticado } from "../compartido/http/usuario-de";

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export {};
```

- [ ] **Step 3: Crear los esquemas de entrada**

`backend/src/modulos/autenticacion/autenticacion.esquemas.ts`:
```ts
import { z } from "zod";
import type { CambioPasswordEntrada, LoginEntrada, RegistroEntrada } from "@cartera/contratos";
import { LARGO_MAXIMO_PASSWORD, LARGO_MINIMO_PASSWORD } from "./contrasenas";

const LARGO_MAXIMO_NOMBRE = 80;
const LARGO_MAXIMO_EMAIL = 254;

const passwordNueva = z
  .string({ message: "Poné una contraseña." })
  .min(LARGO_MINIMO_PASSWORD, `La contraseña necesita al menos ${LARGO_MINIMO_PASSWORD} caracteres.`)
  .max(LARGO_MAXIMO_PASSWORD, `La contraseña puede tener hasta ${LARGO_MAXIMO_PASSWORD} caracteres.`);

export const esquemaRegistro = z.object({
  nombre: z
    .string({ message: "Poné tu nombre." })
    .trim()
    .min(1, "Poné tu nombre.")
    .max(LARGO_MAXIMO_NOMBRE, `El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`),
  email: z
    .string({ message: "Poné tu email." })
    .trim()
    .toLowerCase()
    .max(LARGO_MAXIMO_EMAIL)
    .pipe(z.email("El email no es válido. Ejemplo: nombre@gmail.com")),
  password: passwordNueva,
}) satisfies z.ZodType<RegistroEntrada>;

export const esquemaLogin = z.object({
  email: z.string({ message: "Poné tu email." }).trim().min(1, "Poné tu email."),
  password: z.string({ message: "Poné tu contraseña." }).min(1, "Poné tu contraseña."),
}) satisfies z.ZodType<LoginEntrada>;

export const esquemaCambioPassword = z.object({
  passwordActual: z.string({ message: "Poné tu contraseña actual." }).min(1, "Poné tu contraseña actual."),
  passwordNueva,
}) satisfies z.ZodType<CambioPasswordEntrada>;
```

- [ ] **Step 4: Crear el middleware, el controlador y las rutas**

`backend/src/modulos/autenticacion/requiere-autenticacion.ts`:
```ts
import type { RequestHandler } from "express";
import { ErrorNoAutorizado } from "../../compartido/errores";
import type { ServicioTokens } from "./tokens";

export function crearRequiereAutenticacion(tokens: ServicioTokens): RequestHandler {
  return async (req, _res, next) => {
    const [esquema, token] = req.get("authorization")?.split(" ") ?? [];
    if (esquema !== "Bearer" || !token) throw new ErrorNoAutorizado();
    const carga = await tokens.verificarAcceso(token);
    req.usuario = { id: carga.usuarioId, rol: carga.rol };
    next();
  };
}
```

`backend/src/modulos/autenticacion/autenticacion.controlador.ts`:
```ts
import type { Request, RequestHandler, Response } from "express";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import type { AutenticacionServicio, ContextoCliente, ResultadoSesion } from "./autenticacion.servicio";
import { esquemaCambioPassword, esquemaLogin, esquemaRegistro } from "./autenticacion.esquemas";

export const NOMBRE_COOKIE_REFRESH = "cartera_refresh";
export const RUTA_COOKIE_REFRESH = "/api/auth";

function leerCookieRefresh(req: Request): string | undefined {
  const valor: unknown = req.cookies?.[NOMBRE_COOKIE_REFRESH];
  return typeof valor === "string" ? valor : undefined;
}

function contextoDe(req: Request): ContextoCliente {
  return { userAgent: req.get("user-agent"), ip: req.ip };
}

export class AutenticacionControlador {
  constructor(
    private readonly servicio: AutenticacionServicio,
    private readonly cookieSegura: boolean,
  ) {}

  readonly registrar: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaRegistro, req.body);
    this.responderSesion(res, await this.servicio.registrar(entrada, contextoDe(req)), 201);
  };

  readonly login: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaLogin, req.body);
    this.responderSesion(res, await this.servicio.login(entrada, contextoDe(req)), 200);
  };

  readonly refrescar: RequestHandler = async (req, res) => {
    const resultado = await this.servicio.refrescar(leerCookieRefresh(req), contextoDe(req));
    this.responderSesion(res, resultado, 200);
  };

  readonly logout: RequestHandler = async (req, res) => {
    await this.servicio.logout(leerCookieRefresh(req));
    res.clearCookie(NOMBRE_COOKIE_REFRESH, { path: RUTA_COOKIE_REFRESH });
    res.status(204).end();
  };

  readonly yo: RequestHandler = async (req, res) => {
    res.json(await this.servicio.yo(usuarioDe(req).id));
  };

  readonly cambiarPassword: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaCambioPassword, req.body);
    await this.servicio.cambiarPassword(usuarioDe(req).id, entrada, leerCookieRefresh(req));
    res.status(204).end();
  };

  private responderSesion(res: Response, resultado: ResultadoSesion, status: number): void {
    res.cookie(NOMBRE_COOKIE_REFRESH, resultado.refresh.token, {
      httpOnly: true,
      secure: this.cookieSegura,
      sameSite: "strict",
      path: RUTA_COOKIE_REFRESH,
      expires: resultado.refresh.expiraEn,
    });
    res.status(status).json(resultado.respuesta);
  }
}
```

`backend/src/modulos/autenticacion/autenticacion.rutas.ts`:
```ts
import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { ErrorDemasiadosIntentos } from "../../compartido/errores";
import type { AutenticacionControlador } from "./autenticacion.controlador";

export interface OpcionesRutasAutenticacion {
  intentosMaximos: number;
  ventanaMinutos: number;
}

const MS_POR_MINUTO = 60_000;

export function crearRutasAutenticacion(
  controlador: AutenticacionControlador,
  requiereAutenticacion: RequestHandler,
  opciones: OpcionesRutasAutenticacion,
): Router {
  const limitador = rateLimit({
    windowMs: opciones.ventanaMinutos * MS_POR_MINUTO,
    limit: opciones.intentosMaximos,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ErrorDemasiadosIntentos()),
  });

  const rutas = Router();
  rutas.post("/registro", limitador, controlador.registrar);
  rutas.post("/login", limitador, controlador.login);
  rutas.post("/refrescar", controlador.refrescar);
  rutas.post("/logout", controlador.logout);
  rutas.get("/yo", requiereAutenticacion, controlador.yo);
  rutas.patch("/password", requiereAutenticacion, controlador.cambiarPassword);
  return rutas;
}
```

`backend/src/modulos/autenticacion/index.ts`:
```ts
import type { RequestHandler, Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { Entorno } from "../../config/entorno";
import { AutenticacionControlador } from "./autenticacion.controlador";
import { crearRutasAutenticacion } from "./autenticacion.rutas";
import { AutenticacionServicio } from "./autenticacion.servicio";
import { ServicioContrasenas } from "./contrasenas";
import { crearRequiereAutenticacion } from "./requiere-autenticacion";
import { SesionesRepositorio } from "./sesiones.repositorio";
import { ServicioTokens } from "./tokens";
import { UsuariosRepositorio } from "./usuarios.repositorio";

export type { AutenticacionServicio } from "./autenticacion.servicio";
export { LARGO_MINIMO_PASSWORD } from "./contrasenas";
export { NOMBRE_COOKIE_REFRESH } from "./autenticacion.controlador";

export interface ModuloAutenticacion {
  servicio: AutenticacionServicio;
  requiereAutenticacion: RequestHandler;
  rutas: Router;
}

export function crearModuloAutenticacion(bd: PrismaClient, entorno: Entorno): ModuloAutenticacion {
  const tokens = new ServicioTokens(entorno.JWT_SECRETO, entorno.JWT_ACCESO_MINUTOS, entorno.REFRESH_DIAS);
  const servicio = new AutenticacionServicio(
    bd,
    new UsuariosRepositorio(bd),
    new SesionesRepositorio(bd),
    new ServicioContrasenas(),
    tokens,
    { registroHabilitado: entorno.REGISTRO_HABILITADO },
  );
  const requiereAutenticacion = crearRequiereAutenticacion(tokens);
  const controlador = new AutenticacionControlador(servicio, entorno.NODE_ENV === "production");
  const rutas = crearRutasAutenticacion(controlador, requiereAutenticacion, {
    intentosMaximos: entorno.LOGIN_INTENTOS_MAX,
    ventanaMinutos: entorno.LOGIN_VENTANA_MINUTOS,
  });
  return { servicio, requiereAutenticacion, rutas };
}
```

- [ ] **Step 5: Crear el contenedor y reemplazar la app**

`backend/src/contenedor.ts`:
```ts
import type { PrismaClient } from "./generado/prisma/client";
import type { Entorno } from "./config/entorno";
import { crearClienteBD } from "./compartido/base-datos/cliente";
import { AuditoriaRepositorio } from "./compartido/auditoria/auditoria.repositorio";
import { crearModuloAutenticacion, type ModuloAutenticacion } from "./modulos/autenticacion";

/** Punto único de composición: crea y conecta todas las piezas del backend. */
export interface Contenedor {
  entorno: Entorno;
  bd: PrismaClient;
  auditoria: AuditoriaRepositorio;
  autenticacion: ModuloAutenticacion;
}

export function crearContenedor(
  entorno: Entorno,
  bd: PrismaClient = crearClienteBD(entorno.DATABASE_URL),
): Contenedor {
  const auditoria = new AuditoriaRepositorio(bd);
  return {
    entorno,
    bd,
    auditoria,
    autenticacion: crearModuloAutenticacion(bd, entorno),
  };
}
```

Reemplazar todo `backend/src/app.ts` por:
```ts
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router, type Express } from "express";
import helmet from "helmet";
import type { Contenedor } from "./contenedor";
import { crearManejadorErrores } from "./compartido/http/manejador-errores";
import { rutaNoEncontrada } from "./compartido/http/ruta-no-encontrada";

const LIMITE_CUERPO_JSON = "1mb";

export function crearApp(contenedor: Contenedor): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: contenedor.entorno.CORS_ORIGEN, credentials: true }));
  app.use(express.json({ limit: LIMITE_CUERPO_JSON }));
  app.use(cookieParser());

  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });
  app.use("/api/auth", contenedor.autenticacion.rutas);

  const privadas = Router();
  privadas.use(contenedor.autenticacion.requiereAutenticacion);
  app.use("/api", privadas);

  app.use(rutaNoEncontrada);
  app.use(crearManejadorErrores());
  return app;
}
```

- [ ] **Step 6: Crear las utilidades de test de API**

`backend/test/utilidades/entorno-prueba.ts`:
```ts
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
```

`backend/test/utilidades/app-prueba.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request, { type Response } from "supertest";
import type { RegistroEntrada, SesionRespuesta, UsuarioDto } from "@cartera/contratos";
import type { PrismaClient } from "../../src/generado/prisma/client";
import { crearApp } from "../../src/app";
import { crearContenedor } from "../../src/contenedor";
import { NOMBRE_COOKIE_REFRESH } from "../../src/modulos/autenticacion";
import { crearBasePrueba } from "./base-datos-prueba";
import { entornoPrueba } from "./entorno-prueba";

export interface AppPrueba {
  app: Express;
  bd: PrismaClient;
  cerrar: () => Promise<void>;
}

export async function crearAppPrueba(extra: Record<string, string> = {}): Promise<AppPrueba> {
  const { bd, cerrar } = await crearBasePrueba();
  return { app: crearApp(crearContenedor(entornoPrueba(extra), bd)), bd, cerrar };
}

export interface UsuarioLogueado {
  token: string;
  cookie: string;
  usuario: UsuarioDto;
}

export function extraerCookieRefresh(respuesta: Response): string {
  const encabezado = respuesta.headers["set-cookie"];
  const cookies = Array.isArray(encabezado) ? encabezado : encabezado ? [String(encabezado)] : [];
  const cookie = cookies.find((valor) => valor.startsWith(`${NOMBRE_COOKIE_REFRESH}=`));
  if (!cookie) throw new Error("La respuesta no trajo la cookie de refresh.");
  return cookie.split(";")[0] ?? cookie;
}

export async function registrarUsuario(
  app: Express,
  datos: Partial<RegistroEntrada> = {},
): Promise<UsuarioLogueado> {
  const cuerpo: RegistroEntrada = {
    nombre: "Usuario de prueba",
    email: `api-${randomUUID()}@prueba.com`,
    password: "clave-segura-123",
    ...datos,
  };
  const respuesta = await request(app).post("/api/auth/registro").send(cuerpo).expect(201);
  const sesion = respuesta.body as SesionRespuesta;
  return { token: sesion.tokenAcceso, cookie: extraerCookieRefresh(respuesta), usuario: sesion.usuario };
}
```

Reemplazar todo `backend/test/app.test.ts` por:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { crearAppPrueba, type AppPrueba } from "./utilidades/app-prueba";

describe("app", () => {
  let prueba: AppPrueba;
  beforeAll(async () => {
    prueba = await crearAppPrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("responde el chequeo de salud sin pedir sesión", async () => {
    const respuesta = await request(prueba.app).get("/api/salud");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });

  it("agrega los encabezados de seguridad de helmet", async () => {
    const respuesta = await request(prueba.app).get("/api/salud");
    expect(respuesta.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("exige sesión en las rutas privadas", async () => {
    const respuesta = await request(prueba.app).get("/api/carteras");
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe("NO_AUTORIZADO");
  });

  it("responde 404 en JSON fuera de /api", async () => {
    const respuesta = await request(prueba.app).get("/no-existe");
    expect(respuesta.status).toBe(404);
  });
});
```

- [ ] **Step 7: Escribir el test de API que falla**

`backend/test/modulos/autenticacion/autenticacion.api.test.ts`:
```ts
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
    const password = respuesta.body.error.detalles.find((d: { campo: string }) => d.campo === "password");
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
    const conToken = await request(prueba.app).get("/api/auth/yo").set("Authorization", `Bearer ${token}`);
    expect(conToken.status).toBe(200);
    expect(conToken.body.id).toBe(usuario.id);
    expect((await request(prueba.app).get("/api/auth/yo")).status).toBe(401);
    const basura = await request(prueba.app).get("/api/auth/yo").set("Authorization", "Bearer basura");
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

  it("en producción la cookie es Secure", async () => {
    const prueba = await crearAppPrueba({ NODE_ENV: "production" });
    const respuesta = await request(prueba.app)
      .post("/api/auth/registro")
      .send({ nombre: "X", email: "prod@prueba.com", password: "clave-segura-123" });
    expect(String(respuesta.headers["set-cookie"])).toContain("Secure");
    await prueba.cerrar();
  });
});
```

- [ ] **Step 8: Correr tests, tipos, lint y formato**

Run: `npm test && npm run tipos && npm run lint && npm run formato`
Expected: todo PASS. (Si ESLint marca `@typescript-eslint/no-namespace` en `express.d.ts`, confirmar que el archivo termina en `.d.ts`: la regla permite namespaces en archivos de definición.)

- [ ] **Step 9: Mostrar el estado**

Run: `git status --short`

---

### Task 10: Módulo de carteras (con controlador y rutas CRUD reutilizables)

**Files:**
- Create: `contratos/src/carteras.ts` · Modify: `contratos/src/index.ts`
- Create: `backend/src/compartido/http/parametros.ts`, `backend/src/compartido/http/controlador-crud.ts`, `backend/src/compartido/http/rutas-crud.ts`
- Create: `backend/src/modulos/carteras/carteras.repositorio.ts`, `carteras.servicio.ts`, `carteras.esquemas.ts`, `carteras.controlador.ts`, `carteras.rutas.ts`, `index.ts`
- Modify: `backend/src/contenedor.ts`, `backend/src/app.ts`
- Test: `backend/test/modulos/carteras/carteras.api.test.ts`

**Interfaces:**
- Consumes: `RepositorioDelUsuario` (T5), `ServicioAuditado`, `AuditoriaRepositorio` (T6), `usuarioDe` (T9), `validar` (T3), `esquemaConsultaListado`, `mapearPagina` (T5), test utils de T9.
- Produces:
  - contratos: `CarteraDto { id; nombre; descripcion: string | null; esPrincipal; archivada; orden; creadoEn: string; actualizadoEn: string }`, `CrearCarteraEntrada { nombre: string; descripcion?: string }`, `EditarCarteraEntrada { nombre?; descripcion?: string | null; esPrincipal?: boolean; archivada?: boolean; orden?: number }`
  - `parametro(req, nombre): string`
  - `interface ServicioCrud<TDto, TCrear, TEditar, TConsulta>` · `interface EsquemasCrud<TCrear, TEditar, TConsulta>` · `interface ManejadoresCrud` · `class ControladorCrud<TDto, TCrear, TEditar, TConsulta> implements ManejadoresCrud` · `crearRutasCrud(manejadores: ManejadoresCrud): Router`
  - `interface ModuloCarteras { servicio: CarterasServicio; rutas: Router }` · `crearModuloCarteras(bd, auditoria): ModuloCarteras`
  - `Contenedor` suma `carteras: ModuloCarteras`

- [ ] **Step 1: Agregar los contratos**

`contratos/src/carteras.ts`:
```ts
export interface CarteraDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  esPrincipal: boolean;
  archivada: boolean;
  orden: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearCarteraEntrada {
  nombre: string;
  descripcion?: string;
}

export interface EditarCarteraEntrada {
  nombre?: string;
  descripcion?: string | null;
  /** Solo se acepta `true`: para cambiar la principal se marca otra. */
  esPrincipal?: boolean;
  archivada?: boolean;
  orden?: number;
}
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./carteras";
```

- [ ] **Step 2: Escribir el test de API que falla**

`backend/test/modulos/carteras/carteras.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CarteraDto, Pagina } from "@cartera/contratos";
import { crearAppPrueba, registrarUsuario, type AppPrueba, type UsuarioLogueado } from "../../utilidades/app-prueba";

describe("API de carteras", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;

  const como = (usuario: UsuarioLogueado) => ({
    get: (ruta: string) => request(prueba.app).get(ruta).set("Authorization", `Bearer ${usuario.token}`),
    post: (ruta: string, cuerpo: object) =>
      request(prueba.app).post(ruta).set("Authorization", `Bearer ${usuario.token}`).send(cuerpo),
    patch: (ruta: string, cuerpo: object) =>
      request(prueba.app).patch(ruta).set("Authorization", `Bearer ${usuario.token}`).send(cuerpo),
    delete: (ruta: string) => request(prueba.app).delete(ruta).set("Authorization", `Bearer ${usuario.token}`),
  });

  async function carteras(usuario: UsuarioLogueado, consulta = ""): Promise<CarteraDto[]> {
    const respuesta = await como(usuario).get(`/api/carteras${consulta}`).expect(200);
    return (respuesta.body as Pagina<CarteraDto>).items;
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
    const creada = await como(ana).post("/api/carteras", { nombre: "Jubilación", descripcion: "Largo plazo" });
    expect(creada.status).toBe(201);
    expect(creada.body).toMatchObject({ nombre: "Jubilación", descripcion: "Largo plazo", esPrincipal: false });
    const obtenida = await como(ana).get(`/api/carteras/${creada.body.id}`);
    expect(obtenida.body.nombre).toBe("Jubilación");
    const auditoria = await prueba.bd.registroAuditoria.findMany({ where: { entidadId: creada.body.id } });
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
    expect(vacio.body.error.detalles[0]).toEqual({ campo: "nombre", mensaje: "Poné un nombre para la cartera." });
    const largo = await como(ana).post("/api/carteras", { nombre: "x".repeat(61) });
    expect(largo.status).toBe(400);
    expect(largo.body.error.detalles[0].mensaje).toBe("El nombre puede tener hasta 60 caracteres.");
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
    await como(ana).patch(`/api/carteras/${(await carteras(ana)).find((c) => c.nombre === "Principal")?.id}`, { esPrincipal: true }).expect(200);
  });

  it("no acepta esPrincipal:false y explica cómo cambiarla", async () => {
    const [principal] = (await carteras(ana)).filter((c) => c.esPrincipal);
    const respuesta = await como(ana).patch(`/api/carteras/${principal?.id}`, { esPrincipal: false });
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
    const principal = await como(ana).patch(`/api/carteras/${creada.body.id}`, { esPrincipal: true });
    expect(principal.status).toBe(200);
    expect(principal.body).toMatchObject({ esPrincipal: true, archivada: false });
    await como(ana).patch(`/api/carteras/${(await carteras(ana)).find((c) => c.nombre === "Principal")?.id}`, { esPrincipal: true }).expect(200);
  });

  it("el listado oculta las archivadas salvo que se pidan", async () => {
    const creada = await como(ana).post("/api/carteras", { nombre: "Archivada" }).expect(201);
    await como(ana).patch(`/api/carteras/${creada.body.id}`, { archivada: true }).expect(200);
    expect((await carteras(ana)).map((c) => c.nombre)).not.toContain("Archivada");
    expect((await carteras(ana, "?incluirArchivadas=true")).map((c) => c.nombre)).toContain("Archivada");
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

  it("rechaza ordenar por un campo no permitido", async () => {
    const respuesta = await como(ana).get("/api/carteras?orden=usuarioId");
    expect(respuesta.status).toBe(400);
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/carteras`
Expected: FAIL — `/api/carteras` responde 404/401 en lugar de los datos esperados.

- [ ] **Step 4: Implementar las piezas HTTP reutilizables**

`backend/src/compartido/http/parametros.ts`:
```ts
import type { Request } from "express";
import { ErrorValidacion } from "../errores";

export function parametro(req: Request, nombre: string): string {
  const valor: unknown = req.params[nombre];
  if (typeof valor !== "string" || valor.length === 0) {
    throw new ErrorValidacion(`Falta el parámetro "${nombre}" en la dirección.`);
  }
  return valor;
}
```

`backend/src/compartido/http/controlador-crud.ts`:
```ts
import type { RequestHandler } from "express";
import type { Pagina } from "@cartera/contratos";
import type { z } from "zod";
import { validar } from "../validacion";
import { parametro } from "./parametros";
import { usuarioDe } from "./usuario-de";

export interface ServicioCrud<TDto, TCrear, TEditar, TConsulta> {
  listar(usuarioId: string, consulta: TConsulta): Promise<Pagina<TDto>>;
  obtener(usuarioId: string, id: string): Promise<TDto>;
  crear(usuarioId: string, entrada: TCrear): Promise<TDto>;
  editar(usuarioId: string, id: string, entrada: TEditar): Promise<TDto>;
  borrar(usuarioId: string, id: string): Promise<void>;
}

export interface EsquemasCrud<TCrear, TEditar, TConsulta> {
  crear: z.ZodType<TCrear>;
  editar: z.ZodType<TEditar>;
  consulta: z.ZodType<TConsulta>;
}

export interface ManejadoresCrud {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
  editar: RequestHandler;
  borrar: RequestHandler;
}

/** Controlador genérico para recursos del usuario: valida, delega en el servicio y responde. */
export class ControladorCrud<TDto, TCrear, TEditar, TConsulta> implements ManejadoresCrud {
  constructor(
    private readonly servicio: ServicioCrud<TDto, TCrear, TEditar, TConsulta>,
    private readonly esquemas: EsquemasCrud<TCrear, TEditar, TConsulta>,
  ) {}

  readonly listar: RequestHandler = async (req, res) => {
    const consulta = validar(this.esquemas.consulta, req.query);
    res.json(await this.servicio.listar(usuarioDe(req).id, consulta));
  };

  readonly obtener: RequestHandler = async (req, res) => {
    res.json(await this.servicio.obtener(usuarioDe(req).id, parametro(req, "id")));
  };

  readonly crear: RequestHandler = async (req, res) => {
    const entrada = validar(this.esquemas.crear, req.body);
    res.status(201).json(await this.servicio.crear(usuarioDe(req).id, entrada));
  };

  readonly editar: RequestHandler = async (req, res) => {
    const entrada = validar(this.esquemas.editar, req.body);
    res.json(await this.servicio.editar(usuarioDe(req).id, parametro(req, "id"), entrada));
  };

  readonly borrar: RequestHandler = async (req, res) => {
    await this.servicio.borrar(usuarioDe(req).id, parametro(req, "id"));
    res.status(204).end();
  };
}
```

`backend/src/compartido/http/rutas-crud.ts`:
```ts
import { Router } from "express";
import type { ManejadoresCrud } from "./controlador-crud";

export function crearRutasCrud(manejadores: ManejadoresCrud): Router {
  const rutas = Router();
  rutas.get("/", manejadores.listar);
  rutas.post("/", manejadores.crear);
  rutas.get("/:id", manejadores.obtener);
  rutas.patch("/:id", manejadores.editar);
  rutas.delete("/:id", manejadores.borrar);
  return rutas;
}
```

- [ ] **Step 5: Implementar el módulo de carteras**

`backend/src/modulos/carteras/carteras.repositorio.ts`:
```ts
import type { Cartera, Prisma } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { RepositorioDelUsuario } from "../../compartido/repositorios/repositorio-del-usuario";

export type NuevaCartera = Omit<Prisma.CarteraUncheckedCreateInput, "usuarioId">;
export type EdicionCartera = Pick<
  Prisma.CarteraUncheckedUpdateInput,
  "nombre" | "descripcion" | "esPrincipal" | "archivada" | "orden"
>;

export class CarterasRepositorio extends RepositorioDelUsuario<
  Cartera,
  NuevaCartera,
  Prisma.CarteraUncheckedCreateInput,
  EdicionCartera
> {
  protected readonly entidad = "la cartera";
  protected readonly camposOrdenables = ["orden", "nombre", "creadoEn"] as const;
  protected readonly ordenPorDefecto = "orden";

  protected delegado(bd: ClienteBD) {
    return bd.cartera;
  }

  protected conDueno(usuarioId: string, datos: NuevaCartera) {
    return { ...datos, usuarioId };
  }

  buscarPorNombre(
    usuarioId: string,
    nombre: string,
    excluirId?: string,
    bd: ClienteBD = this.bd,
  ): Promise<Cartera | null> {
    return bd.cartera.findFirst({
      where: { usuarioId, nombre, eliminadoEn: null, ...(excluirId ? { id: { not: excluirId } } : {}) },
    });
  }

  async desmarcarPrincipal(usuarioId: string, bd: ClienteBD = this.bd): Promise<void> {
    await bd.cartera.updateMany({
      where: { usuarioId, esPrincipal: true, eliminadoEn: null },
      data: { esPrincipal: false },
    });
  }
}
```

`backend/src/modulos/carteras/carteras.esquemas.ts`:
```ts
import { z } from "zod";
import type { CrearCarteraEntrada, EditarCarteraEntrada } from "@cartera/contratos";
import { esquemaConsultaListado } from "../../compartido/paginacion";

const LARGO_MAXIMO_NOMBRE = 60;
const LARGO_MAXIMO_DESCRIPCION = 500;
const ORDEN_MAXIMO = 10_000;

const nombre = z
  .string({ message: "Poné un nombre para la cartera." })
  .trim()
  .min(1, "Poné un nombre para la cartera.")
  .max(LARGO_MAXIMO_NOMBRE, `El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`);

const descripcion = z
  .string()
  .trim()
  .max(LARGO_MAXIMO_DESCRIPCION, `La descripción puede tener hasta ${LARGO_MAXIMO_DESCRIPCION} caracteres.`);

export const esquemaCrearCartera = z.object({
  nombre,
  descripcion: descripcion.optional(),
}) satisfies z.ZodType<CrearCarteraEntrada>;

export const esquemaEditarCartera = z
  .object({
    nombre: nombre.optional(),
    descripcion: descripcion.nullable().optional(),
    esPrincipal: z.boolean().optional(),
    archivada: z.boolean().optional(),
    orden: z.number().int().min(0).max(ORDEN_MAXIMO).optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "No mandaste ningún cambio.",
  }) satisfies z.ZodType<EditarCarteraEntrada>;

export const esquemaConsultaCarteras = esquemaConsultaListado.extend({
  incluirArchivadas: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
});

export type ConsultaCarteras = z.output<typeof esquemaConsultaCarteras>;
```

`backend/src/modulos/carteras/carteras.servicio.ts`:
```ts
import type {
  CarteraDto,
  CrearCarteraEntrada,
  EditarCarteraEntrada,
  Pagina,
} from "@cartera/contratos";
import type { Cartera, Prisma, PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { ServicioAuditado, type PasoPrevio } from "../../compartido/auditoria/servicio-auditado";
import { ErrorConflicto, ErrorValidacion } from "../../compartido/errores";
import type { ServicioCrud } from "../../compartido/http/controlador-crud";
import { mapearPagina } from "../../compartido/paginacion";
import type { ConsultaCarteras } from "./carteras.esquemas";
import type { CarterasRepositorio, EdicionCartera, NuevaCartera } from "./carteras.repositorio";

function aCarteraDto(cartera: Cartera): CarteraDto {
  return {
    id: cartera.id,
    nombre: cartera.nombre,
    descripcion: cartera.descripcion,
    esPrincipal: cartera.esPrincipal,
    archivada: cartera.archivada,
    orden: cartera.orden,
    creadoEn: cartera.creadoEn.toISOString(),
    actualizadoEn: cartera.actualizadoEn.toISOString(),
  };
}

export class CarterasServicio
  extends ServicioAuditado<Cartera, NuevaCartera, Prisma.CarteraUncheckedCreateInput, EdicionCartera>
  implements ServicioCrud<CarteraDto, CrearCarteraEntrada, EditarCarteraEntrada, ConsultaCarteras>
{
  protected readonly entidadAuditada = "Cartera";

  constructor(
    bd: PrismaClient,
    private readonly carteras: CarterasRepositorio,
    auditoria: AuditoriaRepositorio,
  ) {
    super(bd, carteras, auditoria);
  }

  async listar(usuarioId: string, consulta: ConsultaCarteras): Promise<Pagina<CarteraDto>> {
    const { incluirArchivadas, ...listado } = consulta;
    const filtros = incluirArchivadas ? {} : { archivada: false };
    return mapearPagina(await this.carteras.listar(usuarioId, { ...listado, filtros }), aCarteraDto);
  }

  async obtener(usuarioId: string, id: string): Promise<CarteraDto> {
    return aCarteraDto(await this.carteras.obtener(usuarioId, id));
  }

  async crear(usuarioId: string, entrada: CrearCarteraEntrada): Promise<CarteraDto> {
    await this.asegurarNombreLibre(usuarioId, entrada.nombre);
    const creada = await this.crearAuditado(usuarioId, {
      nombre: entrada.nombre,
      descripcion: entrada.descripcion ?? null,
    });
    return aCarteraDto(creada);
  }

  async editar(usuarioId: string, id: string, entrada: EditarCarteraEntrada): Promise<CarteraDto> {
    if (entrada.esPrincipal === false) {
      throw new ErrorValidacion("Para cambiar la cartera principal, marcá otra como principal.", [
        { campo: "esPrincipal", mensaje: "Marcá otra cartera como principal." },
      ]);
    }
    if (entrada.nombre !== undefined) await this.asegurarNombreLibre(usuarioId, entrada.nombre, id);

    const actual = await this.carteras.obtener(usuarioId, id);
    const quedaPrincipal = entrada.esPrincipal === true || actual.esPrincipal;
    if (entrada.archivada === true && quedaPrincipal) {
      throw new ErrorConflicto(
        "No podés archivar tu cartera principal. Marcá otra como principal primero.",
      );
    }

    const datos: EdicionCartera = {
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      orden: entrada.orden,
      archivada: entrada.esPrincipal === true ? false : entrada.archivada,
      esPrincipal: entrada.esPrincipal,
    };
    const pasoPrevio: PasoPrevio | undefined = entrada.esPrincipal
      ? (tx) => this.carteras.desmarcarPrincipal(usuarioId, tx)
      : undefined;
    return aCarteraDto(await this.editarAuditado(usuarioId, id, datos, pasoPrevio));
  }

  async borrar(usuarioId: string, id: string): Promise<void> {
    const cartera = await this.carteras.obtener(usuarioId, id);
    if (cartera.esPrincipal) {
      throw new ErrorConflicto(
        "No podés borrar tu cartera principal. Marcá otra como principal primero.",
      );
    }
    await this.borrarAuditado(usuarioId, id);
  }

  private async asegurarNombreLibre(usuarioId: string, nombre: string, excluirId?: string) {
    if (await this.carteras.buscarPorNombre(usuarioId, nombre, excluirId)) {
      throw new ErrorConflicto(`Ya tenés una cartera llamada "${nombre}".`);
    }
  }
}
```

`backend/src/modulos/carteras/carteras.controlador.ts`:
```ts
import type { CarteraDto, CrearCarteraEntrada, EditarCarteraEntrada } from "@cartera/contratos";
import { ControladorCrud } from "../../compartido/http/controlador-crud";
import {
  esquemaConsultaCarteras,
  esquemaCrearCartera,
  esquemaEditarCartera,
  type ConsultaCarteras,
} from "./carteras.esquemas";
import type { CarterasServicio } from "./carteras.servicio";

export class CarterasControlador extends ControladorCrud<
  CarteraDto,
  CrearCarteraEntrada,
  EditarCarteraEntrada,
  ConsultaCarteras
> {
  constructor(servicio: CarterasServicio) {
    super(servicio, {
      crear: esquemaCrearCartera,
      editar: esquemaEditarCartera,
      consulta: esquemaConsultaCarteras,
    });
  }
}
```

`backend/src/modulos/carteras/carteras.rutas.ts`:
```ts
import type { Router } from "express";
import { crearRutasCrud } from "../../compartido/http/rutas-crud";
import type { CarterasControlador } from "./carteras.controlador";

export function crearRutasCarteras(controlador: CarterasControlador): Router {
  return crearRutasCrud(controlador);
}
```

`backend/src/modulos/carteras/index.ts`:
```ts
import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { CarterasControlador } from "./carteras.controlador";
import { CarterasRepositorio } from "./carteras.repositorio";
import { crearRutasCarteras } from "./carteras.rutas";
import { CarterasServicio } from "./carteras.servicio";

export type { CarterasServicio } from "./carteras.servicio";

export interface ModuloCarteras {
  servicio: CarterasServicio;
  rutas: Router;
}

export function crearModuloCarteras(bd: PrismaClient, auditoria: AuditoriaRepositorio): ModuloCarteras {
  const servicio = new CarterasServicio(bd, new CarterasRepositorio(bd), auditoria);
  return { servicio, rutas: crearRutasCarteras(new CarterasControlador(servicio)) };
}
```

- [ ] **Step 6: Conectar el módulo**

En `backend/src/contenedor.ts`:
- Agregar el import: `import { crearModuloCarteras, type ModuloCarteras } from "./modulos/carteras";`
- En la interfaz `Contenedor`, agregar debajo de `autenticacion: ModuloAutenticacion;`: `carteras: ModuloCarteras;`
- En el objeto devuelto, agregar debajo de `autenticacion: crearModuloAutenticacion(bd, entorno),`: `carteras: crearModuloCarteras(bd, auditoria),`

En `backend/src/app.ts`, debajo de `privadas.use(contenedor.autenticacion.requiereAutenticacion);` agregar:
```ts
  privadas.use("/carteras", contenedor.carteras.rutas);
```

- [ ] **Step 7: Correr tests, tipos, lint y formato**

Run: `npm test && npm run tipos && npm run lint && npm run formato`
Expected: todo PASS.

- [ ] **Step 8: Mostrar el estado**

Run: `git status --short`

---

### Task 11: Módulo de cuentas

**Files:**
- Create: `contratos/src/cuentas.ts` · Modify: `contratos/src/index.ts`
- Create: `backend/src/modulos/cuentas/cuentas.repositorio.ts`, `cuentas.servicio.ts`, `cuentas.esquemas.ts`, `cuentas.controlador.ts`, `cuentas.rutas.ts`, `index.ts`
- Modify: `backend/src/contenedor.ts`, `backend/src/app.ts`
- Test: `backend/test/modulos/cuentas/cuentas.api.test.ts`

**Interfaces:**
- Consumes: las mismas piezas que la Tarea 10 (`ControladorCrud`, `crearRutasCrud`, `ServicioAuditado`, `RepositorioDelUsuario`, `esquemaConsultaListado`, `mapearPagina`).
- Produces:
  - contratos: `CuentaDto { id; broker; numeroComitente: string | null; alias: string | null; creadoEn: string; actualizadoEn: string }`, `CrearCuentaEntrada { broker: string; numeroComitente?: string; alias?: string }`, `EditarCuentaEntrada { broker?: string; numeroComitente?: string | null; alias?: string | null }`
  - `interface ModuloCuentas { servicio: CuentasServicio; rutas: Router }` · `crearModuloCuentas(bd, auditoria)`
  - `Contenedor` suma `cuentas: ModuloCuentas`

- [ ] **Step 1: Agregar los contratos**

`contratos/src/cuentas.ts`:
```ts
export interface CuentaDto {
  id: string;
  broker: string;
  numeroComitente: string | null;
  alias: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearCuentaEntrada {
  broker: string;
  numeroComitente?: string;
  alias?: string;
}

export interface EditarCuentaEntrada {
  broker?: string;
  numeroComitente?: string | null;
  alias?: string | null;
}
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./cuentas";
```

- [ ] **Step 2: Escribir el test de API que falla**

`backend/test/modulos/cuentas/cuentas.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CuentaDto, Pagina } from "@cartera/contratos";
import { crearAppPrueba, registrarUsuario, type AppPrueba, type UsuarioLogueado } from "../../utilidades/app-prueba";

describe("API de cuentas", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  const auth = (usuario: UsuarioLogueado) => ({ Authorization: `Bearer ${usuario.token}` });

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("crea, lista ordenado por bróker, edita y borra", async () => {
    const bull = await request(prueba.app)
      .post("/api/cuentas")
      .set(auth(ana))
      .send({ broker: "Bull Market", numeroComitente: "1234", alias: "Principal" });
    expect(bull.status).toBe(201);
    expect(bull.body).toMatchObject({ broker: "Bull Market", numeroComitente: "1234", alias: "Principal" });
    await request(prueba.app).post("/api/cuentas").set(auth(ana)).send({ broker: "Balanz" }).expect(201);

    const lista = await request(prueba.app).get("/api/cuentas").set(auth(ana)).expect(200);
    expect((lista.body as Pagina<CuentaDto>).items.map((c) => c.broker)).toEqual(["Balanz", "Bull Market"]);

    const editada = await request(prueba.app)
      .patch(`/api/cuentas/${bull.body.id}`)
      .set(auth(ana))
      .send({ alias: null });
    expect(editada.body.alias).toBeNull();

    await request(prueba.app).delete(`/api/cuentas/${bull.body.id}`).set(auth(ana)).expect(204);
    await request(prueba.app).get(`/api/cuentas/${bull.body.id}`).set(auth(ana)).expect(404);
  });

  it("exige el bróker", async () => {
    const respuesta = await request(prueba.app).post("/api/cuentas").set(auth(ana)).send({ broker: " " });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0]).toEqual({
      campo: "broker",
      mensaje: "Poné el nombre del bróker. Ejemplo: Bull Market.",
    });
  });

  it("aislamiento entre usuarios", async () => {
    const deAna = await request(prueba.app).post("/api/cuentas").set(auth(ana)).send({ broker: "IOL" }).expect(201);
    const ruta = `/api/cuentas/${deAna.body.id}`;
    expect((await request(prueba.app).get(ruta).set(auth(beto))).status).toBe(404);
    expect((await request(prueba.app).patch(ruta).set(auth(beto)).send({ broker: "X" })).status).toBe(404);
    expect((await request(prueba.app).delete(ruta).set(auth(beto))).status).toBe(404);
    const deBeto = await request(prueba.app).get("/api/cuentas").set(auth(beto)).expect(200);
    expect(deBeto.body.items).toEqual([]);
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/cuentas`
Expected: FAIL — `/api/cuentas` no existe.

- [ ] **Step 4: Implementar el módulo**

`backend/src/modulos/cuentas/cuentas.repositorio.ts`:
```ts
import type { Cuenta, Prisma } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { RepositorioDelUsuario } from "../../compartido/repositorios/repositorio-del-usuario";

export type NuevaCuenta = Omit<Prisma.CuentaUncheckedCreateInput, "usuarioId">;
export type EdicionCuenta = Pick<Prisma.CuentaUncheckedUpdateInput, "broker" | "numeroComitente" | "alias">;

export class CuentasRepositorio extends RepositorioDelUsuario<
  Cuenta,
  NuevaCuenta,
  Prisma.CuentaUncheckedCreateInput,
  EdicionCuenta
> {
  protected readonly entidad = "la cuenta";
  protected readonly camposOrdenables = ["broker", "alias", "creadoEn"] as const;
  protected readonly ordenPorDefecto = "broker";

  protected delegado(bd: ClienteBD) {
    return bd.cuenta;
  }

  protected conDueno(usuarioId: string, datos: NuevaCuenta) {
    return { ...datos, usuarioId };
  }
}
```

`backend/src/modulos/cuentas/cuentas.esquemas.ts`:
```ts
import { z } from "zod";
import type { CrearCuentaEntrada, EditarCuentaEntrada } from "@cartera/contratos";
import { esquemaConsultaListado } from "../../compartido/paginacion";

const LARGO_MAXIMO = 80;

const broker = z
  .string({ message: "Poné el nombre del bróker. Ejemplo: Bull Market." })
  .trim()
  .min(1, "Poné el nombre del bróker. Ejemplo: Bull Market.")
  .max(LARGO_MAXIMO, `Puede tener hasta ${LARGO_MAXIMO} caracteres.`);
const textoOpcional = z.string().trim().max(LARGO_MAXIMO, `Puede tener hasta ${LARGO_MAXIMO} caracteres.`);

export const esquemaCrearCuenta = z.object({
  broker,
  numeroComitente: textoOpcional.optional(),
  alias: textoOpcional.optional(),
}) satisfies z.ZodType<CrearCuentaEntrada>;

export const esquemaEditarCuenta = z
  .object({
    broker: broker.optional(),
    numeroComitente: textoOpcional.nullable().optional(),
    alias: textoOpcional.nullable().optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "No mandaste ningún cambio.",
  }) satisfies z.ZodType<EditarCuentaEntrada>;

export const esquemaConsultaCuentas = esquemaConsultaListado;
export type ConsultaCuentas = z.output<typeof esquemaConsultaCuentas>;
```

`backend/src/modulos/cuentas/cuentas.servicio.ts`:
```ts
import type { CrearCuentaEntrada, CuentaDto, EditarCuentaEntrada, Pagina } from "@cartera/contratos";
import type { Cuenta, Prisma, PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { ServicioAuditado } from "../../compartido/auditoria/servicio-auditado";
import type { ServicioCrud } from "../../compartido/http/controlador-crud";
import { mapearPagina } from "../../compartido/paginacion";
import type { ConsultaCuentas } from "./cuentas.esquemas";
import type { CuentasRepositorio, EdicionCuenta, NuevaCuenta } from "./cuentas.repositorio";

function aCuentaDto(cuenta: Cuenta): CuentaDto {
  return {
    id: cuenta.id,
    broker: cuenta.broker,
    numeroComitente: cuenta.numeroComitente,
    alias: cuenta.alias,
    creadoEn: cuenta.creadoEn.toISOString(),
    actualizadoEn: cuenta.actualizadoEn.toISOString(),
  };
}

export class CuentasServicio
  extends ServicioAuditado<Cuenta, NuevaCuenta, Prisma.CuentaUncheckedCreateInput, EdicionCuenta>
  implements ServicioCrud<CuentaDto, CrearCuentaEntrada, EditarCuentaEntrada, ConsultaCuentas>
{
  protected readonly entidadAuditada = "Cuenta";

  constructor(
    bd: PrismaClient,
    private readonly cuentas: CuentasRepositorio,
    auditoria: AuditoriaRepositorio,
  ) {
    super(bd, cuentas, auditoria);
  }

  async listar(usuarioId: string, consulta: ConsultaCuentas): Promise<Pagina<CuentaDto>> {
    return mapearPagina(await this.cuentas.listar(usuarioId, consulta), aCuentaDto);
  }

  async obtener(usuarioId: string, id: string): Promise<CuentaDto> {
    return aCuentaDto(await this.cuentas.obtener(usuarioId, id));
  }

  async crear(usuarioId: string, entrada: CrearCuentaEntrada): Promise<CuentaDto> {
    const creada = await this.crearAuditado(usuarioId, {
      broker: entrada.broker,
      numeroComitente: entrada.numeroComitente ?? null,
      alias: entrada.alias ?? null,
    });
    return aCuentaDto(creada);
  }

  async editar(usuarioId: string, id: string, entrada: EditarCuentaEntrada): Promise<CuentaDto> {
    return aCuentaDto(await this.editarAuditado(usuarioId, id, entrada));
  }

  async borrar(usuarioId: string, id: string): Promise<void> {
    await this.borrarAuditado(usuarioId, id);
  }
}
```

`backend/src/modulos/cuentas/cuentas.controlador.ts`:
```ts
import type { CrearCuentaEntrada, CuentaDto, EditarCuentaEntrada } from "@cartera/contratos";
import { ControladorCrud } from "../../compartido/http/controlador-crud";
import {
  esquemaConsultaCuentas,
  esquemaCrearCuenta,
  esquemaEditarCuenta,
  type ConsultaCuentas,
} from "./cuentas.esquemas";
import type { CuentasServicio } from "./cuentas.servicio";

export class CuentasControlador extends ControladorCrud<
  CuentaDto,
  CrearCuentaEntrada,
  EditarCuentaEntrada,
  ConsultaCuentas
> {
  constructor(servicio: CuentasServicio) {
    super(servicio, {
      crear: esquemaCrearCuenta,
      editar: esquemaEditarCuenta,
      consulta: esquemaConsultaCuentas,
    });
  }
}
```

`backend/src/modulos/cuentas/cuentas.rutas.ts`:
```ts
import type { Router } from "express";
import { crearRutasCrud } from "../../compartido/http/rutas-crud";
import type { CuentasControlador } from "./cuentas.controlador";

export function crearRutasCuentas(controlador: CuentasControlador): Router {
  return crearRutasCrud(controlador);
}
```

`backend/src/modulos/cuentas/index.ts`:
```ts
import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { CuentasControlador } from "./cuentas.controlador";
import { CuentasRepositorio } from "./cuentas.repositorio";
import { crearRutasCuentas } from "./cuentas.rutas";
import { CuentasServicio } from "./cuentas.servicio";

export type { CuentasServicio } from "./cuentas.servicio";

export interface ModuloCuentas {
  servicio: CuentasServicio;
  rutas: Router;
}

export function crearModuloCuentas(bd: PrismaClient, auditoria: AuditoriaRepositorio): ModuloCuentas {
  const servicio = new CuentasServicio(bd, new CuentasRepositorio(bd), auditoria);
  return { servicio, rutas: crearRutasCuentas(new CuentasControlador(servicio)) };
}
```

- [ ] **Step 5: Conectar el módulo**

En `backend/src/contenedor.ts`:
- Agregar el import: `import { crearModuloCuentas, type ModuloCuentas } from "./modulos/cuentas";`
- En la interfaz `Contenedor`, agregar debajo de `carteras: ModuloCarteras;`: `cuentas: ModuloCuentas;`
- En el objeto devuelto, agregar debajo de `carteras: crearModuloCarteras(bd, auditoria),`: `cuentas: crearModuloCuentas(bd, auditoria),`

En `backend/src/app.ts`, debajo de `privadas.use("/carteras", contenedor.carteras.rutas);` agregar:
```ts
  privadas.use("/cuentas", contenedor.cuentas.rutas);
```

- [ ] **Step 6: Correr tests, tipos, lint y formato**

Run: `npm test && npm run tipos && npm run lint && npm run formato`
Expected: todo PASS.

- [ ] **Step 7: Mostrar el estado**

Run: `git status --short`

---

### Task 12: Seed del administrador, servidor y verificación de punta a punta

**Files:**
- Create: `backend/src/semillas/administrador.ts`, `backend/prisma/seed.ts`, `backend/src/server.ts`
- Modify: `backend/.env.example` (variables del administrador)
- Test: `backend/test/semillas/administrador.test.ts`

**Interfaces:**
- Consumes: `AutenticacionServicio.crearUsuario` (T8), `LARGO_MINIMO_PASSWORD` (T7), `ErrorConflicto` (T3), `crearContenedor` (T9), `crearApp` (T9), `cargarEntorno` (T2).
- Produces: `type ResultadoSemilla = "CREADO" | "YA_EXISTIA"` · `sembrarAdministrador(autenticacion, fuente): Promise<ResultadoSemilla>`; scripts funcionando `npm run db:seed` y `npm run dev`.

- [ ] **Step 1: Escribir el test que falla**

`backend/test/semillas/administrador.test.ts`:
```ts
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

  it("explica qué falta o está mal", async () => {
    await expect(sembrarAdministrador(contenedor.autenticacion.servicio, {})).rejects.toThrow(/ADMIN_EMAIL/);
    await expect(
      sembrarAdministrador(contenedor.autenticacion.servicio, { ADMIN_EMAIL: "a@b.com", ADMIN_PASSWORD: "corta" }),
    ).rejects.toThrow(/al menos 10/);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/semillas`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar la semilla**

`backend/src/semillas/administrador.ts`:
```ts
import { z } from "zod";
import { ErrorConflicto } from "../compartido/errores";
import { LARGO_MINIMO_PASSWORD, type AutenticacionServicio } from "../modulos/autenticacion";

const esquemaDatosAdministrador = z.object({
  ADMIN_EMAIL: z
    .string({ message: "Falta ADMIN_EMAIL en el .env." })
    .trim()
    .toLowerCase()
    .pipe(z.email("ADMIN_EMAIL no es un email válido.")),
  ADMIN_PASSWORD: z
    .string({ message: "Falta ADMIN_PASSWORD en el .env." })
    .min(LARGO_MINIMO_PASSWORD, `ADMIN_PASSWORD necesita al menos ${LARGO_MINIMO_PASSWORD} caracteres.`),
  ADMIN_NOMBRE: z.string().trim().min(1).default("Administrador"),
});

export type ResultadoSemilla = "CREADO" | "YA_EXISTIA";

export async function sembrarAdministrador(
  autenticacion: AutenticacionServicio,
  fuente: Record<string, string | undefined>,
): Promise<ResultadoSemilla> {
  const resultado = esquemaDatosAdministrador.safeParse(fuente);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((p) => `${p.path.join(".")}: ${p.message}`).join("\n  ");
    throw new Error(`No se puede crear el administrador:\n  ${problemas}`);
  }
  const datos = resultado.data;
  try {
    await autenticacion.crearUsuario({
      nombre: datos.ADMIN_NOMBRE,
      email: datos.ADMIN_EMAIL,
      password: datos.ADMIN_PASSWORD,
      rol: "ADMIN",
    });
    return "CREADO";
  } catch (error) {
    if (error instanceof ErrorConflicto) return "YA_EXISTIA";
    throw error;
  }
}
```

- [ ] **Step 4: Crear los puntos de entrada**

`backend/prisma/seed.ts`:
```ts
import "dotenv/config";
import { cargarEntorno } from "../src/config/entorno";
import { crearContenedor } from "../src/contenedor";
import { sembrarAdministrador } from "../src/semillas/administrador";

const contenedor = crearContenedor(cargarEntorno());
try {
  const resultado = await sembrarAdministrador(contenedor.autenticacion.servicio, process.env);
  console.log(
    resultado === "CREADO"
      ? `Administrador ${process.env["ADMIN_EMAIL"]?.trim().toLowerCase()} creado con su cartera "Principal".`
      : "El administrador ya existía. No se cambió nada.",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await contenedor.bd.$disconnect();
}
```

`backend/src/server.ts`:
```ts
import "dotenv/config";
import { crearApp } from "./app";
import { cargarEntorno } from "./config/entorno";
import { crearContenedor } from "./contenedor";

function arrancar(): void {
  const entorno = cargarEntorno();
  const contenedor = crearContenedor(entorno);
  const servidor = crearApp(contenedor).listen(entorno.PORT, () => {
    console.log(`Backend escuchando en http://localhost:${entorno.PORT}`);
  });

  const apagar = async (senal: string) => {
    console.log(`Recibí ${senal}. Cerrando…`);
    servidor.close();
    await contenedor.bd.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void apagar("SIGINT"));
  process.on("SIGTERM", () => void apagar("SIGTERM"));
}

try {
  arrancar();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
```

Agregar al final de `backend/.env.example`:
```bash

# Administrador que crea `npm run db:seed` (solo se usan en el seed)
ADMIN_EMAIL=admin@cartera.local
ADMIN_PASSWORD=cambiar-esta-clave
ADMIN_NOMBRE=Administrador
```

Y agregar las mismas tres líneas al `backend/.env` local (creado en la Tarea 4), con una contraseña de al menos 10 caracteres.

- [ ] **Step 5: Correr tests, tipos, lint y formato**

Run: `npm test && npm run tipos && npm run lint && npm run formato && npm run formato:verificar`
Expected: todo PASS.

- [ ] **Step 6: Verificar de punta a punta con el servidor real**

```bash
npm run db:migrate
npm run db:seed
npm run db:seed
```
Expected: la primera corrida imprime `Administrador admin@cartera.local creado con su cartera "Principal".`; la segunda, `El administrador ya existía. No se cambió nada.`

Arrancar el backend en segundo plano y probarlo:
```bash
(cd backend && npx tsx src/server.ts > /tmp/cartera-backend.log 2>&1 &) ; sleep 3
curl -s http://localhost:3000/api/salud
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@cartera.local","password":"cambiar-esta-clave"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).tokenAcceso')
curl -s http://localhost:3000/api/carteras -H "Authorization: Bearer $TOKEN"
pkill -f "tsx src/server.ts"
```
(Usar en el login la `ADMIN_PASSWORD` que se puso en `backend/.env`.)
Expected: `{"estado":"ok"}`; el listado de carteras trae un ítem `"nombre":"Principal"` con `"esPrincipal":true`; el proceso se detiene.

- [ ] **Step 7: Mostrar el estado final**

Run: `git status --short`
Expected: todos los archivos del plan aparecen sin agregar. No aparecen `.env`, `*.db` ni `src/generado/`.
