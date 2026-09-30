# Plan 2 — Motor e instrumentos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el backend responda "¿cuánto tengo y cuánto gané?": catálogo de instrumentos desde data912, precios y dólar en vivo con respaldo, operaciones (tenencia inicial, compra, venta, cobros, efectivo, comisiones) validadas contra toda la historia, un motor de cálculo puro (tenencia, PPP/FIFO, realizado, no realizado, valuación ARS/USD, ponderaciones, simulación) y los endpoints de resumen y ficha de activo. Además, cerrar el manejo de errores para que el usuario nunca vea un mensaje técnico.

**Architecture:** Sobre la base del plan 1. Los proveedores externos (`backend/src/proveedores/`) heredan de `ProveedorHttpBase` (timeout, reintento, caché, respaldo con el último dato). El motor (`backend/src/motor/`) es código sin I/O: un `ManejadorOperacion` por tipo registrado en `RegistroManejadores`, `EstrategiaCosto` intercambiable (PPP/FIFO) y `Valuador` por familia de instrumento. Los módulos nuevos (`instrumentos`, `mercado`, `operaciones`, `resumen`) orquestan: leen de la base y de los proveedores, llaman al motor y arman DTOs listos para mostrar, incluidas las frases en castellano.

**Tech Stack:** lo del plan 1 + `decimal.js` (cálculos del motor). Fuentes externas: data912 (precios BYMA en vivo e histórico), dolarapi (dólar actual), argentinadatos (dólar histórico y feriados).

**Spec:** `docs/superpowers/specs/2026-09-28-cartera-inversiones-design.md` (secciones 2, 3.1, 4.4–4.7, 5.2, 5.3, 5.5 —instrumentos, cotizaciones, operaciones, resumen, activos—, 5.7).

**Serie de planes de la etapa 1:** este es el plan 2 de 4. Plan 1 (fundaciones) ya está implementado. Plan 3: integraciones (flujos y calendario, noticias, importación/exportación, glosario, tareas programadas, evolución). Plan 4: frontend.

**Asignado a otros planes (a propósito):** el rendimiento ajustado por aportes (TWR y XIRR, spec 5.2) va en el plan 3, porque necesita las fotos diarias (`SnapshotCartera`) que arman las tareas programadas; acá el rendimiento es el total sobre lo invertido. Los próximos cobros (spec 5.2, `cobros.ts`) también van en el plan 3, junto con el cronograma de pagos (`FlujoProgramado`).

## Global Constraints

- Todas las del plan 1 siguen vigentes: **no** `git add`/`commit`/`branch`/`push`/`init` (Luca maneja el git; cada tarea termina con `git status --short`); TypeScript `~6.0.3`; Prisma `7.10.0` exacto; `strict`, sin `any`, sin `!`, `import type` para tipos; nombres en castellano con sufijos fijos; reglas de capas de ESLint.
- **El usuario nunca ve un error técnico.** Ninguna respuesta de la API contiene texto de Prisma, SQLite, zod, fetch o de un proveedor externo, ni textos en inglés. Cada error llega como un mensaje corto en castellano llano (qué pasó y qué hacer) con un código de `CodigoError` y una `referencia` de pedido. El detalle técnico va a la consola del backend junto con esa referencia.
- Montos, cantidades, precios y tipos de cambio del motor: `Decimal` de `decimal.js` (vía `backend/src/compartido/decimal.ts`). Nunca `number` en cálculos; `number` solo al armar DTOs (`aNumero`).
- Tests sin red: los proveedores se prueban con las respuestas reales guardadas en `backend/test/fixtures/` y un `buscar` falso.
- El tiempo se inyecta (`ahora: () => Date`) en todo lo que depende de la hora: caché, horario de mercado, "hoy" para validar fechas.
- Fechas de operaciones: días `AAAA-MM-DD`, guardados como medianoche UTC de ese día.
- Desde otro módulo solo se importa su `index.ts`.
- Todos los comandos desde la raíz del repo salvo que se indique `cd backend`.

## Review Focus

1. **Operación en dólares con una fecha para la que no hay tipo de cambio histórico** (por ejemplo 2015): error en castellano que pide cargar el tipo de cambio a mano, nunca un 500. Test en la Tarea 11.
2. **data912 caído la primera vez que se abre el resumen** (sin caché): el resumen se arma igual, valuando al precio manual o al costo, con un aviso; nunca un 500. Test en la Tarea 12.
3. **Borrar una compra que deja a una venta posterior vendiendo más de lo que había**: se rechaza con un mensaje que nombra la venta y su fecha. Test en la Tarea 11.
4. **Un activo vendido por completo**: no aparece en las tenencias, pero su resultado realizado sí suma en las tarjetas. Test en la Tarea 12.
5. **Buscar "YM39D"** (el símbolo en dólares): encuentra la ON `YM39O`. Test en la Tarea 6.

---

## Estructura de archivos de este plan

```
contratos/src/
├── errores.ts                    (+ ERROR_BASE_DATOS, referencia)
├── instrumentos.ts               TipoInstrumento, InstrumentoDto, entradas
├── mercado.ts                    EstadoMercadoDto
├── operaciones.ts                TipoOperacion, entradas (unión discriminada), OperacionDto, SimulacionDto
└── resumen.ts                    ResumenDto, TenenciaDto, TarjetaDto, ActivoDto
backend/src/
├── compartido/
│   ├── decimal.ts · fechas.ts · formato.ts · esquemas.ts
│   ├── mensajes-validacion.ts    mensajes amigables para toda validación
│   └── http/ referencia-pedido.ts · requiere-rol.ts · manejador-errores.ts (reescrito)
├── proveedores/
│   ├── http/proveedor-http-base.ts
│   ├── cotizaciones/ proveedor-cotizaciones.ts · data912.proveedor.ts
│   └── dolar/ proveedor-dolar.ts · dolarapi.proveedor.ts · argentinadatos.proveedor.ts
├── motor/
│   ├── tipos.ts · importe.ts · tenencia.ts · totales.ts · ponderacion.ts · simulacion.ts
│   ├── costo/ estrategia-costo.ts · precio-promedio.ts · fifo.ts
│   ├── operaciones/ manejador-operacion.ts · manejadores.ts · registro-manejadores.ts · textos.ts
│   └── valuadores/ valuador.ts · por-cotizacion.ts · por-devengamiento.ts
└── modulos/
    ├── instrumentos/  catalogo.ts · textos.ts · instrumentos.repositorio.ts · precios-manuales.repositorio.ts · instrumentos.servicio.ts · instrumentos.esquemas.ts · instrumentos.controlador.ts · instrumentos.rutas.ts · index.ts
    ├── mercado/       horario-mercado.ts · mercado.servicio.ts · mercado.controlador.ts · mercado.rutas.ts · index.ts
    ├── operaciones/   operaciones.repositorio.ts · a-motor.ts · redaccion.ts · operaciones.esquemas.ts · operaciones.servicio.ts · operaciones.controlador.ts · operaciones.rutas.ts · index.ts
    └── resumen/       redaccion.ts · resumen.esquemas.ts · resumen.servicio.ts · resumen.controlador.ts · resumen.rutas.ts · index.ts
backend/test/
├── fixtures/                     respuestas reales de data912, dolarapi y argentinadatos (28/09/2026)
└── utilidades/ http-falso.ts · proveedores-prueba.ts · operaciones-motor.ts
```

---

### Task 1: Errores amigables en toda la API

**Files:**
- Modify: `contratos/src/errores.ts` (reemplazo completo)
- Modify: `backend/src/compartido/errores.ts` (reemplazo completo)
- Create: `backend/src/compartido/mensajes-validacion.ts`, `backend/src/compartido/http/referencia-pedido.ts`
- Modify: `backend/src/compartido/validacion.ts` (reemplazo completo), `backend/src/compartido/http/manejador-errores.ts` (reemplazo completo), `backend/src/tipos/express.d.ts` (reemplazo completo), `backend/src/app.ts`
- Test: `backend/test/compartido/mensajes-validacion.test.ts`, `backend/test/compartido/manejador-errores-clasificacion.test.ts`, `backend/test/app.test.ts`

**Interfaces:**
- Consumes: `ErrorApp` y subclases, `crearManejadorErrores` (plan 1).
- Produces:
  - `CodigoError` suma `"ERROR_BASE_DATOS"`; `RespuestaError.error.referencia?: string`.
  - `ErrorApp` acepta un quinto parámetro `causa?: unknown`; `ErrorProveedorExterno(mensaje, causa?)`.
  - `mensajeAmigable(problema): string` (mapa de errores global de zod).
  - `referenciaPedido: RequestHandler` (pone `req.referencia` y el encabezado `X-Referencia`).
  - `interface RegistroDeError { referencia: string | undefined; metodo: string; ruta: string; error: unknown }`, `type RegistradorDeErrores`, `registrarEnConsola`, `crearManejadorErrores(registrar?: RegistradorDeErrores)`.

- [ ] **Step 1: Escribir los tests que fallan**

`backend/test/compartido/mensajes-validacion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validar } from "../../src/compartido/validacion";
import type { ErrorValidacion } from "../../src/compartido/errores";

const esquema = z
  .object({
    numero: z.number().int().min(1).max(10),
    entero: z.number().int(),
    texto: z.string().min(3).max(5),
    opcion: z.enum(["A", "B"]),
    email: z.email(),
    siNo: z.boolean(),
    obligatorio: z.string(),
  })
  .strict();

function mensajesDe(datos: unknown): Record<string, string> {
  try {
    validar(esquema, datos);
    return {};
  } catch (error) {
    return Object.fromEntries(
      ((error as ErrorValidacion).detalles ?? []).map((d) => [d.campo || "(general)", d.mensaje]),
    );
  }
}

const TEXTO_TECNICO = /invalid|expected|received|input|entrada inválida|se esperaba|nan|undefined/i;

describe("mensajes de validación", () => {
  it("usa frases llanas en castellano para cada tipo de problema", () => {
    const mensajes = mensajesDe({
      numero: "abc",
      entero: 1.5,
      texto: "x",
      opcion: "Z",
      email: "no",
      siNo: "si",
      extra: 1,
    });
    expect(mensajes).toEqual({
      numero: "Tiene que ser un número.",
      entero: "Tiene que ser un número entero.",
      texto: "Tiene que tener al menos 3 caracteres.",
      opcion: "Elegí una de las opciones válidas.",
      email: "El email no es válido. Ejemplo: nombre@gmail.com",
      siNo: "Tiene que ser sí o no.",
      obligatorio: "Este dato es obligatorio.",
      "(general)": "Hay datos que no se esperaban: extra.",
    });
  });

  it("explica los límites de números y textos", () => {
    const mensajes = mensajesDe({ numero: 0, entero: 1, texto: "abcdefg", opcion: "A", email: "a@b.com", siNo: true, obligatorio: "x" });
    expect(mensajes).toEqual({
      numero: "Tiene que ser mayor o igual a 1.",
      texto: "Puede tener hasta 5 caracteres.",
    });
    expect(mensajesDe({ numero: 11, entero: 1, texto: "abc", opcion: "A", email: "a@b.com", siNo: true, obligatorio: "x" })).toEqual({
      numero: "Tiene que ser menor o igual a 10.",
    });
  });

  it("ningún mensaje por defecto tiene jerga técnica ni inglés", () => {
    const mensajes = mensajesDe({ numero: Number.NaN, entero: "x", texto: 3, opcion: null, email: 5, siNo: {}, extra: true });
    for (const mensaje of Object.values(mensajes)) expect(mensaje).not.toMatch(TEXTO_TECNICO);
  });

  it("los mensajes propios de cada esquema siguen teniendo prioridad", () => {
    const propio = z.object({ nombre: z.string({ message: "Poné tu nombre." }) });
    try {
      validar(propio, {});
    } catch (error) {
      expect((error as ErrorValidacion).detalles).toEqual([{ campo: "nombre", mensaje: "Poné tu nombre." }]);
    }
  });
});
```

`backend/test/compartido/manejador-errores-clasificacion.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { Prisma } from "../../src/generado/prisma/client";
import {
  crearManejadorErrores,
  type RegistroDeError,
} from "../../src/compartido/http/manejador-errores";
import { referenciaPedido } from "../../src/compartido/http/referencia-pedido";
import { ErrorProveedorExterno, ErrorValidacion } from "../../src/compartido/errores";

const VERSION = "7.10.0";
const TEXTO_TECNICO = /prisma|sqlite|invocation|constraint|P20\d\d|ECONN|stack|Error:/i;

function appQueLanza(error: unknown) {
  const registros: RegistroDeError[] = [];
  const app = express();
  app.use(referenciaPedido);
  app.get("/x", (() => {
    throw error;
  }) as RequestHandler);
  app.use(crearManejadorErrores((registro) => registros.push(registro)));
  return { app, registros };
}

function conocido(codigo: string) {
  return new Prisma.PrismaClientKnownRequestError(
    "\nInvalid `bd.cartera.create()` invocation in /home/x/archivo.ts:1:1\nForeign key constraint violated",
    { code: codigo, clientVersion: VERSION },
  );
}

describe("clasificación de errores", () => {
  const casos: [string, unknown, number, string, string][] = [
    ["unicidad", conocido("P2002"), 409, "CONFLICTO", "Ya existe un registro con esos datos."],
    ["referencia inválida", conocido("P2003"), 409, "CONFLICTO", "No se puede guardar porque depende de un dato que no existe o que está en uso."],
    ["registro inexistente", conocido("P2025"), 404, "NO_ENCONTRADO", "No se encontró lo que buscabas. Puede que se haya borrado."],
    ["otro error de la base", conocido("P2034"), 500, "ERROR_BASE_DATOS", "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos."],
    ["base inaccesible", new Prisma.PrismaClientInitializationError("Can't reach database server at `x`", VERSION), 503, "ERROR_BASE_DATOS", "No hay conexión con la base de datos. Probá de nuevo en unos minutos."],
    ["error desconocido de la base", new Prisma.PrismaClientUnknownRequestError("SQLITE_BUSY: database is locked", { clientVersion: VERSION }), 500, "ERROR_BASE_DATOS", "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos."],
    ["consulta mal armada", new Prisma.PrismaClientValidationError("Argument `where` is missing.", { clientVersion: VERSION }), 500, "ERROR_BASE_DATOS", "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos."],
    ["servicio externo", new ErrorProveedorExterno("No pudimos actualizar los precios.", new Error("ECONNRESET")), 502, "PROVEEDOR_EXTERNO", "No pudimos actualizar los precios."],
    ["error de código", new TypeError("Cannot read properties of undefined (reading 'x')"), 500, "ERROR_INTERNO", "Ocurrió un error inesperado. Probá de nuevo en unos segundos."],
  ];

  it.each(casos)("%s: mensaje llano, sin detalle técnico y con referencia", async (_nombre, error, status, codigo, mensaje) => {
    const { app, registros } = appQueLanza(error);
    const respuesta = await request(app).get("/x");
    expect(respuesta.status).toBe(status);
    expect(respuesta.body.error.codigo).toBe(codigo);
    expect(respuesta.body.error.mensaje).toBe(mensaje);
    expect(JSON.stringify(respuesta.body)).not.toMatch(TEXTO_TECNICO);
    expect(respuesta.body.error.referencia).toMatch(/^[0-9A-F]{8}$/);
    expect(respuesta.headers["x-referencia"]).toBe(respuesta.body.error.referencia);
  });

  it("registra en consola el error técnico completo con la referencia del pedido", async () => {
    const causa = new Error("ECONNRESET");
    const { app, registros } = appQueLanza(new ErrorProveedorExterno("No pudimos actualizar los precios.", causa));
    const respuesta = await request(app).get("/x");
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ referencia: respuesta.body.error.referencia, metodo: "GET", ruta: "/x" });
    expect(registros[0]?.error).toBe(causa);
  });

  it("los errores esperables del usuario (validación) no se registran como fallas", async () => {
    const { app, registros } = appQueLanza(new ErrorValidacion("Revisá los datos."));
    await request(app).get("/x");
    expect(registros).toHaveLength(0);
  });

  it("el registrador por defecto escribe en la consola con la referencia", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.use(referenciaPedido);
    app.get("/x", (() => {
      throw new Error("detalle interno");
    }) as RequestHandler);
    app.use(crearManejadorErrores());
    const respuesta = await request(app).get("/x");
    expect(espia).toHaveBeenCalledOnce();
    expect(String(espia.mock.calls[0]?.[0])).toContain(respuesta.body.error.referencia);
    espia.mockRestore();
  });
});
```

En `backend/test/app.test.ts`, agregar este caso al final del `describe("app", …)` (antes de su `});` de cierre):
```ts
  it("cada respuesta lleva un número de referencia para rastrear errores", async () => {
    const respuesta = await request(prueba.app).get("/api/salud");
    expect(respuesta.headers["x-referencia"]).toMatch(/^[0-9A-F]{8}$/);
  });
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm test -w @cartera/backend -- test/compartido test/app.test.ts`
Expected: FAIL — `mensajes-validacion` devuelve los textos por defecto de zod; no existe `referencia-pedido`.

- [ ] **Step 3: Ampliar el contrato de errores**

`contratos/src/errores.ts`:
```ts
/** Códigos que puede devolver la API. El frontend decide qué hacer según el código. */
export type CodigoError =
  | "VALIDACION"
  | "JSON_INVALIDO"
  | "DEMASIADO_GRANDE"
  | "NO_AUTORIZADO"
  /** El refresh ya fue rotado por otro pedido (otra pestaña): reintentar una vez con la cookie nueva. */
  | "REFRESH_YA_ROTADO"
  | "PROHIBIDO"
  | "NO_ENCONTRADO"
  | "CONFLICTO"
  | "DEMASIADOS_INTENTOS"
  | "PROVEEDOR_EXTERNO"
  | "ERROR_BASE_DATOS"
  | "ERROR_INTERNO";

export interface DetalleError {
  campo: string;
  mensaje: string;
}

export interface RespuestaError {
  error: {
    codigo: CodigoError;
    /** Siempre en castellano llano, apto para mostrar al usuario. */
    mensaje: string;
    detalles?: DetalleError[];
    /** Código corto del pedido: el mismo que queda en la consola junto al detalle técnico. */
    referencia?: string;
  };
}
```

- [ ] **Step 4: Permitir adjuntar la causa técnica a un `ErrorApp`**

`backend/src/compartido/errores.ts`:
```ts
import type { CodigoError, DetalleError } from "@cartera/contratos";

export abstract class ErrorApp extends Error {
  protected constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly status: number,
    readonly detalles?: DetalleError[],
    /** Error técnico original: va a la consola, nunca a la respuesta. */
    readonly causa?: unknown,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErrorValidacion extends ErrorApp {
  constructor(
    mensaje = "Hay datos inválidos. Revisá los campos marcados.",
    detalles?: DetalleError[],
  ) {
    super("VALIDACION", mensaje, 400, detalles);
  }
}

export class ErrorNoAutorizado extends ErrorApp {
  constructor(mensaje = "Tenés que iniciar sesión.") {
    super("NO_AUTORIZADO", mensaje, 401);
  }
}

/**
 * El refresh que llegó ya fue rotado hace instantes por otro pedido (otra pestaña).
 * No es un robo: el cliente tiene que reintentar una vez con la cookie nueva.
 */
export class ErrorRefreshYaRotado extends ErrorApp {
  constructor() {
    super("REFRESH_YA_ROTADO", "Tu sesión se renovó en otra pestaña. Reintentá.", 401);
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
  constructor(mensaje: string, causa?: unknown) {
    super("PROVEEDOR_EXTERNO", mensaje, 502, undefined, causa);
  }
}
```

- [ ] **Step 5: Mensajes amigables para toda validación**

`backend/src/compartido/mensajes-validacion.ts`:
```ts
import type { z } from "zod";

const POR_TIPO_ESPERADO: Record<string, string> = {
  number: "Tiene que ser un número.",
  int: "Tiene que ser un número entero.",
  string: "Tiene que ser un texto.",
  boolean: "Tiene que ser sí o no.",
  date: "Tiene que ser una fecha válida.",
  array: "Tiene que ser una lista.",
  object: "Faltan datos o tienen un formato incorrecto.",
};

const POR_FORMATO: Record<string, string> = {
  email: "El email no es válido. Ejemplo: nombre@gmail.com",
  url: "La dirección web no es válida.",
  regex: "Tiene un formato incorrecto.",
};

/**
 * Mapa de errores global: reemplaza los textos por defecto de zod (técnicos, a veces en inglés)
 * por frases llanas. Los mensajes escritos en cada esquema tienen prioridad sobre este.
 */
export function mensajeAmigable(problema: z.core.$ZodRawIssue): string {
  switch (problema.code) {
    case "invalid_type":
      if (problema.input === undefined || problema.input === null) {
        return "Este dato es obligatorio.";
      }
      return POR_TIPO_ESPERADO[problema.expected] ?? "Tiene un formato incorrecto.";
    case "too_small":
      if (problema.origin === "string") {
        return Number(problema.minimum) <= 1
          ? "Este dato es obligatorio."
          : `Tiene que tener al menos ${problema.minimum} caracteres.`;
      }
      if (problema.origin === "number") {
        return `Tiene que ser ${problema.inclusive ? "mayor o igual a" : "mayor a"} ${problema.minimum}.`;
      }
      return `Tiene que tener al menos ${problema.minimum} elementos.`;
    case "too_big":
      if (problema.origin === "string") return `Puede tener hasta ${problema.maximum} caracteres.`;
      if (problema.origin === "number") {
        return `Tiene que ser ${problema.inclusive ? "menor o igual a" : "menor a"} ${problema.maximum}.`;
      }
      return `Puede tener hasta ${problema.maximum} elementos.`;
    case "invalid_format":
      return POR_FORMATO[problema.format] ?? "Tiene un formato incorrecto.";
    case "invalid_value":
      return "Elegí una de las opciones válidas.";
    case "unrecognized_keys":
      return `Hay datos que no se esperaban: ${problema.keys.join(", ")}.`;
    default:
      return "Este dato no es válido.";
  }
}
```

`backend/src/compartido/validacion.ts`:
```ts
import { z } from "zod";
import { ErrorValidacion } from "./errores";
import { mensajeAmigable } from "./mensajes-validacion";

z.config({ customError: mensajeAmigable });

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

- [ ] **Step 6: Referencia por pedido**

`backend/src/compartido/http/referencia-pedido.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const LARGO_REFERENCIA = 8;

/**
 * Código corto por pedido. Viaja en la respuesta (y en el encabezado X-Referencia) y queda en
 * la consola junto al error técnico: el usuario lo puede dictar sin ver ningún detalle interno.
 */
export const referenciaPedido: RequestHandler = (req, res, next) => {
  req.referencia = randomUUID().replaceAll("-", "").slice(0, LARGO_REFERENCIA).toUpperCase();
  res.setHeader("X-Referencia", req.referencia);
  next();
};
```

`backend/src/tipos/express.d.ts`:
```ts
import type { UsuarioAutenticado } from "../compartido/http/usuario-de";

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
      referencia?: string;
    }
  }
}

export {};
```

- [ ] **Step 7: Reescribir el manejador de errores con clasificación**

`backend/src/compartido/http/manejador-errores.ts`:
```ts
import type { ErrorRequestHandler } from "express";
import type { CodigoError, DetalleError, RespuestaError } from "@cartera/contratos";
import { Prisma } from "../../generado/prisma/client";
import { ErrorApp } from "../errores";

export interface RegistroDeError {
  referencia: string | undefined;
  metodo: string;
  ruta: string;
  error: unknown;
}

export type RegistradorDeErrores = (registro: RegistroDeError) => void;

export const registrarEnConsola: RegistradorDeErrores = (registro) => {
  console.error(
    `[error ${registro.referencia ?? "sin-referencia"}] ${registro.metodo} ${registro.ruta}`,
    registro.error,
  );
};

interface Clasificacion {
  status: number;
  codigo: CodigoError;
  mensaje: string;
  detalles?: DetalleError[];
  /** Solo las fallas del sistema van a la consola; los errores esperables del usuario no. */
  registrar: boolean;
  /** Lo que se registra: la causa técnica si existe. */
  tecnico: unknown;
}

const MENSAJE_BASE_DATOS = "No pudimos guardar o leer los datos. Probá de nuevo en unos segundos.";
const MENSAJE_SIN_CONEXION = "No hay conexión con la base de datos. Probá de nuevo en unos minutos.";
const MENSAJE_INESPERADO = "Ocurrió un error inesperado. Probá de nuevo en unos segundos.";

const ERRORES_PRISMA: Record<string, { status: number; codigo: CodigoError; mensaje: string }> = {
  P2002: { status: 409, codigo: "CONFLICTO", mensaje: "Ya existe un registro con esos datos." },
  P2003: {
    status: 409,
    codigo: "CONFLICTO",
    mensaje: "No se puede guardar porque depende de un dato que no existe o que está en uso.",
  },
  P2025: {
    status: 404,
    codigo: "NO_ENCONTRADO",
    mensaje: "No se encontró lo que buscabas. Puede que se haya borrado.",
  },
};

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

function errorDeBase(status: number, mensaje: string, error: unknown): Clasificacion {
  return { status, codigo: "ERROR_BASE_DATOS", mensaje, registrar: true, tecnico: error };
}

function clasificar(error: unknown): Clasificacion {
  if (error instanceof ErrorApp) {
    return {
      status: error.status,
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles,
      registrar: error.status >= 500,
      tecnico: error.causa ?? error,
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const conocido = ERRORES_PRISMA[error.code];
    return conocido
      ? { ...conocido, registrar: true, tecnico: error }
      : errorDeBase(500, MENSAJE_BASE_DATOS, error);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return errorDeBase(503, MENSAJE_SIN_CONEXION, error);
  }
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return errorDeBase(500, MENSAJE_BASE_DATOS, error);
  }
  if (esErrorDeCuerpo(error) && error.type === "entity.parse.failed") {
    return {
      status: 400,
      codigo: "JSON_INVALIDO",
      mensaje: "Los datos enviados no tienen el formato esperado.",
      registrar: false,
      tecnico: error,
    };
  }
  if (esErrorDeCuerpo(error) && error.type === "entity.too.large") {
    return {
      status: 413,
      codigo: "DEMASIADO_GRANDE",
      mensaje: "Lo que enviaste es demasiado grande.",
      registrar: false,
      tecnico: error,
    };
  }
  return {
    status: 500,
    codigo: "ERROR_INTERNO",
    mensaje: MENSAJE_INESPERADO,
    registrar: true,
    tecnico: error,
  };
}

export function crearManejadorErrores(
  registrar: RegistradorDeErrores = registrarEnConsola,
): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const clasificacion = clasificar(error);
    if (clasificacion.registrar) {
      registrar({
        referencia: req.referencia,
        metodo: req.method,
        ruta: req.originalUrl,
        error: clasificacion.tecnico,
      });
    }
    const cuerpo: RespuestaError = {
      error: {
        codigo: clasificacion.codigo,
        mensaje: clasificacion.mensaje,
        ...(clasificacion.detalles ? { detalles: clasificacion.detalles } : {}),
        ...(req.referencia ? { referencia: req.referencia } : {}),
      },
    };
    res.status(clasificacion.status).json(cuerpo);
  };
}
```

- [ ] **Step 8: Poner la referencia en todos los pedidos**

En `backend/src/app.ts`:
- Agregar el import: `import { referenciaPedido } from "./compartido/http/referencia-pedido";`
- Inmediatamente después de `const app = express();`, agregar:
```ts
  app.use(referenciaPedido);
```

- [ ] **Step 9: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS. Los tests del plan 1 que comparan el cuerpo de error con `toEqual` sin referencia siguen pasando porque usan apps de prueba sin `referenciaPedido`.

- [ ] **Step 10: Mostrar el estado**

Run: `git status --short`

---

### Task 2: Regla de encapsulamiento entre módulos

**Files:**
- Modify: `eslint.config.js`

**Interfaces:**
- Consumes: nada. Produces: ESLint rechaza que un archivo de `backend/src/modulos/X/` importe archivos internos de `backend/src/modulos/Y/` (solo `../Y`, que resuelve a su `index.ts`).

- [ ] **Step 1: Verificar que hoy la violación pasa sin aviso**

```bash
printf 'import { CarterasRepositorio } from "../carteras/carteras.repositorio";\nexport const a = CarterasRepositorio;\n' \
  | npx eslint --stdin --stdin-filename backend/src/modulos/cuentas/prueba.servicio.ts; echo "salida=$?"
```
Expected: `salida=0` (no se detecta).

- [ ] **Step 2: Agregar la regla**

En `eslint.config.js`, agregar este bloque como último elemento de `tseslint.config(…)`, después del bloque de `boundaries`:
```js
  {
    files: ["backend/src/modulos/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./(?!\\.\\.)[^/]+/.+",
              message:
                'Desde otro módulo solo se importa su index.ts (ej.: "../carteras"), no sus archivos internos.',
            },
          ],
        },
      ],
    },
  },
```

- [ ] **Step 3: Verificar los cuatro casos**

```bash
for s in 'import { CarterasRepositorio } from "../carteras/carteras.repositorio";' \
         'import type { ModuloCarteras } from "../carteras";' \
         'import { ErrorApp } from "../../compartido/errores";' \
         'import { x } from "./cuentas.repositorio";'; do
  printf '%s\nexport const a = 1;\n' "$s" \
    | npx eslint --stdin --stdin-filename backend/src/modulos/cuentas/prueba.servicio.ts > /dev/null 2>&1
  echo "salida=$? ← $s"
done
```
Expected: `salida=1` solo en el primero; `salida=0` en los otros tres.

- [ ] **Step 4: Lint del proyecto completo**

Run: `npm run lint`
Expected: sin errores (el código actual ya respeta la regla).

- [ ] **Step 5: Mostrar el estado**

Run: `git status --short`

---

### Task 3: Base numérica, fechas, formato y fixtures

**Files:**
- Create: `backend/src/compartido/decimal.ts`, `backend/src/compartido/fechas.ts`, `backend/src/compartido/formato.ts`, `backend/src/compartido/esquemas.ts`
- Create: los 10 archivos de `backend/test/fixtures/` (contenido abajo)
- Test: `backend/test/compartido/base-numerica.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `decimal.ts`: `Decimal` (re-exporta decimal.js), `CERO`, `CIEN`, `aDecimal(valor: { toString(): string } | number | string): Decimal`, `aNumero(valor: Decimal, decimales: number): number`
  - `fechas.ts`: `aFechaDia(texto): Date`, `aTextoDia(fecha): string`, `esTextoDiaValido(texto): boolean`, `hoyEn(zonaHoraria, ahora): string`, `formatoFechaCorta(fecha): string`
  - `formato.ts`: `simboloMoneda(moneda)`, `formatearNumero(valor, maxDecimales?)`, `formatearMoneda(valor, moneda, decimales?)`, `formatearMonedaAbreviada(valor, moneda)`, `formatearPorcentaje(valor, conSigno?)`
  - `esquemas.ts` (zod): `MONEDAS` (orden canónico), `esquemaDecimalPositivo`, `esquemaDecimalNoNegativo`, `esquemaFechaDia`, `esquemaMoneda`

- [ ] **Step 1: Instalar decimal.js**

Run: `npm install -w @cartera/backend decimal.js`

- [ ] **Step 2: Crear los fixtures**

Son respuestas reales del 28/09/2026, recortadas. Crear cada archivo con este contenido exacto:

`backend/test/fixtures/data912-arg_stocks.json`:
```json
[
{"symbol":"GGAL","q_bid":3951.0,"px_bid":6010.0,"px_ask":6020.0,"q_ask":12.0,"v":6446689.0,"q_op":10951.0,"c":6005.0,"pct_change":-4.53},
{"symbol":"GGALD","q_bid":1000.0,"px_bid":3.87,"px_ask":3.91,"q_ask":55.0,"v":1032416.0,"q_op":1744.0,"c":3.88,"pct_change":-4.43},
{"symbol":"PAMP","q_bid":1763.0,"px_bid":4940.0,"px_ask":4970.0,"q_ask":42.0,"v":1225513.0,"q_op":4756.0,"c":4967.5,"pct_change":-1.83},
{"symbol":"PAMPD","q_bid":5320.0,"px_bid":3.15,"px_ask":3.235,"q_ask":3033.0,"v":228294.0,"q_op":808.0,"c":3.2,"pct_change":-2.14},
{"symbol":"YPFD","q_bid":10.0,"px_bid":8305.0,"px_ask":8330.0,"q_ask":7998.0,"v":3108697.0,"q_op":11360.0,"c":8305.0,"pct_change":-1.6},
{"symbol":"YPFDD","q_bid":444.0,"px_bid":5.33,"px_ask":5.38,"q_ask":1101.0,"v":190448.0,"q_op":1294.0,"c":5.35,"pct_change":-2.01}
]
```

`backend/test/fixtures/data912-arg_cedears.json`:
```json
[
{"symbol":"AMZN","q_bid":212.0,"px_bid":2775.0,"px_ask":2790.0,"q_ask":359.0,"v":1007760.0,"q_op":3863.0,"c":2775.0,"pct_change":-1.6},
{"symbol":"AMZNC","q_bid":1.0,"px_bid":1.71,"px_ask":1.765,"q_ask":236.0,"v":4909.0,"q_op":60.0,"c":1.715,"pct_change":-1.44},
{"symbol":"AMZND","q_bid":223.0,"px_bid":1.785,"px_ask":1.825,"q_ask":562.0,"v":181087.0,"q_op":802.0,"c":1.805,"pct_change":-1.1},
{"symbol":"BRKB","q_bid":26.0,"px_bid":37040.0,"px_ask":37100.0,"q_ask":3.0,"v":31085.0,"q_op":1108.0,"c":37100.0,"pct_change":-0.32},
{"symbol":"BRKBC","q_bid":13.0,"px_bid":22.5,"px_ask":24.06,"q_ask":10.0,"v":36.0,"q_op":2.0,"c":23.02,"pct_change":0.04},
{"symbol":"BRKBD","q_bid":33.0,"px_bid":23.9,"px_ask":24.0,"q_ask":27.0,"v":10308.0,"q_op":299.0,"c":23.94,"pct_change":-0.13},
{"symbol":"DIA","q_bid":2.0,"px_bid":41520.0,"px_ask":41900.0,"q_ask":2.0,"v":11181.0,"q_op":376.0,"c":41640.0,"pct_change":-0.72},
{"symbol":"DIAC","q_bid":80.0,"px_bid":24.79,"px_ask":26.7,"q_ask":100.0,"v":49.0,"q_op":10.0,"c":25.26,"pct_change":-2.58},
{"symbol":"DIAD","q_bid":3.0,"px_bid":26.89,"px_ask":27.08,"q_ask":36.0,"v":3155.0,"q_op":126.0,"c":26.93,"pct_change":-1.46},
{"symbol":"EWZ","q_bid":9.0,"px_bid":29320.0,"px_ask":29360.0,"q_ask":35.0,"v":62140.0,"q_op":865.0,"c":29380.0,"pct_change":-1.54},
{"symbol":"EWZC","q_bid":3.0,"px_bid":17.81,"px_ask":20.74,"q_ask":4.0,"v":286.0,"q_op":3.0,"c":18.21,"pct_change":-1.14},
{"symbol":"EWZD","q_bid":5.0,"px_bid":18.96,"px_ask":19.02,"q_ask":238.0,"v":10568.0,"q_op":235.0,"c":18.98,"pct_change":-1.5},
{"symbol":"GLD","q_bid":14.0,"px_bid":12250.0,"px_ask":12330.0,"q_ask":39.0,"v":811805.0,"q_op":3489.0,"c":12260.0,"pct_change":-3.92},
{"symbol":"GLDC","q_bid":232.0,"px_bid":7.56,"px_ask":7.9,"q_ask":220.0,"v":1960.0,"q_op":25.0,"c":7.89,"pct_change":-0.25},
{"symbol":"GLDD","q_bid":42.0,"px_bid":7.91,"px_ask":8.03,"q_ask":444.0,"v":90559.0,"q_op":843.0,"c":7.98,"pct_change":-3.62},
{"symbol":"MELI","q_bid":89.0,"px_bid":23090.0,"px_ask":23140.0,"q_ask":68.0,"v":297411.0,"q_op":3923.0,"c":23100.0,"pct_change":-2.45},
{"symbol":"MELIC","q_bid":216.0,"px_bid":13.87,"px_ask":14.81,"q_ask":120.0,"v":274.0,"q_op":7.0,"c":14.4,"pct_change":-0.96},
{"symbol":"MELID","q_bid":47.0,"px_bid":14.92,"px_ask":14.95,"q_ask":440.0,"v":47576.0,"q_op":928.0,"c":15.01,"pct_change":-1.83},
{"symbol":"MSFT","q_bid":4.0,"px_bid":27480.0,"px_ask":27560.0,"q_ask":10.0,"v":139689.0,"q_op":2437.0,"c":27500.0,"pct_change":-1.22},
{"symbol":"MSFTC","q_bid":5.0,"px_bid":16.16,"px_ask":17.3,"q_ask":7.0,"v":239.0,"q_op":7.0,"c":17.03,"pct_change":-1.45},
{"symbol":"MSFTD","q_bid":895.0,"px_bid":17.7,"px_ask":17.75,"q_ask":371.0,"v":24108.0,"q_op":551.0,"c":17.73,"pct_change":-1.06},
{"symbol":"QQQ","q_bid":60.0,"px_bid":59550.0,"px_ask":59975.0,"q_ask":1.0,"v":43815.0,"q_op":1979.0,"c":59675.0,"pct_change":-1.08},
{"symbol":"QQQC","q_bid":3.0,"px_bid":36.82,"px_ask":37.7,"q_ask":1.0,"v":169.0,"q_op":34.0,"c":36.95,"pct_change":-0.94},
{"symbol":"QQQD","q_bid":15.0,"px_bid":38.49,"px_ask":38.65,"q_ask":87.0,"v":10962.0,"q_op":503.0,"c":38.62,"pct_change":-0.85},
{"symbol":"SPY","q_bid":14.0,"px_bid":20710.0,"px_ask":20780.0,"q_ask":450.0,"v":340748.0,"q_op":6872.0,"c":20700.0,"pct_change":-0.77},
{"symbol":"SPYC","q_bid":50.0,"px_bid":12.77,"px_ask":13.04,"q_ask":200.0,"v":4281.0,"q_op":266.0,"c":12.79,"pct_change":-1.84},
{"symbol":"SPYD","q_bid":202.0,"px_bid":13.35,"px_ask":13.37,"q_ask":516.0,"v":116251.0,"q_op":1553.0,"c":13.37,"pct_change":-0.59},
{"symbol":"VEA","q_bid":8.0,"px_bid":11520.0,"px_ask":12100.0,"q_ask":2.0,"v":84394.0,"q_op":539.0,"c":11560.0,"pct_change":-0.86},
{"symbol":"VEAC","q_bid":1.0,"px_bid":7.0,"px_ask":7.34,"q_ask":2500.0,"v":620.0,"q_op":2.0,"c":7.21,"pct_change":0.28},
{"symbol":"VEAD","q_bid":1039.0,"px_bid":7.45,"px_ask":7.54,"q_ask":500.0,"v":7398.0,"q_op":127.0,"c":7.48,"pct_change":-1.45},
{"symbol":"VIST","q_bid":10.0,"px_bid":36100.0,"px_ask":36220.0,"q_ask":9.0,"v":218523.0,"q_op":2782.0,"c":36120.0,"pct_change":-0.82},
{"symbol":"VISTC","q_bid":7.0,"px_bid":22.31,"px_ask":23.38,"q_ask":200.0,"v":451.0,"q_op":24.0,"c":22.64,"pct_change":0.27},
{"symbol":"VISTD","q_bid":260.0,"px_bid":23.3,"px_ask":23.44,"q_ask":386.0,"v":22080.0,"q_op":672.0,"c":23.34,"pct_change":-0.72},
{"symbol":"XLB","q_bid":1.0,"px_bid":4425.0,"px_ask":4445.0,"q_ask":141.0,"v":5167.0,"q_op":56.0,"c":4430.0,"pct_change":-0.73},
{"symbol":"XLBC","q_bid":2.0,"px_bid":2.725,"px_ask":2.83,"q_ask":200.0,"v":0.0,"q_op":2.0,"c":2.765,"pct_change":0.18},
{"symbol":"XLBD","q_bid":100.0,"px_bid":2.84,"px_ask":2.955,"q_ask":150.0,"v":936.0,"q_op":5.0,"c":2.88,"pct_change":-0.17},
{"symbol":"XLF","q_bid":29.0,"px_bid":43800.0,"px_ask":44000.0,"q_ask":47.0,"v":16812.0,"q_op":361.0,"c":43920.0,"pct_change":-1.17},
{"symbol":"XLFC","q_bid":95.0,"px_bid":26.29,"px_ask":28.29,"q_ask":40.0,"v":0.0,"q_op":1.0,"c":27.5,"pct_change":1.25},
{"symbol":"XLFD","q_bid":3.0,"px_bid":28.22,"px_ask":28.4,"q_ask":4.0,"v":1912.0,"q_op":86.0,"c":28.39,"pct_change":-1.32},
{"symbol":"XLP","q_bid":250.0,"px_bid":8325.0,"px_ask":8370.0,"q_ask":16.0,"v":75939.0,"q_op":444.0,"c":8345.0,"pct_change":0.24},
{"symbol":"XLPC","q_bid":56.0,"px_bid":5.13,"px_ask":5.17,"q_ask":102.0,"v":84.0,"q_op":5.0,"c":5.15,"pct_change":-0.19},
{"symbol":"XLPD","q_bid":5.0,"px_bid":5.38,"px_ask":5.42,"q_ask":250.0,"v":4578.0,"q_op":87.0,"c":5.4,"pct_change":0.37},
{"symbol":"XLU","q_bid":1310.0,"px_bid":4240.0,"px_ask":4500.0,"q_ask":8.0,"v":57585.0,"q_op":415.0,"c":4247.5,"pct_change":-0.76},
{"symbol":"XLUC","q_bid":15.0,"px_bid":2.6,"px_ask":2.695,"q_ask":100.0,"v":4.0,"q_op":2.0,"c":2.63,"pct_change":-0.19},
{"symbol":"XLUD","q_bid":35.0,"px_bid":2.75,"px_ask":2.755,"q_ask":499.0,"v":10195.0,"q_op":91.0,"c":2.75,"pct_change":-0.9}
]
```

`backend/test/fixtures/data912-arg_bonds.json`:
```json
[
{"symbol":"AE38","q_bid":878.0,"px_bid":111610.0,"px_ask":111700.0,"q_ask":1000.0,"v":15019053.0,"q_op":5073.0,"c":111610.0,"pct_change":-0.97},
{"symbol":"AE38C","q_bid":1.0,"px_bid":68.7,"px_ask":69.09,"q_ask":25000.0,"v":1025708.0,"q_op":471.0,"c":69.04,"pct_change":-0.96},
{"symbol":"AE38D","q_bid":71870.0,"px_bid":72.15,"px_ask":72.16,"q_ask":1000.0,"v":10542779.0,"q_op":3626.0,"c":72.15,"pct_change":-0.76},
{"symbol":"AL30","q_bid":250.0,"px_bid":83870.0,"px_ask":83940.0,"q_ask":179613.0,"v":233049075.0,"q_op":71245.0,"c":83940.0,"pct_change":-0.23},
{"symbol":"AL30C","q_bid":2257976.0,"px_bid":51.75,"px_ask":52.99,"q_ask":500000.0,"v":161593289.0,"q_op":32140.0,"c":51.75,"pct_change":-0.35},
{"symbol":"AL30D","q_bid":71711.0,"px_bid":53.96,"px_ask":53.97,"q_ask":142.0,"v":175285452.0,"q_op":52931.0,"c":53.97,"pct_change":-0.41},
{"symbol":"T15E7","q_bid":8713055.0,"px_bid":149.66,"px_ask":149.67,"q_ask":7171494.0,"v":1955947772.0,"q_op":295.0,"c":149.649,"pct_change":0.02},
{"symbol":"T30A7","q_bid":1558033.0,"px_bid":134.7,"px_ask":134.8,"q_ask":1000000000.0,"v":7464090602.0,"q_op":452.0,"c":134.7,"pct_change":-0.21},
{"symbol":"TZXM7","q_bid":99481336.0,"px_bid":227.3,"px_ask":227.35,"q_ask":9553685.0,"v":6563814165.0,"q_op":277.0,"c":227.3,"pct_change":0.2}
]
```

`backend/test/fixtures/data912-arg_corp.json`:
```json
[
{"symbol":"HVS1D","q_bid":15.0,"px_bid":101.5,"px_ask":103.0,"q_ask":10.0,"v":4403.0,"q_op":4.0,"c":103.0,"pct_change":0.0},
{"symbol":"HVS1O","q_bid":2010.0,"px_bid":150100.0,"px_ask":164500.0,"q_ask":500.0,"v":0.0,"q_op":1.0,"c":160000.0,"pct_change":0.0},
{"symbol":"MGCQC","q_bid":125000.0,"px_bid":100.7,"px_ask":103.05,"q_ask":14987.0,"v":13.0,"q_op":1.0,"c":103.05,"pct_change":1.28},
{"symbol":"MGCQD","q_bid":1973.0,"px_bid":106.8,"px_ask":107.25,"q_ask":396.0,"v":138287.0,"q_op":86.0,"c":107.25,"pct_change":0.42},
{"symbol":"MGCQO","q_bid":200.0,"px_bid":164880.0,"px_ask":168620.0,"q_ask":1000.0,"v":85625.0,"q_op":62.0,"c":166390.0,"pct_change":0.82},
{"symbol":"PN35D","q_bid":13.0,"px_bid":103.1,"px_ask":103.2,"q_ask":10605.0,"v":232466.0,"q_op":260.0,"c":103.2,"pct_change":-0.29},
{"symbol":"PN35O","q_bid":1000.0,"px_bid":158950.0,"px_ask":163500.0,"q_ask":1122.0,"v":133700.0,"q_op":219.0,"c":161990.0,"pct_change":0.99},
{"symbol":"PN37D","q_bid":4000.0,"px_bid":101.15,"px_ask":103.4,"q_ask":1000.0,"v":51455.0,"q_op":48.0,"c":103.0,"pct_change":-0.87},
{"symbol":"PN37O","q_bid":1005.0,"px_bid":158490.0,"px_ask":162960.0,"q_ask":121.0,"v":28280.0,"q_op":37.0,"c":158480.0,"pct_change":-1.15},
{"symbol":"VSCPD","q_bid":3397.0,"px_bid":108.0,"px_ask":108.55,"q_ask":57.0,"v":23979.0,"q_op":34.0,"c":108.6,"pct_change":0.46},
{"symbol":"VSCPO","q_bid":962.0,"px_bid":166200.0,"px_ask":169590.0,"q_ask":8097.0,"v":15851.0,"q_op":18.0,"c":168450.0,"pct_change":1.09},
{"symbol":"VSCRC","q_bid":20000.0,"px_bid":100.35,"px_ask":103.7,"q_ask":597.0,"v":26330.0,"q_op":18.0,"c":102.7,"pct_change":-1.39},
{"symbol":"VSCRD","q_bid":2560.0,"px_bid":107.6,"px_ask":108.5,"q_ask":100.0,"v":133065.0,"q_op":243.0,"c":107.55,"pct_change":-0.83},
{"symbol":"VSCRO","q_bid":4000.0,"px_bid":166060.0,"px_ask":167000.0,"q_ask":39184.0,"v":310142.0,"q_op":308.0,"c":167000.0,"pct_change":-0.57},
{"symbol":"YFCLD","q_bid":600.0,"px_bid":102.3,"px_ask":104.35,"q_ask":251.0,"v":10690.0,"q_op":60.0,"c":102.6,"pct_change":-0.63},
{"symbol":"YFCLO","q_bid":630.0,"px_bid":158520.0,"px_ask":165990.0,"q_ask":101.0,"v":11684.0,"q_op":54.0,"c":158540.0,"pct_change":-0.38},
{"symbol":"YM39C","q_bid":177.0,"px_bid":104.1,"px_ask":105.5,"q_ask":1997.0,"v":149.0,"q_op":7.0,"c":105.5,"pct_change":-0.28},
{"symbol":"YM39D","q_bid":100.0,"px_bid":109.75,"px_ask":110.2,"q_ask":91.0,"v":160148.0,"q_op":191.0,"c":110.2,"pct_change":0.87},
{"symbol":"YM39O","q_bid":2891.0,"px_bid":170750.0,"px_ask":171020.0,"q_ask":88.0,"v":112114.0,"q_op":175.0,"c":170750.0,"pct_change":0.66},
{"symbol":"YM42C","q_bid":97703.0,"px_bid":97.57,"px_ask":100.85,"q_ask":1374.0,"v":2297.0,"q_op":2.0,"c":98.86,"pct_change":-2.12},
{"symbol":"YM42D","q_bid":5000.0,"px_bid":104.1,"px_ask":104.9,"q_ask":893.0,"v":631518.0,"q_op":237.0,"c":104.9,"pct_change":-0.1},
{"symbol":"YM42O","q_bid":40883.0,"px_bid":162170.0,"px_ask":163630.0,"q_ask":40883.0,"v":504318.0,"q_op":230.0,"c":162890.0,"pct_change":0.55}
]
```

`backend/test/fixtures/data912-arg_notes.json`:
```json
[
{"symbol":"BGD26","q_bid":2000000.0,"px_bid":93.0,"px_ask":0.0,"q_ask":0.0,"v":0.0,"q_op":1.0,"c":101.45,"pct_change":0.0},
{"symbol":"BU4N6","q_bid":20000000.0,"px_bid":101.0,"px_ask":102.5,"q_ask":18514389.0,"v":0.0,"q_op":0.0,"c":101.4,"pct_change":1.4},
{"symbol":"D15E7","q_bid":4924.0,"px_bid":149320.0,"px_ask":149320.0,"q_ask":76.0,"v":37319.0,"q_op":8.0,"c":149320.0,"pct_change":-1.11},
{"symbol":"D30N6","q_bid":7309.0,"px_bid":151100.0,"px_ask":151200.0,"q_ask":554138.0,"v":9574696.0,"q_op":129.0,"c":151200.0,"pct_change":-0.13},
{"symbol":"D30O6","q_bid":4600000.0,"px_bid":151820.0,"px_ask":151860.0,"q_ask":202598.0,"v":96260368.0,"q_op":393.0,"c":151820.0,"pct_change":-0.05},
{"symbol":"D30S6","q_bid":2486134.0,"px_bid":152290.0,"px_ask":152310.0,"q_ask":1217646.0,"v":38729737.0,"q_op":145.0,"c":152300.0,"pct_change":0.05}
]
```

`backend/test/fixtures/data912-historico-cedears-AMZN.json`:
```json
[
{"date":"2026-09-14","o":2825.0,"h":2840.0,"l":2790.0,"c":2815.0,"v":723725.0,"dr":-0.0157,"sa":0.4004},
{"date":"2026-09-15","o":2817.5,"h":2820.0,"l":2742.5,"c":2760.0,"v":1388713.0,"dr":-0.0195,"sa":0.4008},
{"date":"2026-09-16","o":2755.0,"h":2770.0,"l":2715.0,"c":2737.5,"v":2017331.0,"dr":-0.0082,"sa":0.3975},
{"date":"2026-09-17","o":2757.5,"h":2810.0,"l":2757.5,"c":2790.0,"v":1008998.0,"dr":0.0192,"sa":0.3979},
{"date":"2026-09-18","o":2790.0,"h":2840.0,"l":2790.0,"c":2820.0,"v":1091798.0,"dr":0.0108,"sa":0.3966},
{"date":"2026-09-21","o":2822.5,"h":2882.5,"l":2820.0,"c":2872.5,"v":2876000.0,"dr":0.0186,"sa":0.3969},
{"date":"2026-09-22","o":2837.5,"h":2877.5,"l":2817.5,"c":2840.0,"v":2904383.0,"dr":-0.0113,"sa":0.397},
{"date":"2026-09-23","o":2825.0,"h":2827.5,"l":2762.5,"c":2782.5,"v":1583047.0,"dr":-0.0202,"sa":0.3963},
{"date":"2026-09-24","o":2770.0,"h":2812.5,"l":2740.0,"c":2805.0,"v":1835180.0,"dr":0.0081,"sa":0.3963},
{"date":"2026-09-25","o":2812.5,"h":2832.5,"l":2785.0,"c":2820.0,"v":1354493.0,"dr":0.0053,"sa":0.3964}
]
```

`backend/test/fixtures/data912-historico-sin-datos.json`:
```json
{"Error":"Nahh no tengo ese ticker loko"}
```

`backend/test/fixtures/dolarapi-dolares.json`:
```json
[
{"moneda":"USD","casa":"oficial","nombre":"Oficial","compra":1495,"venta":1545,"fechaActualizacion":"2026-09-28T17:00:00.000Z"},
{"moneda":"USD","casa":"blue","nombre":"Blue","compra":1545,"venta":1565,"fechaActualizacion":"2026-09-28T19:48:00.000Z"},
{"moneda":"USD","casa":"bolsa","nombre":"Bolsa","compra":1544,"venta":1556.5,"fechaActualizacion":"2026-09-28T19:48:00.000Z"},
{"moneda":"USD","casa":"contadoconliqui","nombre":"Contado con liquidación","compra":1618.2,"venta":1619.6,"fechaActualizacion":"2026-09-28T19:48:00.000Z"},
{"moneda":"USD","casa":"mayorista","nombre":"Mayorista","compra":1515.5,"venta":1524.5,"fechaActualizacion":"2026-09-28T16:17:00.000Z"},
{"moneda":"USD","casa":"cripto","nombre":"Cripto","compra":1613.52,"venta":1617.09,"fechaActualizacion":"2026-09-28T19:48:00.000Z"},
{"moneda":"USD","casa":"tarjeta","nombre":"Tarjeta","compra":1943.5,"venta":2008.5,"fechaActualizacion":"2026-09-28T17:00:00.000Z"}
]
```

`backend/test/fixtures/argentinadatos-bolsa.json`:
```json
[
{"casa":"bolsa","compra":1536.5,"venta":1539.9,"fecha":"2026-09-14"},
{"casa":"bolsa","compra":1530.1,"venta":1536.7,"fecha":"2026-09-15"},
{"casa":"bolsa","compra":1530.7,"venta":1533.2,"fecha":"2026-09-16"},
{"casa":"bolsa","compra":1534.1,"venta":1542.1,"fecha":"2026-09-17"},
{"casa":"bolsa","compra":1528.4,"venta":1534.7,"fecha":"2026-09-18"},
{"casa":"bolsa","compra":1530.2,"venta":1540.1,"fecha":"2026-09-19"},
{"casa":"bolsa","compra":1530.2,"venta":1540.1,"fecha":"2026-09-20"},
{"casa":"bolsa","compra":1530.2,"venta":1540.1,"fecha":"2026-09-21"},
{"casa":"bolsa","compra":1531.6,"venta":1536.5,"fecha":"2026-09-22"},
{"casa":"bolsa","compra":1530.4,"venta":1536.6,"fecha":"2026-09-23"},
{"casa":"bolsa","compra":1537.6,"venta":1542.9,"fecha":"2026-09-24"},
{"casa":"bolsa","compra":1539,"venta":1545.6,"fecha":"2026-09-25"},
{"casa":"bolsa","compra":1544.3,"venta":1557.3,"fecha":"2026-09-26"},
{"casa":"bolsa","compra":1544.3,"venta":1557.3,"fecha":"2026-09-27"},
{"casa":"bolsa","compra":1544.3,"venta":1557.3,"fecha":"2026-09-28"}
]
```

`backend/test/fixtures/argentinadatos-feriados-2026.json`:
```json
[
{"fecha":"2026-01-01","tipo":"inamovible","nombre":"Año nuevo"},
{"fecha":"2026-02-16","tipo":"inamovible","nombre":"Carnaval"},
{"fecha":"2026-02-17","tipo":"inamovible","nombre":"Carnaval"},
{"fecha":"2026-03-23","tipo":"puente","nombre":"Puente turístico no laborable"},
{"fecha":"2026-03-24","tipo":"inamovible","nombre":"Día Nacional de la Memoria por la Verdad y la Justicia"},
{"fecha":"2026-04-02","tipo":"inamovible","nombre":"Día del Veterano y de los Caídos en la Guerra de Malvinas"},
{"fecha":"2026-04-03","tipo":"inamovible","nombre":"Viernes Santo"},
{"fecha":"2026-05-01","tipo":"inamovible","nombre":"Día del Trabajador"},
{"fecha":"2026-05-25","tipo":"inamovible","nombre":"Día de la Revolución de Mayo"},
{"fecha":"2026-06-15","tipo":"trasladable","nombre":"Paso a la Inmortalidad del General Martín Güemes (17/6)"},
{"fecha":"2026-06-20","tipo":"inamovible","nombre":"Paso a la Inmortalidad del General Manuel Belgrano"},
{"fecha":"2026-07-09","tipo":"inamovible","nombre":"Día de la Independencia"},
{"fecha":"2026-07-10","tipo":"puente","nombre":"Puente turístico no laborable"},
{"fecha":"2026-08-17","tipo":"trasladable","nombre":"Paso a la Inmortalidad del Gral. José de San Martín"},
{"fecha":"2026-10-12","tipo":"trasladable","nombre":"Día del Respeto a la Diversidad Cultural"},
{"fecha":"2026-11-23","tipo":"trasladable","nombre":"Día de la Soberanía Nacional (20/11)"},
{"fecha":"2026-12-07","tipo":"puente","nombre":"Puente turístico no laborable"},
{"fecha":"2026-12-08","tipo":"inamovible","nombre":"Día de la Inmaculada Concepción de María"},
{"fecha":"2026-12-25","tipo":"inamovible","nombre":"Navidad"}
]
```

- [ ] **Step 3: Escribir el test que falla**

`backend/test/compartido/base-numerica.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Decimal, aDecimal, aNumero } from "../../src/compartido/decimal";
import {
  aFechaDia,
  aTextoDia,
  esTextoDiaValido,
  formatoFechaCorta,
  hoyEn,
} from "../../src/compartido/fechas";
import {
  formatearMoneda,
  formatearMonedaAbreviada,
  formatearNumero,
  formatearPorcentaje,
} from "../../src/compartido/formato";
import {
  esquemaDecimalNoNegativo,
  esquemaDecimalPositivo,
  esquemaFechaDia,
} from "../../src/compartido/esquemas";
import "../../src/compartido/validacion";

describe("decimal", () => {
  it("convierte sin perder precisión y redondea solo para mostrar", () => {
    expect(aDecimal(0.1).plus(aDecimal("0.2")).toString()).toBe("0.3");
    expect(aDecimal({ toString: () => "105.53" }).toString()).toBe("105.53");
    expect(aNumero(new Decimal("2.345"), 2)).toBe(2.35);
  });
});

describe("fechas", () => {
  it("los días se guardan como medianoche UTC y vuelven igual", () => {
    expect(aFechaDia("2026-05-10").toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(aTextoDia(aFechaDia("2026-05-10"))).toBe("2026-05-10");
    expect(formatoFechaCorta(aFechaDia("2026-05-10"))).toBe("10/05/2026");
  });

  it("valida días reales", () => {
    expect(esTextoDiaValido("2026-02-28")).toBe(true);
    expect(esTextoDiaValido("2026-02-30")).toBe(false);
    expect(esTextoDiaValido("10/05/2026")).toBe(false);
  });

  it("el día de hoy depende de la zona horaria argentina", () => {
    const tardeDeNoche = new Date("2026-09-29T01:00:00Z");
    expect(hoyEn("America/Argentina/Buenos_Aires", tardeDeNoche)).toBe("2026-09-28");
  });
});

describe("formato es-AR", () => {
  it("números, montos y porcentajes", () => {
    expect(formatearNumero(new Decimal("1234.5"))).toBe("1.234,5");
    expect(formatearMoneda(new Decimal("48320"), "USD_MEP")).toBe("US$ 48.320,00");
    expect(formatearMoneda(new Decimal("2785"), "ARS", 0)).toBe("$ 2.785");
    expect(formatearMonedaAbreviada(new Decimal("74900000"), "ARS")).toBe("$ 74,9 M");
    expect(formatearMonedaAbreviada(new Decimal("3140.4"), "USD")).toBe("US$ 3.140");
    expect(formatearPorcentaje(new Decimal("6.94"))).toBe("+6,9%");
    expect(formatearPorcentaje(new Decimal("-0.44"))).toBe("-0,4%");
    expect(formatearPorcentaje(new Decimal("0.44"), false)).toBe("0,4%");
  });
});

describe("esquemas numéricos", () => {
  const esquema = z.object({ cantidad: esquemaDecimalPositivo, comision: esquemaDecimalNoNegativo, fecha: esquemaFechaDia });

  it("acepta números o textos numéricos y devuelve Decimal", () => {
    const r = esquema.parse({ cantidad: "10.5", comision: 0, fecha: "2026-05-10" });
    expect(r.cantidad.toString()).toBe("10.5");
    expect(r.comision.toString()).toBe("0");
    expect(r.fecha).toBe("2026-05-10");
  });

  it("rechaza con mensajes llanos", () => {
    const r = esquema.safeParse({ cantidad: 0, comision: -1, fecha: "2026-13-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((p) => p.message)).toEqual([
        "Tiene que ser un número mayor a cero.",
        "No puede ser negativo.",
        "Poné una fecha válida con el formato AAAA-MM-DD.",
      ]);
    }
  });

  it("rechaza textos que no son números", () => {
    const r = esquema.safeParse({ cantidad: "diez", comision: 0, fecha: "2026-05-10" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Tiene que ser un número mayor a cero.");
  });
});
```

- [ ] **Step 4: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/compartido/base-numerica`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 5: Implementar**

`backend/src/compartido/decimal.ts`:
```ts
import Decimal from "decimal.js";

export { Decimal };

export const CERO = new Decimal(0);
export const CIEN = new Decimal(100);

/** Convierte un Decimal de Prisma, un número o un texto a Decimal de decimal.js. */
export function aDecimal(valor: { toString(): string } | number | string): Decimal {
  return new Decimal(valor.toString());
}

/** Número para mostrar, redondeado. Solo se usa al armar DTOs, nunca para calcular. */
export function aNumero(valor: Decimal, decimales: number): number {
  return valor.toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP).toNumber();
}
```

`backend/src/compartido/fechas.ts`:
```ts
const PATRON_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Las fechas de operaciones son días: se guardan como medianoche UTC de ese día. */
export function aFechaDia(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`);
}

export function aTextoDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function esTextoDiaValido(texto: string): boolean {
  if (!PATRON_DIA.test(texto)) return false;
  const fecha = aFechaDia(texto);
  return !Number.isNaN(fecha.getTime()) && aTextoDia(fecha) === texto;
}

/** "AAAA-MM-DD" del día actual en la zona horaria dada. */
export function hoyEn(zonaHoraria: string, ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** "10/05/2026". */
export function formatoFechaCorta(fecha: Date): string {
  const [anio, mes, dia] = aTextoDia(fecha).split("-");
  return `${dia}/${mes}/${anio}`;
}
```

`backend/src/compartido/formato.ts`:
```ts
import type { Moneda } from "@cartera/contratos";
import type { Decimal } from "./decimal";

const LOCALE = "es-AR";
const UN_MILLON = 1_000_000;

export function simboloMoneda(moneda: Moneda | "USD"): string {
  return moneda === "ARS" ? "$" : "US$";
}

export function formatearNumero(valor: Decimal, maxDecimales = 2): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxDecimales }).format(
    valor.toNumber(),
  );
}

export function formatearMoneda(valor: Decimal, moneda: Moneda | "USD", decimales = 2): string {
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor.toNumber());
  return `${simboloMoneda(moneda)} ${numero}`;
}

/** "$ 74,9 M" para montos grandes; sin decimales para el resto. */
export function formatearMonedaAbreviada(valor: Decimal, moneda: Moneda | "USD"): string {
  if (valor.abs().gte(UN_MILLON)) {
    const millones = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(
      valor.div(UN_MILLON).toNumber(),
    );
    return `${simboloMoneda(moneda)} ${millones} M`;
  }
  return formatearMoneda(valor, moneda, 0);
}

export function formatearPorcentaje(valor: Decimal, conSigno = true): string {
  const numero = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor.toNumber());
  return `${conSigno && valor.gt(0) ? "+" : ""}${numero}%`;
}
```

`backend/src/compartido/esquemas.ts`:
```ts
import { z } from "zod";
import type { Moneda } from "@cartera/contratos";
import { Decimal } from "./decimal";
import { esTextoDiaValido } from "./fechas";

/** Orden canónico de las monedas (así se listan en toda la app). */
export const MONEDAS = ["ARS", "USD_MEP", "USD_CCL", "USD_EXTERIOR"] as const satisfies readonly Moneda[];

function esquemaDecimal(esValido: (valor: Decimal) => boolean, mensaje: string) {
  return z.union([z.number(), z.string().trim()], { message: mensaje }).transform((valor, ctx) => {
    try {
      const decimal = new Decimal(valor);
      if (decimal.isFinite() && esValido(decimal)) return decimal;
    } catch {
      // se informa abajo con el mensaje llano
    }
    ctx.addIssue({ code: "custom", message: mensaje });
    return z.NEVER;
  });
}

export const esquemaDecimalPositivo = esquemaDecimal(
  (valor) => valor.gt(0),
  "Tiene que ser un número mayor a cero.",
);

export const esquemaDecimalNoNegativo = esquemaDecimal(
  (valor) => valor.gte(0),
  "No puede ser negativo.",
);

export const esquemaFechaDia = z
  .string({ message: "Poné una fecha válida con el formato AAAA-MM-DD." })
  .refine(esTextoDiaValido, "Poné una fecha válida con el formato AAAA-MM-DD.");

export const esquemaMoneda = z.enum(MONEDAS, {
  message: "Elegí la moneda: pesos, dólar MEP, dólar cable o dólar del exterior.",
});
```

- [ ] **Step 6: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 7: Mostrar el estado**

Run: `git status --short`

---

### Task 4: Proveedor HTTP base (timeout, reintento, caché y respaldo)

**Files:**
- Create: `backend/src/proveedores/http/proveedor-http-base.ts`
- Create: `backend/test/utilidades/http-falso.ts`
- Test: `backend/test/proveedores/proveedor-http-base.test.ts`

**Interfaces:**
- Consumes: `ErrorProveedorExterno` (Tarea 1).
- Produces:
  - `interface DatoConFecha<T> { valor: T; obtenidoEn: Date; desactualizado: boolean }`
  - `interface RespuestaHttp { ok: boolean; status: number; json(): Promise<unknown> }` · `type BuscarHttp = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<RespuestaHttp>`
  - `interface OpcionesProveedorHttp { buscar?: BuscarHttp; ahora?: () => Date; timeoutMs?: number; reintentos?: number; registrar?: (mensaje: string, error: unknown) => void }`
  - `abstract class ProveedorHttpBase` con `protected abstract readonly queSeObtiene: string` y `protected obtener<T>(clave, url, ttlMs, interpretar: (json: unknown) => T, forzar?: boolean): Promise<DatoConFecha<T>>`
  - (tests) `crearBuscarFalso(rutas: Record<string, RespuestaFalsa>): BuscarFalso` con `llamadas: string[]`; `type RespuestaFalsa = unknown | { status: number } | Error | ((signal: AbortSignal) => Promise<unknown>)`; `leerFixture(nombre): unknown`

- [ ] **Step 1: Crear el `buscar` falso para tests**

`backend/test/utilidades/http-falso.ts`:
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuscarHttp, RespuestaHttp } from "../../src/proveedores/http/proveedor-http-base";

const DIRECTORIO_FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export function leerFixture(nombre: string): unknown {
  return JSON.parse(readFileSync(path.join(DIRECTORIO_FIXTURES, nombre), "utf8"));
}

/** Respuesta JSON, un status HTTP de error, una excepción de red o una función que espera. */
export type RespuestaFalsa =
  | { json: unknown }
  | { status: number }
  | Error
  | ((signal: AbortSignal) => Promise<unknown>);

export interface BuscarFalso extends BuscarHttp {
  llamadas: string[];
}

/** `rutas` se busca por coincidencia exacta de URL; las URLs no listadas dan 404. */
export function crearBuscarFalso(rutas: Record<string, RespuestaFalsa | RespuestaFalsa[]>): BuscarFalso {
  const llamadas: string[] = [];
  const turnos = new Map<string, number>();
  const buscar = (async (url, init): Promise<RespuestaHttp> => {
    llamadas.push(url);
    const definida = rutas[url];
    const turno = turnos.get(url) ?? 0;
    turnos.set(url, turno + 1);
    const respuesta = Array.isArray(definida)
      ? definida[Math.min(turno, definida.length - 1)]
      : definida;
    if (respuesta === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (respuesta instanceof Error) throw respuesta;
    if (typeof respuesta === "function") {
      const json = await respuesta(init.signal);
      return { ok: true, status: 200, json: async () => json };
    }
    if ("status" in respuesta) return { ok: false, status: respuesta.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => respuesta.json };
  }) as BuscarFalso;
  buscar.llamadas = llamadas;
  return buscar;
}
```

- [ ] **Step 2: Escribir el test que falla**

`backend/test/proveedores/proveedor-http-base.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ProveedorHttpBase,
  type OpcionesProveedorHttp,
} from "../../src/proveedores/http/proveedor-http-base";
import { ErrorProveedorExterno } from "../../src/compartido/errores";
import { crearBuscarFalso, type RespuestaFalsa } from "../utilidades/http-falso";

const URL = "https://ejemplo.com/datos";
const TTL = 60_000;

class ProveedorPrueba extends ProveedorHttpBase {
  protected readonly queSeObtiene = "los datos de prueba";
  traer(forzar = false) {
    return this.obtener("datos", URL, TTL, (json) => z.object({ n: z.number() }).parse(json), forzar);
  }
}

function crear(respuestas: RespuestaFalsa | RespuestaFalsa[], extra: OpcionesProveedorHttp = {}) {
  let reloj = new Date("2026-09-28T15:00:00Z");
  const registros: string[] = [];
  const buscar = crearBuscarFalso({ [URL]: respuestas });
  const proveedor = new ProveedorPrueba({
    buscar,
    ahora: () => reloj,
    registrar: (mensaje) => registros.push(mensaje),
    timeoutMs: 50,
    ...extra,
  });
  return {
    proveedor,
    buscar,
    registros,
    avanzar: (ms: number) => {
      reloj = new Date(reloj.getTime() + ms);
    },
  };
}

describe("ProveedorHttpBase", () => {
  it("guarda en caché mientras dura el TTL y vuelve a pedir después", async () => {
    const { proveedor, buscar, avanzar } = crear([{ json: { n: 1 } }, { json: { n: 2 } }]);
    expect((await proveedor.traer()).valor).toEqual({ n: 1 });
    expect((await proveedor.traer()).valor).toEqual({ n: 1 });
    expect(buscar.llamadas).toHaveLength(1);
    avanzar(TTL + 1);
    const nuevo = await proveedor.traer();
    expect(nuevo).toMatchObject({ valor: { n: 2 }, desactualizado: false });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("forzar ignora la caché", async () => {
    const { proveedor, buscar } = crear([{ json: { n: 1 } }, { json: { n: 2 } }]);
    await proveedor.traer();
    expect((await proveedor.traer(true)).valor).toEqual({ n: 2 });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("si la fuente falla, devuelve el último dato marcado como desactualizado y lo registra", async () => {
    const { proveedor, registros, avanzar } = crear([{ json: { n: 1 } }, { status: 503 }]);
    const primero = await proveedor.traer();
    avanzar(TTL + 1);
    const respaldo = await proveedor.traer();
    expect(respaldo).toEqual({ valor: { n: 1 }, obtenidoEn: primero.obtenidoEn, desactualizado: true });
    expect(registros[0]).toContain("los datos de prueba");
  });

  it("sin datos previos, falla con un mensaje llano y guarda la causa técnica", async () => {
    const { proveedor } = crear(new Error("getaddrinfo ENOTFOUND ejemplo.com"));
    const error = await proveedor.traer().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorProveedorExterno);
    expect((error as ErrorProveedorExterno).message).toBe(
      "No pudimos obtener los datos de prueba. Probá de nuevo en unos minutos.",
    );
    expect(String((error as ErrorProveedorExterno).causa)).toContain("ENOTFOUND");
  });

  it("una respuesta con formato inesperado cuenta como falla", async () => {
    const { proveedor } = crear({ json: { otro: "formato" } });
    await expect(proveedor.traer()).rejects.toThrow(ErrorProveedorExterno);
  });

  it("corta por timeout y reintenta una vez", async () => {
    const lenta = (signal: AbortSignal) =>
      new Promise<unknown>((_resolver, rechazar) => {
        signal.addEventListener("abort", () => rechazar(new Error("abortado")));
      });
    const { proveedor, buscar } = crear([lenta, { json: { n: 7 } }]);
    expect((await proveedor.traer()).valor).toEqual({ n: 7 });
    expect(buscar.llamadas).toHaveLength(2);
  });

  it("pedidos simultáneos comparten una sola descarga", async () => {
    const { proveedor, buscar } = crear({ json: { n: 1 } });
    await Promise.all([proveedor.traer(), proveedor.traer(), proveedor.traer()]);
    expect(buscar.llamadas).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/proveedores`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

`backend/src/proveedores/http/proveedor-http-base.ts`:
```ts
import { ErrorProveedorExterno } from "../../compartido/errores";

export interface DatoConFecha<T> {
  valor: T;
  obtenidoEn: Date;
  /** true cuando la fuente falló y se devuelve el último dato conocido. */
  desactualizado: boolean;
}

export interface RespuestaHttp {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type BuscarHttp = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<RespuestaHttp>;

export interface OpcionesProveedorHttp {
  buscar?: BuscarHttp;
  ahora?: () => Date;
  timeoutMs?: number;
  reintentos?: number;
  /** Dónde va el detalle técnico de una falla. Nunca llega al usuario. */
  registrar?: (mensaje: string, error: unknown) => void;
}

interface Entrada {
  valor: unknown;
  obtenidoEn: Date;
}

const TIMEOUT_POR_DEFECTO_MS = 8_000;
const REINTENTOS_POR_DEFECTO = 1;

/**
 * Base de todos los proveedores HTTP: timeout, reintento, caché con vencimiento, una sola
 * descarga para pedidos simultáneos y respaldo con el último dato cuando la fuente falla.
 */
export abstract class ProveedorHttpBase {
  /** Qué se obtiene, para los mensajes al usuario: "los precios del mercado". */
  protected abstract readonly queSeObtiene: string;

  private readonly cache = new Map<string, Entrada>();
  private readonly enCurso = new Map<string, Promise<Entrada>>();
  private readonly buscar: BuscarHttp;
  private readonly ahora: () => Date;
  private readonly timeoutMs: number;
  private readonly reintentos: number;
  private readonly registrar: (mensaje: string, error: unknown) => void;

  constructor(opciones: OpcionesProveedorHttp = {}) {
    this.buscar = opciones.buscar ?? ((url, init) => fetch(url, init));
    this.ahora = opciones.ahora ?? (() => new Date());
    this.timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;
    this.reintentos = opciones.reintentos ?? REINTENTOS_POR_DEFECTO;
    this.registrar = opciones.registrar ?? ((mensaje, error) => console.error(mensaje, error));
  }

  protected async obtener<T>(
    clave: string,
    url: string,
    ttlMs: number,
    interpretar: (json: unknown) => T,
    forzar = false,
  ): Promise<DatoConFecha<T>> {
    const guardada = this.cache.get(clave);
    if (!forzar && guardada && this.ahora().getTime() - guardada.obtenidoEn.getTime() < ttlMs) {
      return { valor: guardada.valor as T, obtenidoEn: guardada.obtenidoEn, desactualizado: false };
    }
    try {
      const entrada = await this.descargarUnaVez(clave, url, interpretar);
      return { valor: entrada.valor as T, obtenidoEn: entrada.obtenidoEn, desactualizado: false };
    } catch (error) {
      this.registrar(`No se pudo obtener ${this.queSeObtiene} desde ${url}`, error);
      if (guardada) {
        return { valor: guardada.valor as T, obtenidoEn: guardada.obtenidoEn, desactualizado: true };
      }
      throw new ErrorProveedorExterno(
        `No pudimos obtener ${this.queSeObtiene}. Probá de nuevo en unos minutos.`,
        error,
      );
    }
  }

  private descargarUnaVez<T>(
    clave: string,
    url: string,
    interpretar: (json: unknown) => T,
  ): Promise<Entrada> {
    const existente = this.enCurso.get(clave);
    if (existente) return existente;
    const descarga = this.descargar(url)
      .then((json) => {
        const entrada: Entrada = { valor: interpretar(json), obtenidoEn: this.ahora() };
        this.cache.set(clave, entrada);
        return entrada;
      })
      .finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, descarga);
    return descarga;
  }

  private async descargar(url: string): Promise<unknown> {
    let ultimoError: unknown;
    for (let intento = 0; intento <= this.reintentos; intento += 1) {
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), this.timeoutMs);
      try {
        const respuesta = await this.buscar(url, {
          signal: control.signal,
          headers: { Accept: "application/json" },
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en ${url}`);
        return await respuesta.json();
      } catch (error) {
        ultimoError = error;
      } finally {
        clearTimeout(temporizador);
      }
    }
    throw ultimoError;
  }
}
```

- [ ] **Step 5: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 6: Mostrar el estado**

Run: `git status --short`

---

### Task 5: Proveedores de precios y dólar (data912, dolarapi, argentinadatos)

**Files:**
- Create: `contratos/src/instrumentos.ts` · Modify: `contratos/src/index.ts`
- Create: `backend/src/proveedores/cotizaciones/proveedor-cotizaciones.ts`, `backend/src/proveedores/cotizaciones/data912.proveedor.ts`
- Create: `backend/src/proveedores/dolar/proveedor-dolar.ts`, `backend/src/proveedores/dolar/dolarapi.proveedor.ts`, `backend/src/proveedores/dolar/argentinadatos.proveedor.ts`
- Create: `backend/test/utilidades/proveedores-prueba.ts`
- Test: `backend/test/proveedores/data912.test.ts`, `backend/test/proveedores/dolar.test.ts`

**Interfaces:**
- Consumes: `ProveedorHttpBase`, `DatoConFecha`, `OpcionesProveedorHttp` (T4); `Decimal` (T3); fixtures (T3); `crearBuscarFalso`, `leerFixture` (T4).
- Produces:
  - contratos: `type TipoInstrumento = "ACCION" | "CEDEAR" | "ON" | "BONO" | "LETRA" | "FCI" | "ETF_EXTERIOR" | "CAUCION" | "PLAZO_FIJO" | "CRIPTO" | "OPCION" | "FUTURO" | "INDICE" | "OTRO"`
  - `type FamiliaMercado = "ACCIONES" | "CEDEARS" | "BONOS" | "OBLIGACIONES" | "LETRAS"`; `FAMILIAS_MERCADO: readonly FamiliaMercado[]`; `interface FilaMercado { simbolo: string; precio: Decimal; variacionPct: Decimal | null }`; `type ListasMercado = Record<FamiliaMercado, FilaMercado[]>`; `interface PuntoHistorico { fecha: string; cierre: Decimal }`; `interface ProveedorCotizaciones { listas(forzar?: boolean): Promise<DatoConFecha<ListasMercado>>; historico(familia: FamiliaMercado, simbolo: string): Promise<DatoConFecha<PuntoHistorico[]>> }`
  - `class Data912Proveedor(opciones & { ttlVivoMs?: number }) implements ProveedorCotizaciones`
  - `interface CotizacionDolar { tipo: TipoDolar; compra: Decimal | null; venta: Decimal; actualizadoEn: Date }`; `interface PuntoDolar { fecha: string; venta: Decimal }`; `interface ProveedorDolarActual { actuales(forzar?: boolean): Promise<DatoConFecha<CotizacionDolar[]>> }`; `interface ProveedorDolarHistorico { historico(tipo: TipoDolar): Promise<DatoConFecha<PuntoDolar[]>> }`; `interface ProveedorFeriados { feriados(anio: number): Promise<DatoConFecha<string[]>> }`; `CASA_POR_TIPO: Record<TipoDolar, string>`
  - `class DolarApiProveedor implements ProveedorDolarActual`; `class ArgentinaDatosProveedor implements ProveedorDolarHistorico, ProveedorFeriados`
  - (tests) `interface ProveedoresPrueba { cotizaciones: Data912Proveedor; dolarActual: DolarApiProveedor; argentinaDatos: ArgentinaDatosProveedor; buscar: BuscarFalso }`; `crearProveedoresPrueba(opciones?: { ahora?: () => Date; rutasExtra?: Record<string, RespuestaFalsa | RespuestaFalsa[]> }): ProveedoresPrueba`; `URLS` con las direcciones reales usadas

- [ ] **Step 1: Agregar el tipo de instrumento a los contratos**

`contratos/src/instrumentos.ts`:
```ts
import type { Moneda } from "./comunes";

export type TipoInstrumento =
  | "ACCION"
  | "CEDEAR"
  | "ON"
  | "BONO"
  | "LETRA"
  | "FCI"
  | "ETF_EXTERIOR"
  | "CAUCION"
  | "PLAZO_FIJO"
  | "CRIPTO"
  | "OPCION"
  | "FUTURO"
  | "INDICE"
  | "OTRO";

export interface PrecioManualDto {
  precio: number;
  moneda: Moneda;
  /** ISO 8601. */
  cargadoEn: string;
}

export interface InstrumentoDto {
  id: string;
  ticker: string;
  nombre: string | null;
  tipo: TipoInstrumento;
  /** "Obligación negociable". */
  tipoTexto: string;
  /** Monedas en las que cotiza. */
  monedas: Moneda[];
  factorPrecio: number;
  /** "Cotiza cada 100 nominales: el valor es cantidad × precio ÷ 100." */
  explicacionPrecio: string;
  emisor: string | null;
  sector: string | null;
  /** Precio cargado a mano por el usuario para cuando no hay cotización. */
  precioManual: PrecioManualDto | null;
}

export interface EditarInstrumentoEntrada {
  nombre?: string | null;
  emisor?: string | null;
  sector?: string | null;
}

export interface PrecioManualEntrada {
  precio: number;
  moneda: Moneda;
}
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./instrumentos";
```

- [ ] **Step 2: Crear las utilidades de proveedores de prueba**

`backend/test/utilidades/proveedores-prueba.ts`:
```ts
import { Data912Proveedor } from "../../src/proveedores/cotizaciones/data912.proveedor";
import { DolarApiProveedor } from "../../src/proveedores/dolar/dolarapi.proveedor";
import { ArgentinaDatosProveedor } from "../../src/proveedores/dolar/argentinadatos.proveedor";
import { crearBuscarFalso, leerFixture, type BuscarFalso, type RespuestaFalsa } from "./http-falso";

export const URLS = {
  acciones: "https://data912.com/live/arg_stocks",
  cedears: "https://data912.com/live/arg_cedears",
  bonos: "https://data912.com/live/arg_bonds",
  obligaciones: "https://data912.com/live/arg_corp",
  letras: "https://data912.com/live/arg_notes",
  historicoAmzn: "https://data912.com/historical/cedears/AMZN",
  historicoYpfd: "https://data912.com/historical/stocks/YPFD",
  dolares: "https://dolarapi.com/v1/dolares",
  mepHistorico: "https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa",
  feriados2026: "https://api.argentinadatos.com/v1/feriados/2026",
} as const;

/** Mediodía de un lunes hábil (15:00 en Argentina), el día en que se tomaron los fixtures. */
export const AHORA_FIXTURES = new Date("2026-09-28T18:00:00Z");

export function rutasDeFixtures(): Record<string, RespuestaFalsa> {
  return {
    [URLS.acciones]: { json: leerFixture("data912-arg_stocks.json") },
    [URLS.cedears]: { json: leerFixture("data912-arg_cedears.json") },
    [URLS.bonos]: { json: leerFixture("data912-arg_bonds.json") },
    [URLS.obligaciones]: { json: leerFixture("data912-arg_corp.json") },
    [URLS.letras]: { json: leerFixture("data912-arg_notes.json") },
    [URLS.historicoAmzn]: { json: leerFixture("data912-historico-cedears-AMZN.json") },
    [URLS.historicoYpfd]: { json: leerFixture("data912-historico-sin-datos.json") },
    [URLS.dolares]: { json: leerFixture("dolarapi-dolares.json") },
    [URLS.mepHistorico]: { json: leerFixture("argentinadatos-bolsa.json") },
    [URLS.feriados2026]: { json: leerFixture("argentinadatos-feriados-2026.json") },
  };
}

export interface ProveedoresPrueba {
  cotizaciones: Data912Proveedor;
  dolarActual: DolarApiProveedor;
  argentinaDatos: ArgentinaDatosProveedor;
  buscar: BuscarFalso;
}

export function crearProveedoresPrueba(
  opciones: {
    ahora?: () => Date;
    rutasExtra?: Record<string, RespuestaFalsa | RespuestaFalsa[]>;
  } = {},
): ProveedoresPrueba {
  const buscar = crearBuscarFalso({ ...rutasDeFixtures(), ...opciones.rutasExtra });
  const comunes = {
    buscar,
    ahora: opciones.ahora ?? (() => AHORA_FIXTURES),
    registrar: () => {},
    timeoutMs: 100,
    reintentos: 0,
  };
  return {
    cotizaciones: new Data912Proveedor(comunes),
    dolarActual: new DolarApiProveedor(comunes),
    argentinaDatos: new ArgentinaDatosProveedor(comunes),
    buscar,
  };
}
```

- [ ] **Step 3: Escribir los tests que fallan**

`backend/test/proveedores/data912.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ErrorProveedorExterno } from "../../src/compartido/errores";
import { crearProveedoresPrueba, URLS } from "../utilidades/proveedores-prueba";

describe("Data912Proveedor", () => {
  it("baja las cinco listas del mercado con precio y variación", async () => {
    const { cotizaciones, buscar } = crearProveedoresPrueba();
    const { valor, desactualizado } = await cotizaciones.listas();
    expect(desactualizado).toBe(false);
    const amzn = valor.CEDEARS.find((f) => f.simbolo === "AMZN");
    expect(amzn?.precio.toString()).toBe("2775");
    expect(amzn?.variacionPct?.toString()).toBe("-1.6");
    expect(valor.OBLIGACIONES.find((f) => f.simbolo === "YM39D")?.precio.toString()).toBe("110.2");
    expect(valor.LETRAS.find((f) => f.simbolo === "D30S6")?.precio.toString()).toBe("152300");
    expect(valor.BONOS.map((f) => f.simbolo)).toContain("AL30D");
    expect(buscar.llamadas).toHaveLength(5);
  });

  it("usa el promedio de compra y venta cuando no hubo operaciones y descarta filas sin precio", async () => {
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: {
        [URLS.acciones]: {
          json: [
            { symbol: "SINCIERRE", c: 0, px_bid: 100, px_ask: 110, pct_change: null },
            { symbol: "VACIO", c: 0, px_bid: 0, px_ask: 0, pct_change: 0 },
          ],
        },
      },
    });
    const { valor } = await cotizaciones.listas();
    expect(valor.ACCIONES.map((f) => [f.simbolo, f.precio.toString(), f.variacionPct])).toEqual([
      ["SINCIERRE", "105", null],
    ]);
  });

  it("histórico: devuelve los cierres diarios, y lista vacía cuando data912 no tiene el ticker", async () => {
    const { cotizaciones } = crearProveedoresPrueba();
    const amzn = await cotizaciones.historico("CEDEARS", "AMZN");
    expect(amzn.valor.at(-1)).toMatchObject({ fecha: "2026-09-25" });
    expect(amzn.valor.at(-1)?.cierre.toString()).toBe("2820");
    expect((await cotizaciones.historico("ACCIONES", "YPFD")).valor).toEqual([]);
  });

  it("histórico: las familias sin histórico no consultan la red", async () => {
    const { cotizaciones, buscar } = crearProveedoresPrueba();
    expect((await cotizaciones.historico("OBLIGACIONES", "YM39O")).valor).toEqual([]);
    expect(buscar.llamadas).toHaveLength(0);
  });

  it("si falla una sola lista, usa las demás y avisa que los datos pueden estar desactualizados", async () => {
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: { [URLS.letras]: new Error("socket hang up") },
    });
    const { valor, desactualizado } = await cotizaciones.listas();
    expect(desactualizado).toBe(true);
    expect(valor.LETRAS).toEqual([]);
    expect(valor.CEDEARS.length).toBeGreaterThan(0);
  });

  it("si no responde ninguna lista y no hay datos previos, falla con un mensaje llano", async () => {
    const caido = new Error("socket hang up");
    const { cotizaciones } = crearProveedoresPrueba({
      rutasExtra: {
        [URLS.acciones]: caido,
        [URLS.cedears]: caido,
        [URLS.bonos]: caido,
        [URLS.obligaciones]: caido,
        [URLS.letras]: caido,
      },
    });
    const error = await cotizaciones.listas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorProveedorExterno);
    expect((error as Error).message).toBe(
      "No pudimos obtener los precios del mercado. Probá de nuevo en unos minutos.",
    );
  });
});
```

`backend/test/proveedores/dolar.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { crearProveedoresPrueba } from "../utilidades/proveedores-prueba";

describe("DolarApiProveedor", () => {
  it("devuelve los dólares conocidos y descarta los que la app no usa", async () => {
    const { dolarActual } = crearProveedoresPrueba();
    const { valor } = await dolarActual.actuales();
    const mep = valor.find((d) => d.tipo === "MEP");
    expect(mep?.venta.toString()).toBe("1556.5");
    expect(mep?.actualizadoEn.toISOString()).toBe("2026-09-28T19:48:00.000Z");
    expect(valor.find((d) => d.tipo === "CCL")?.venta.toString()).toBe("1619.6");
    expect(valor.map((d) => d.tipo).sort()).toEqual(["BLUE", "CCL", "CRIPTO", "MAYORISTA", "MEP", "OFICIAL"]);
  });
});

describe("ArgentinaDatosProveedor", () => {
  it("histórico del dólar MEP por fecha", async () => {
    const { argentinaDatos } = crearProveedoresPrueba();
    const { valor } = await argentinaDatos.historico("MEP");
    expect(valor.at(-1)).toMatchObject({ fecha: "2026-09-28" });
    expect(valor.at(-1)?.venta.toString()).toBe("1557.3");
  });

  it("feriados del año como lista de fechas", async () => {
    const { argentinaDatos } = crearProveedoresPrueba();
    const { valor } = await argentinaDatos.feriados(2026);
    expect(valor).toContain("2026-10-12");
    expect(valor).toHaveLength(19);
  });
});
```

- [ ] **Step 4: Correrlos y ver que fallan**

Run: `npm test -w @cartera/backend -- test/proveedores`
Expected: FAIL — módulos inexistentes (el test de la Tarea 4 sigue pasando).

- [ ] **Step 5: Implementar el proveedor de cotizaciones**

`backend/src/proveedores/cotizaciones/proveedor-cotizaciones.ts`:
```ts
import type { Decimal } from "../../compartido/decimal";
import type { DatoConFecha } from "../http/proveedor-http-base";

export type FamiliaMercado = "ACCIONES" | "CEDEARS" | "BONOS" | "OBLIGACIONES" | "LETRAS";

export const FAMILIAS_MERCADO: readonly FamiliaMercado[] = [
  "ACCIONES",
  "CEDEARS",
  "BONOS",
  "OBLIGACIONES",
  "LETRAS",
];

export interface FilaMercado {
  simbolo: string;
  precio: Decimal;
  variacionPct: Decimal | null;
}

export type ListasMercado = Record<FamiliaMercado, FilaMercado[]>;

export interface PuntoHistorico {
  /** AAAA-MM-DD */
  fecha: string;
  cierre: Decimal;
}

export interface ProveedorCotizaciones {
  listas(forzar?: boolean): Promise<DatoConFecha<ListasMercado>>;
  historico(familia: FamiliaMercado, simbolo: string): Promise<DatoConFecha<PuntoHistorico[]>>;
}
```

`backend/src/proveedores/cotizaciones/data912.proveedor.ts`:
```ts
import { z } from "zod";
import { Decimal } from "../../compartido/decimal";
import {
  ProveedorHttpBase,
  type DatoConFecha,
  type OpcionesProveedorHttp,
} from "../http/proveedor-http-base";
import {
  FAMILIAS_MERCADO,
  type FamiliaMercado,
  type FilaMercado,
  type ListasMercado,
  type ProveedorCotizaciones,
  type PuntoHistorico,
} from "./proveedor-cotizaciones";

const URL_BASE = "https://data912.com";
const TTL_VIVO_POR_DEFECTO_MS = 60_000;
const TTL_HISTORICO_MS = 3_600_000;

const RUTA_VIVO: Record<FamiliaMercado, string> = {
  ACCIONES: "live/arg_stocks",
  CEDEARS: "live/arg_cedears",
  BONOS: "live/arg_bonds",
  OBLIGACIONES: "live/arg_corp",
  LETRAS: "live/arg_notes",
};

/** data912 solo tiene histórico de estas familias (las ONs y letras no). */
const RUTA_HISTORICO: Partial<Record<FamiliaMercado, string>> = {
  ACCIONES: "historical/stocks",
  CEDEARS: "historical/cedears",
  BONOS: "historical/bonds",
};

const numeroOpcional = z.number().nullable().optional();

const esquemaFila = z.object({
  symbol: z.string(),
  c: numeroOpcional,
  px_bid: numeroOpcional,
  px_ask: numeroOpcional,
  pct_change: numeroOpcional,
});

const esquemaPuntoHistorico = z.object({ date: z.string(), c: z.number() });

function decimalPositivo(valor: number | null | undefined): Decimal | null {
  return valor !== null && valor !== undefined && valor > 0 ? new Decimal(String(valor)) : null;
}

/** Último precio operado; si no hubo operaciones, el promedio entre compra y venta. */
function interpretarLista(json: unknown): FilaMercado[] {
  const filas: FilaMercado[] = [];
  for (const fila of z.array(esquemaFila).parse(json)) {
    const cierre = decimalPositivo(fila.c);
    const compra = decimalPositivo(fila.px_bid);
    const venta = decimalPositivo(fila.px_ask);
    const precio = cierre ?? (compra && venta ? compra.plus(venta).div(2) : null);
    if (!precio) continue;
    const variacion = fila.pct_change;
    filas.push({
      simbolo: fila.symbol,
      precio,
      variacionPct: variacion === null || variacion === undefined ? null : new Decimal(String(variacion)),
    });
  }
  return filas;
}

/** Cuando data912 no tiene el ticker responde un objeto con "Error": se toma como sin histórico. */
function interpretarHistorico(json: unknown): PuntoHistorico[] {
  if (!Array.isArray(json)) return [];
  return z
    .array(esquemaPuntoHistorico)
    .parse(json)
    .map((punto) => ({ fecha: punto.date, cierre: new Decimal(String(punto.c)) }));
}

export class Data912Proveedor extends ProveedorHttpBase implements ProveedorCotizaciones {
  protected readonly queSeObtiene = "los precios del mercado";
  private readonly ttlVivoMs: number;

  constructor(opciones: OpcionesProveedorHttp & { ttlVivoMs?: number } = {}) {
    super(opciones);
    this.ttlVivoMs = opciones.ttlVivoMs ?? TTL_VIVO_POR_DEFECTO_MS;
  }

  /**
   * Si falla alguna lista se usan las demás (marcando el dato como desactualizado);
   * solo si fallan todas se informa el error.
   */
  async listas(forzar = false): Promise<DatoConFecha<ListasMercado>> {
    const resultados = await Promise.allSettled(
      FAMILIAS_MERCADO.map((familia) =>
        this.obtener(
          `vivo:${familia}`,
          `${URL_BASE}/${RUTA_VIVO[familia]}`,
          this.ttlVivoMs,
          interpretarLista,
          forzar,
        ),
      ),
    );
    const obtenidos = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (obtenidos.length === 0) {
      const primero = resultados[0];
      throw primero?.status === "rejected" ? primero.reason : new Error("Sin listas");
    }
    const listas = Object.fromEntries(
      FAMILIAS_MERCADO.map((familia, indice) => {
        const resultado = resultados[indice];
        return [familia, resultado?.status === "fulfilled" ? resultado.value.valor : []];
      }),
    ) as ListasMercado;
    return {
      valor: listas,
      obtenidoEn: new Date(Math.min(...obtenidos.map((r) => r.obtenidoEn.getTime()))),
      desactualizado:
        obtenidos.length < resultados.length || obtenidos.some((r) => r.desactualizado),
    };
  }

  async historico(
    familia: FamiliaMercado,
    simbolo: string,
  ): Promise<DatoConFecha<PuntoHistorico[]>> {
    const ruta = RUTA_HISTORICO[familia];
    if (!ruta) return { valor: [], obtenidoEn: new Date(0), desactualizado: false };
    return this.obtener(
      `historico:${familia}:${simbolo}`,
      `${URL_BASE}/${ruta}/${encodeURIComponent(simbolo)}`,
      TTL_HISTORICO_MS,
      interpretarHistorico,
    );
  }
}
```

- [ ] **Step 6: Implementar los proveedores del dólar**

`backend/src/proveedores/dolar/proveedor-dolar.ts`:
```ts
import type { TipoDolar } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import type { DatoConFecha } from "../http/proveedor-http-base";

export interface CotizacionDolar {
  tipo: TipoDolar;
  compra: Decimal | null;
  venta: Decimal;
  actualizadoEn: Date;
}

export interface PuntoDolar {
  /** AAAA-MM-DD */
  fecha: string;
  venta: Decimal;
}

export interface ProveedorDolarActual {
  actuales(forzar?: boolean): Promise<DatoConFecha<CotizacionDolar[]>>;
}

export interface ProveedorDolarHistorico {
  historico(tipo: TipoDolar): Promise<DatoConFecha<PuntoDolar[]>>;
}

export interface ProveedorFeriados {
  /** Fechas AAAA-MM-DD en que el mercado no opera. */
  feriados(anio: number): Promise<DatoConFecha<string[]>>;
}

/** Nombre que usan dolarapi y argentinadatos para cada tipo de dólar. */
export const CASA_POR_TIPO: Record<TipoDolar, string> = {
  OFICIAL: "oficial",
  MEP: "bolsa",
  CCL: "contadoconliqui",
  BLUE: "blue",
  MAYORISTA: "mayorista",
  CRIPTO: "cripto",
};
```

`backend/src/proveedores/dolar/dolarapi.proveedor.ts`:
```ts
import { z } from "zod";
import type { TipoDolar } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import { ProveedorHttpBase, type DatoConFecha } from "../http/proveedor-http-base";
import { CASA_POR_TIPO, type CotizacionDolar, type ProveedorDolarActual } from "./proveedor-dolar";

const URL_DOLARES = "https://dolarapi.com/v1/dolares";
const TTL_MS = 60_000;

const TIPO_POR_CASA = new Map<string, TipoDolar>(
  Object.entries(CASA_POR_TIPO).map(([tipo, casa]) => [casa, tipo as TipoDolar]),
);

const esquema = z.array(
  z.object({
    casa: z.string(),
    compra: z.number().nullable(),
    venta: z.number(),
    fechaActualizacion: z.string(),
  }),
);

function interpretar(json: unknown): CotizacionDolar[] {
  const cotizaciones: CotizacionDolar[] = [];
  for (const fila of esquema.parse(json)) {
    const tipo = TIPO_POR_CASA.get(fila.casa);
    if (!tipo) continue;
    cotizaciones.push({
      tipo,
      compra: fila.compra === null ? null : new Decimal(String(fila.compra)),
      venta: new Decimal(String(fila.venta)),
      actualizadoEn: new Date(fila.fechaActualizacion),
    });
  }
  return cotizaciones;
}

export class DolarApiProveedor extends ProveedorHttpBase implements ProveedorDolarActual {
  protected readonly queSeObtiene = "el valor del dólar";

  actuales(forzar = false): Promise<DatoConFecha<CotizacionDolar[]>> {
    return this.obtener("dolares", URL_DOLARES, TTL_MS, interpretar, forzar);
  }
}
```

`backend/src/proveedores/dolar/argentinadatos.proveedor.ts`:
```ts
import { z } from "zod";
import type { TipoDolar } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import { ProveedorHttpBase, type DatoConFecha } from "../http/proveedor-http-base";
import {
  CASA_POR_TIPO,
  type ProveedorDolarHistorico,
  type ProveedorFeriados,
  type PuntoDolar,
} from "./proveedor-dolar";

const URL_BASE = "https://api.argentinadatos.com/v1";
const TTL_HISTORICO_MS = 6 * 3_600_000;
const TTL_FERIADOS_MS = 24 * 3_600_000;

const esquemaHistorico = z.array(z.object({ fecha: z.string(), venta: z.number() }));
const esquemaFeriados = z.array(z.object({ fecha: z.string() }));

export class ArgentinaDatosProveedor
  extends ProveedorHttpBase
  implements ProveedorDolarHistorico, ProveedorFeriados
{
  protected readonly queSeObtiene = "los datos históricos del dólar y los feriados";

  historico(tipo: TipoDolar): Promise<DatoConFecha<PuntoDolar[]>> {
    return this.obtener(
      `dolar:${tipo}`,
      `${URL_BASE}/cotizaciones/dolares/${CASA_POR_TIPO[tipo]}`,
      TTL_HISTORICO_MS,
      (json) =>
        esquemaHistorico
          .parse(json)
          .map((punto) => ({ fecha: punto.fecha, venta: new Decimal(String(punto.venta)) })),
    );
  }

  feriados(anio: number): Promise<DatoConFecha<string[]>> {
    return this.obtener(`feriados:${anio}`, `${URL_BASE}/feriados/${anio}`, TTL_FERIADOS_MS, (json) =>
      esquemaFeriados.parse(json).map((feriado) => feriado.fecha),
    );
  }
}
```

- [ ] **Step 7: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 8: Mostrar el estado**

Run: `git status --short`

---
### Task 6: Catálogo de instrumentos, búsqueda y precio manual

**Files:**
- Create: `backend/src/compartido/http/requiere-rol.ts`
- Create: `backend/src/modulos/instrumentos/textos.ts`, `catalogo.ts`, `instrumentos.repositorio.ts`, `precios-manuales.repositorio.ts`, `instrumentos.servicio.ts`, `instrumentos.esquemas.ts`, `instrumentos.controlador.ts`, `instrumentos.rutas.ts`, `index.ts` (todos en `backend/src/modulos/instrumentos/`)
- Modify: `backend/src/config/entorno.ts`, `backend/.env.example`, `backend/src/contenedor.ts` (reemplazo completo), `backend/src/app.ts`, `backend/test/utilidades/app-prueba.ts`
- Test: `backend/test/modulos/instrumentos/catalogo.test.ts`, `backend/test/modulos/instrumentos/instrumentos.api.test.ts`

**Interfaces:**
- Consumes: `ProveedorCotizaciones`, `FAMILIAS_MERCADO`, `ListasMercado`, `FamiliaMercado` (T5); `MONEDAS`, `esquemaDecimalPositivo`, `esquemaMoneda` (T3); `aJson` (plan 1); `crearProveedoresPrueba`, `AHORA_FIXTURES` (T5).
- Produces:
  - `requiereRol(rol: RolUsuario, mensaje?: string): RequestHandler`
  - `TEXTO_TIPO_INSTRUMENTO: Record<TipoInstrumento, string>`; `explicacionPrecio(factorPrecio: Decimal): string`
  - `type Simbolos = Partial<Record<Moneda, string>>`; `interface InstrumentoDeCatalogo { ticker; tipo: TipoInstrumento; simbolos: Simbolos; factorPrecio: Decimal }`; `derivarCatalogo(listas: ListasMercado): InstrumentoDeCatalogo[]`; `familiaDe(tipo: TipoInstrumento): FamiliaMercado | null`
  - `interface PrecioManual { precio: Decimal; moneda: Moneda; cargadoEn: Date }`
  - `interface InstrumentoCatalogado { id; ticker; nombre: string | null; tipo: TipoInstrumento; familia: FamiliaMercado | null; simbolos: Simbolos; factorPrecio: Decimal; tasaAnual: Decimal | null; emisor: string | null; sector: string | null }`
  - `class InstrumentosServicio` con `asegurarCatalogo()`, `sincronizar(): Promise<number>`, `buscar(usuarioId, q): Promise<InstrumentoDto[]>`, `obtener(usuarioId, id): Promise<InstrumentoDto>`, `catalogado(id): Promise<InstrumentoCatalogado>`, `catalogados(ids): Promise<Map<string, InstrumentoCatalogado>>`, `editar(usuarioId, id, entrada)`, `fijarPrecioManual(usuarioId, id, entrada: { precio: Decimal; moneda: Moneda })`, `quitarPrecioManual(usuarioId, id)`, `preciosManuales(usuarioId, ids): Promise<Map<string, PrecioManual>>`
  - `interface ModuloInstrumentos { servicio: InstrumentosServicio; rutas: Router }`; `crearModuloInstrumentos(bd, proveedor, ahora)`
  - `interface Proveedores { cotizaciones: ProveedorCotizaciones; dolarActual: ProveedorDolarActual; dolarHistorico: ProveedorDolarHistorico; feriados: ProveedorFeriados }`; `interface OpcionesContenedor { proveedores?: Proveedores; ahora?: () => Date }`; `crearContenedor(entorno, bd?, opciones?)`; `Contenedor` suma `proveedores`, `ahora`, `instrumentos`
  - Entorno suma `CACHE_COTIZACIONES_SEGUNDOS: number` (default 60)
  - (tests) `crearAppPrueba(extra?, opciones?: { proveedores?: ProveedoresPrueba; ahora?: () => Date })` devuelve además `buscar: BuscarFalso`; `registrarAdmin(prueba): Promise<UsuarioLogueado>`

- [ ] **Step 1: Escribir el test del catálogo (que falla)**

`backend/test/modulos/instrumentos/catalogo.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { derivarCatalogo } from "../../../src/modulos/instrumentos/catalogo";
import { Decimal } from "../../../src/compartido/decimal";
import type { ListasMercado } from "../../../src/proveedores/cotizaciones/proveedor-cotizaciones";
import { crearProveedoresPrueba } from "../../utilidades/proveedores-prueba";

async function catalogoDeFixtures() {
  const { valor } = await crearProveedoresPrueba().cotizaciones.listas();
  return new Map(derivarCatalogo(valor).map((i) => [i.ticker, i]));
}

function fila(simbolo: string) {
  return { simbolo, precio: new Decimal(1), variacionPct: null };
}

describe("derivarCatalogo", () => {
  it("agrupa las variantes en dólares con su instrumento en pesos", async () => {
    const catalogo = await catalogoDeFixtures();
    expect(catalogo.get("AMZN")).toMatchObject({
      tipo: "CEDEAR",
      simbolos: { ARS: "AMZN", USD_MEP: "AMZND", USD_CCL: "AMZNC" },
    });
    expect(catalogo.get("YPFD")?.simbolos).toEqual({ ARS: "YPFD", USD_MEP: "YPFDD" });
    expect(catalogo.has("AMZND")).toBe(false);
    expect(catalogo.has("YPF")).toBe(false);
  });

  it("las ONs se identifican por su ticker en O", async () => {
    const catalogo = await catalogoDeFixtures();
    expect(catalogo.get("YM39O")).toMatchObject({
      tipo: "ON",
      simbolos: { ARS: "YM39O", USD_MEP: "YM39D", USD_CCL: "YM39C" },
    });
    expect(catalogo.get("HVS1O")?.simbolos).toEqual({ ARS: "HVS1O", USD_MEP: "HVS1D" });
  });

  it("la renta fija cotiza cada 100 nominales y el resto por unidad", async () => {
    const catalogo = await catalogoDeFixtures();
    expect(catalogo.get("AL30")?.factorPrecio.toString()).toBe("0.01");
    expect(catalogo.get("YM39O")?.factorPrecio.toString()).toBe("0.01");
    expect(catalogo.get("D30S6")).toMatchObject({ tipo: "LETRA" });
    expect(catalogo.get("D30S6")?.factorPrecio.toString()).toBe("0.01");
    expect(catalogo.get("AMZN")?.factorPrecio.toString()).toBe("1");
  });

  it("arma un instrumento por ticker", async () => {
    expect((await catalogoDeFixtures()).size).toBe(38);
  });

  it("una ON que solo cotiza en dólares igual queda con su ticker en O", () => {
    const listas: ListasMercado = { ACCIONES: [], CEDEARS: [], BONOS: [], OBLIGACIONES: [fila("ZZZ1D")], LETRAS: [] };
    expect(derivarCatalogo(listas)).toEqual([
      { ticker: "ZZZ1O", tipo: "ON", simbolos: { USD_MEP: "ZZZ1D" }, factorPrecio: new Decimal("0.01") },
    ]);
  });

  it("un ticker repetido en dos familias queda una sola vez, con la primera", () => {
    const listas: ListasMercado = { ACCIONES: [fila("DUPL")], CEDEARS: [fila("DUPL")], BONOS: [], OBLIGACIONES: [], LETRAS: [] };
    expect(derivarCatalogo(listas).map((i) => [i.ticker, i.tipo])).toEqual([["DUPL", "ACCION"]]);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/instrumentos/catalogo`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar textos y catálogo**

`backend/src/modulos/instrumentos/textos.ts`:
```ts
import type { TipoInstrumento } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import { formatearNumero } from "../../compartido/formato";

export const TEXTO_TIPO_INSTRUMENTO: Record<TipoInstrumento, string> = {
  ACCION: "Acción",
  CEDEAR: "CEDEAR",
  ON: "Obligación negociable",
  BONO: "Bono",
  LETRA: "Letra",
  FCI: "Fondo común de inversión",
  ETF_EXTERIOR: "ETF del exterior",
  CAUCION: "Caución",
  PLAZO_FIJO: "Plazo fijo",
  CRIPTO: "Cripto",
  OPCION: "Opción",
  FUTURO: "Futuro",
  INDICE: "Índice",
  OTRO: "Otro",
};

export function explicacionPrecio(factorPrecio: Decimal): string {
  if (factorPrecio.eq(1)) return "Cotiza por unidad: el valor es cantidad × precio.";
  const nominales = formatearNumero(new Decimal(1).div(factorPrecio), 0);
  return `Cotiza cada ${nominales} nominales: el valor es cantidad × precio ÷ ${nominales}.`;
}
```

`backend/src/modulos/instrumentos/catalogo.ts`:
```ts
import type { Moneda, TipoInstrumento } from "@cartera/contratos";
import { Decimal } from "../../compartido/decimal";
import {
  FAMILIAS_MERCADO,
  type FamiliaMercado,
  type ListasMercado,
} from "../../proveedores/cotizaciones/proveedor-cotizaciones";

export type Simbolos = Partial<Record<Moneda, string>>;

export interface InstrumentoDeCatalogo {
  ticker: string;
  tipo: TipoInstrumento;
  simbolos: Simbolos;
  factorPrecio: Decimal;
}

const TIPO_POR_FAMILIA: Record<FamiliaMercado, TipoInstrumento> = {
  ACCIONES: "ACCION",
  CEDEARS: "CEDEAR",
  BONOS: "BONO",
  OBLIGACIONES: "ON",
  LETRAS: "LETRA",
};

const FAMILIA_POR_TIPO = new Map<TipoInstrumento, FamiliaMercado>(
  FAMILIAS_MERCADO.map((familia) => [TIPO_POR_FAMILIA[familia], familia]),
);

const FAMILIAS_RENTA_FIJA: ReadonlySet<FamiliaMercado> = new Set(["BONOS", "OBLIGACIONES", "LETRAS"]);
/** La renta fija cotiza cada 100 de valor nominal. */
const FACTOR_RENTA_FIJA = new Decimal("0.01");
const FACTOR_UNITARIO = new Decimal(1);

/** data912 marca las variantes en dólares con un sufijo: D = MEP, C = cable. */
const MONEDA_POR_SUFIJO: Record<string, Moneda> = { D: "USD_MEP", C: "USD_CCL" };

export function familiaDe(tipo: TipoInstrumento): FamiliaMercado | null {
  return FAMILIA_POR_TIPO.get(tipo) ?? null;
}

function varianteDe(
  simbolo: string,
  simbolos: ReadonlySet<string>,
  familia: FamiliaMercado,
): { base: string; moneda: Moneda } | null {
  const moneda = MONEDA_POR_SUFIJO[simbolo.slice(-1)];
  if (!moneda) return null;
  const raiz = simbolo.slice(0, -1);
  if (simbolos.has(raiz)) return { base: raiz, moneda };
  // Las ONs en pesos terminan en O (YM39O ↔ YM39D): si solo cotiza en dólares, igual se nombra así.
  if (familia === "OBLIGACIONES" && raiz.length > 0) return { base: `${raiz}O`, moneda };
  return null;
}

/** Un instrumento por ticker, con el símbolo de data912 para cada moneda en que cotiza. */
export function derivarCatalogo(listas: ListasMercado): InstrumentoDeCatalogo[] {
  const porTicker = new Map<string, InstrumentoDeCatalogo>();
  for (const familia of FAMILIAS_MERCADO) {
    const simbolos = new Set(listas[familia].map((fila) => fila.simbolo));
    const deLaFamilia = new Map<string, InstrumentoDeCatalogo>();
    for (const simbolo of simbolos) {
      const variante = varianteDe(simbolo, simbolos, familia);
      const ticker = variante?.base ?? simbolo;
      let instrumento = deLaFamilia.get(ticker);
      if (!instrumento) {
        instrumento = {
          ticker,
          tipo: TIPO_POR_FAMILIA[familia],
          simbolos: {},
          factorPrecio: FAMILIAS_RENTA_FIJA.has(familia) ? FACTOR_RENTA_FIJA : FACTOR_UNITARIO,
        };
        deLaFamilia.set(ticker, instrumento);
      }
      instrumento.simbolos[variante?.moneda ?? "ARS"] = simbolo;
    }
    // El catálogo es único por ticker: si aparece en dos familias queda la primera.
    for (const [ticker, instrumento] of deLaFamilia) {
      if (!porTicker.has(ticker)) porTicker.set(ticker, instrumento);
    }
  }
  return [...porTicker.values()];
}
```

- [ ] **Step 4: Correr el test del catálogo**

Run: `npm test -w @cartera/backend -- test/modulos/instrumentos/catalogo`
Expected: 6 tests PASS.

- [ ] **Step 5: Agregar la caché al entorno**

En `backend/src/config/entorno.ts`, debajo de `TRUST_PROXY: booleano.default(false),`, agregar:
```ts
  /** Segundos que se reutilizan los precios del mercado antes de volver a pedirlos. */
  CACHE_COTIZACIONES_SEGUNDOS: entero.default(60),
```

Al final de `backend/.env.example`, agregar:
```bash

# Segundos que se reutilizan los precios del mercado antes de volver a pedirlos
CACHE_COTIZACIONES_SEGUNDOS=60
```

- [ ] **Step 6: Escribir el test de API (que falla)**

En `backend/test/utilidades/app-prueba.ts`, reemplazar la función `crearAppPrueba` y la interfaz `AppPrueba` por:
```ts
export interface AppPrueba {
  app: Express;
  bd: PrismaClient;
  /** Registra las URLs externas pedidas (fixtures, sin red). */
  buscar: BuscarFalso;
  cerrar: () => Promise<void>;
}

export interface OpcionesAppPrueba {
  proveedores?: ProveedoresPrueba;
  ahora?: () => Date;
}

export async function crearAppPrueba(
  extra: Record<string, string> = {},
  opciones: OpcionesAppPrueba = {},
): Promise<AppPrueba> {
  const { bd, cerrar } = await crearBasePrueba();
  const ahora = opciones.ahora ?? (() => AHORA_FIXTURES);
  const proveedores = opciones.proveedores ?? crearProveedoresPrueba({ ahora });
  const contenedor = crearContenedor(entornoPrueba(extra), bd, {
    ahora,
    proveedores: {
      cotizaciones: proveedores.cotizaciones,
      dolarActual: proveedores.dolarActual,
      dolarHistorico: proveedores.argentinaDatos,
      feriados: proveedores.argentinaDatos,
    },
  });
  return { app: crearApp(contenedor), bd, buscar: proveedores.buscar, cerrar };
}
```
y agregar al final del archivo:
```ts
/** Usuario con rol ADMIN (el registro crea USUARIO): se promueve en la base y se vuelve a loguear. */
export async function registrarAdmin(prueba: AppPrueba): Promise<UsuarioLogueado> {
  const registrado = await registrarUsuario(prueba.app);
  await prueba.bd.usuario.update({ where: { id: registrado.usuario.id }, data: { rol: "ADMIN" } });
  const login = await request(prueba.app)
    .post("/api/auth/login")
    .send({ email: registrado.usuario.email, password: "clave-segura-123" })
    .expect(200);
  const sesion = login.body as SesionRespuesta;
  return { token: sesion.tokenAcceso, cookie: extraerCookieRefresh(login), usuario: sesion.usuario };
}
```
y sumar estos imports al principio del archivo:
```ts
import type { BuscarFalso } from "./http-falso";
import { AHORA_FIXTURES, crearProveedoresPrueba, type ProveedoresPrueba } from "./proveedores-prueba";
```

`backend/test/modulos/instrumentos/instrumentos.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { InstrumentoDto } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarAdmin,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";
import { crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";

describe("API de instrumentos", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  async function buscar(q: string, usuario = ana): Promise<InstrumentoDto[]> {
    const respuesta = await request(prueba.app)
      .get(`/api/instrumentos/buscar?q=${encodeURIComponent(q)}`)
      .set(auth(usuario))
      .expect(200);
    return respuesta.body as InstrumentoDto[];
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("busca por parte del ticker y explica cómo cotiza", async () => {
    const [amzn] = await buscar("amz");
    expect(amzn).toMatchObject({
      ticker: "AMZN",
      tipo: "CEDEAR",
      tipoTexto: "CEDEAR",
      monedas: ["ARS", "USD_MEP", "USD_CCL"],
      factorPrecio: 1,
      explicacionPrecio: "Cotiza por unidad: el valor es cantidad × precio.",
      precioManual: null,
    });
  });

  it("buscar el símbolo en dólares encuentra la ON por su ticker en O", async () => {
    const [primero] = await buscar("YM39D");
    expect(primero).toMatchObject({
      ticker: "YM39O",
      tipoTexto: "Obligación negociable",
      factorPrecio: 0.01,
      explicacionPrecio: "Cotiza cada 100 nominales: el valor es cantidad × precio ÷ 100.",
    });
  });

  it("sincroniza el catálogo una sola vez (no en cada búsqueda)", async () => {
    await buscar("GGAL");
    await buscar("PAMP");
    const listas = prueba.buscar.llamadas.filter((url) => url.includes("/live/"));
    expect(listas).toHaveLength(5);
  });

  it("sin texto de búsqueda responde un 400 explicado", async () => {
    const respuesta = await request(prueba.app).get("/api/instrumentos/buscar?q=%20").set(auth(ana));
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].mensaje).toBe("Escribí el ticker o parte del ticker.");
  });

  it("un activo inexistente da 404 en castellano", async () => {
    const respuesta = await request(prueba.app).get("/api/instrumentos/no-existe").set(auth(ana));
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró el activo.");
  });

  it("el precio manual es de cada usuario y se puede quitar", async () => {
    const [ym39] = await buscar("YM39O");
    const ruta = `/api/instrumentos/${ym39?.id}/precio-manual`;
    const fijado = await request(prueba.app).put(ruta).set(auth(ana)).send({ precio: 108.5, moneda: "USD_MEP" });
    expect(fijado.status).toBe(200);
    expect(fijado.body.precioManual).toMatchObject({ precio: 108.5, moneda: "USD_MEP" });
    const [vistoPorBeto] = await buscar("YM39O", beto);
    expect(vistoPorBeto?.precioManual).toBeNull();
    const quitado = await request(prueba.app).delete(ruta).set(auth(ana));
    expect(quitado.body.precioManual).toBeNull();
  });

  it("el precio manual se valida con mensajes llanos", async () => {
    const [ym39] = await buscar("YM39O");
    const respuesta = await request(prueba.app)
      .put(`/api/instrumentos/${ym39?.id}/precio-manual`)
      .set(auth(ana))
      .send({ precio: -3, moneda: "EUR" });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles.map((d: { mensaje: string }) => d.mensaje)).toEqual([
      "Tiene que ser un número mayor a cero.",
      "Elegí la moneda: pesos, dólar MEP, dólar cable o dólar del exterior.",
    ]);
  });

  it("solo un administrador puede editar los datos del catálogo", async () => {
    const [amzn] = await buscar("AMZN");
    const ruta = `/api/instrumentos/${amzn?.id}`;
    const comoUsuario = await request(prueba.app).patch(ruta).set(auth(ana)).send({ nombre: "Amazon" });
    expect(comoUsuario.status).toBe(403);
    expect(comoUsuario.body.error.mensaje).toBe("Solo un administrador puede cambiar los datos del catálogo.");
    const admin = await registrarAdmin(prueba);
    const comoAdmin = await request(prueba.app).patch(ruta).set(auth(admin)).send({ nombre: "Amazon", sector: "Comercio" });
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body).toMatchObject({ nombre: "Amazon", sector: "Comercio" });
  });
});

describe("API de instrumentos sin data912", () => {
  it("con el catálogo vacío y data912 caído, explica el problema sin detalles técnicos", async () => {
    const caido = new Error("getaddrinfo ENOTFOUND data912.com");
    const proveedores = crearProveedoresPrueba({
      rutasExtra: Object.fromEntries(
        [URLS.acciones, URLS.cedears, URLS.bonos, URLS.obligaciones, URLS.letras].map((u) => [u, caido]),
      ),
    });
    const prueba = await crearAppPrueba({}, { proveedores });
    const usuario = await registrarUsuario(prueba.app);
    const respuesta = await request(prueba.app)
      .get("/api/instrumentos/buscar?q=AMZN")
      .set({ Authorization: `Bearer ${usuario.token}` });
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.error.mensaje).toBe(
      "No pudimos obtener los precios del mercado. Probá de nuevo en unos minutos.",
    );
    expect(JSON.stringify(respuesta.body)).not.toMatch(/ENOTFOUND|data912/);
    await prueba.cerrar();
  });
});
```

- [ ] **Step 7: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/instrumentos/instrumentos.api`
Expected: FAIL — `crearContenedor` no acepta opciones y `/api/instrumentos` no existe.

- [ ] **Step 8: Implementar la autorización por rol**

`backend/src/compartido/http/requiere-rol.ts`:
```ts
import type { RequestHandler } from "express";
import type { RolUsuario } from "@cartera/contratos";
import { ErrorProhibido } from "../errores";
import { usuarioDe } from "./usuario-de";

export function requiereRol(rol: RolUsuario, mensaje?: string): RequestHandler {
  return (req, _res, next) => {
    if (usuarioDe(req).rol !== rol) throw new ErrorProhibido(mensaje);
    next();
  };
}
```

- [ ] **Step 9: Implementar los repositorios**

`backend/src/modulos/instrumentos/instrumentos.repositorio.ts`:
```ts
import type { Instrumento, Prisma, PrismaClient } from "../../generado/prisma/client";
import { aJson } from "../../compartido/json";
import type { InstrumentoDeCatalogo } from "./catalogo";

const MERCADO = "BYMA";
/** Más de mil activos: la sincronización necesita más que el límite por defecto de 5 s. */
const TIMEOUT_SINCRONIZACION_MS = 120_000;

export type EdicionInstrumento = Pick<Prisma.InstrumentoUpdateInput, "nombre" | "emisor" | "sector">;

/** Catálogo compartido por todos los usuarios: no se borra, se desactiva. */
export class InstrumentosRepositorio {
  constructor(private readonly bd: PrismaClient) {}

  contar(): Promise<number> {
    return this.bd.instrumento.count();
  }

  /** Alta o actualización de cada activo. No toca los datos que completan las personas. */
  async sincronizar(items: readonly InstrumentoDeCatalogo[]): Promise<void> {
    await this.bd.$transaction(
      async (tx) => {
        for (const item of items) {
          const datos = {
            tipo: item.tipo,
            simbolos: aJson(item.simbolos),
            factorPrecio: item.factorPrecio.toString(),
          };
          await tx.instrumento.upsert({
            where: { ticker_mercado: { ticker: item.ticker, mercado: MERCADO } },
            create: {
              ...datos,
              ticker: item.ticker,
              mercado: MERCADO,
              tickerSubyacente: item.tipo === "CEDEAR" ? item.ticker : null,
            },
            update: datos,
          });
        }
      },
      { timeout: TIMEOUT_SINCRONIZACION_MS },
    );
  }

  porTickers(tickers: readonly string[]): Promise<Instrumento[]> {
    return this.bd.instrumento.findMany({ where: { ticker: { in: [...tickers] }, activo: true } });
  }

  porPrefijo(prefijo: string, limite: number): Promise<Instrumento[]> {
    return this.bd.instrumento.findMany({
      where: { ticker: { startsWith: prefijo }, activo: true },
      orderBy: { ticker: "asc" },
      take: limite,
    });
  }

  porIds(ids: readonly string[]): Promise<Instrumento[]> {
    return this.bd.instrumento.findMany({ where: { id: { in: [...ids] } } });
  }

  buscarPorId(id: string): Promise<Instrumento | null> {
    return this.bd.instrumento.findUnique({ where: { id } });
  }

  editar(id: string, datos: EdicionInstrumento): Promise<Instrumento> {
    return this.bd.instrumento.update({ where: { id }, data: datos });
  }
}
```

`backend/src/modulos/instrumentos/precios-manuales.repositorio.ts`:
```ts
import type { Moneda } from "@cartera/contratos";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { aDecimal, type Decimal } from "../../compartido/decimal";

export interface PrecioManual {
  precio: Decimal;
  moneda: Moneda;
  cargadoEn: Date;
}

/** Precio que carga cada usuario para un activo que no tiene cotización. */
export class PreciosManualesRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  async deUsuario(usuarioId: string, instrumentoIds: readonly string[]): Promise<Map<string, PrecioManual>> {
    const filas = await this.bd.instrumentoUsuario.findMany({
      where: { usuarioId, instrumentoId: { in: [...instrumentoIds] }, precioManual: { not: null } },
    });
    const precios = new Map<string, PrecioManual>();
    for (const fila of filas) {
      if (fila.precioManual && fila.precioManualMoneda && fila.precioManualEn) {
        precios.set(fila.instrumentoId, {
          precio: aDecimal(fila.precioManual),
          moneda: fila.precioManualMoneda,
          cargadoEn: fila.precioManualEn,
        });
      }
    }
    return precios;
  }

  async fijar(
    usuarioId: string,
    instrumentoId: string,
    precio: Decimal,
    moneda: Moneda,
    ahora: Date,
  ): Promise<void> {
    const datos = { precioManual: precio.toString(), precioManualMoneda: moneda, precioManualEn: ahora };
    await this.bd.instrumentoUsuario.upsert({
      where: { usuarioId_instrumentoId: { usuarioId, instrumentoId } },
      create: { usuarioId, instrumentoId, ...datos },
      update: datos,
    });
  }

  async quitar(usuarioId: string, instrumentoId: string): Promise<void> {
    await this.bd.instrumentoUsuario.updateMany({
      where: { usuarioId, instrumentoId },
      data: { precioManual: null, precioManualMoneda: null, precioManualEn: null },
    });
  }
}
```

- [ ] **Step 10: Implementar el servicio**

`backend/src/modulos/instrumentos/instrumentos.servicio.ts`:
```ts
import { z } from "zod";
import type {
  EditarInstrumentoEntrada,
  InstrumentoDto,
  Moneda,
  TipoInstrumento,
} from "@cartera/contratos";
import type { Instrumento } from "../../generado/prisma/client";
import { aDecimal, aNumero, type Decimal } from "../../compartido/decimal";
import { ErrorNoEncontrado, ErrorProveedorExterno } from "../../compartido/errores";
import { MONEDAS } from "../../compartido/esquemas";
import type {
  FamiliaMercado,
  ProveedorCotizaciones,
} from "../../proveedores/cotizaciones/proveedor-cotizaciones";
import { derivarCatalogo, familiaDe, type Simbolos } from "./catalogo";
import type { InstrumentosRepositorio } from "./instrumentos.repositorio";
import type { PrecioManual, PreciosManualesRepositorio } from "./precios-manuales.repositorio";
import { TEXTO_TIPO_INSTRUMENTO, explicacionPrecio } from "./textos";

const VIGENCIA_CATALOGO_MS = 24 * 3_600_000;
/** Si data912 falla con el catálogo ya cargado, se reintenta recién después de este tiempo. */
const ESPERA_REINTENTO_MS = 5 * 60_000;
const LIMITE_BUSQUEDA = 10;
const DECIMALES_PRECIO = 6;
const SUFIJO_VARIANTE = /[DC]$/;

const esquemaSimbolos = z.partialRecord(z.enum(MONEDAS), z.string());

export interface InstrumentoCatalogado {
  id: string;
  ticker: string;
  nombre: string | null;
  tipo: TipoInstrumento;
  familia: FamiliaMercado | null;
  simbolos: Simbolos;
  factorPrecio: Decimal;
  /** Tasa nominal anual en porcentaje, para los instrumentos que devengan (plazo fijo, caución). */
  tasaAnual: Decimal | null;
  emisor: string | null;
  sector: string | null;
}

function aCatalogado(instrumento: Instrumento): InstrumentoCatalogado {
  const simbolos = esquemaSimbolos.safeParse(instrumento.simbolos);
  return {
    id: instrumento.id,
    ticker: instrumento.ticker,
    nombre: instrumento.nombre,
    tipo: instrumento.tipo,
    familia: familiaDe(instrumento.tipo),
    simbolos: simbolos.success ? simbolos.data : {},
    factorPrecio: aDecimal(instrumento.factorPrecio),
    tasaAnual: instrumento.tasaCupon ? aDecimal(instrumento.tasaCupon) : null,
    emisor: instrumento.emisor,
    sector: instrumento.sector,
  };
}

function aDto(instrumento: InstrumentoCatalogado, manual: PrecioManual | undefined): InstrumentoDto {
  return {
    id: instrumento.id,
    ticker: instrumento.ticker,
    nombre: instrumento.nombre,
    tipo: instrumento.tipo,
    tipoTexto: TEXTO_TIPO_INSTRUMENTO[instrumento.tipo],
    monedas: MONEDAS.filter((moneda: Moneda) => instrumento.simbolos[moneda] !== undefined),
    factorPrecio: aNumero(instrumento.factorPrecio, DECIMALES_PRECIO),
    explicacionPrecio: explicacionPrecio(instrumento.factorPrecio),
    emisor: instrumento.emisor,
    sector: instrumento.sector,
    precioManual: manual
      ? {
          precio: aNumero(manual.precio, DECIMALES_PRECIO),
          moneda: manual.moneda,
          cargadoEn: manual.cargadoEn.toISOString(),
        }
      : null,
  };
}

/** "YM39D" → también "YM39" y "YM39O", para encontrar el activo por su símbolo en dólares. */
function tickersCandidatos(busqueda: string): string[] {
  if (!SUFIJO_VARIANTE.test(busqueda) || busqueda.length < 2) return [busqueda];
  const raiz = busqueda.slice(0, -1);
  return [busqueda, raiz, `${raiz}O`];
}

export class InstrumentosServicio {
  private ultimaSincronizacion: Date | null = null;
  private proximoIntento: Date | null = null;

  constructor(
    private readonly instrumentos: InstrumentosRepositorio,
    private readonly precios: PreciosManualesRepositorio,
    private readonly proveedor: ProveedorCotizaciones,
    private readonly ahora: () => Date,
  ) {}

  /** Sincroniza con data912 si el catálogo está vacío o tiene más de un día. */
  async asegurarCatalogo(): Promise<void> {
    const ahora = this.ahora().getTime();
    const vigente =
      this.ultimaSincronizacion !== null &&
      ahora - this.ultimaSincronizacion.getTime() < VIGENCIA_CATALOGO_MS;
    const esperando = this.proximoIntento !== null && ahora < this.proximoIntento.getTime();
    if (vigente || esperando) return;
    const hayCatalogo = (await this.instrumentos.contar()) > 0;
    try {
      await this.sincronizar();
    } catch (error) {
      if (!hayCatalogo || !(error instanceof ErrorProveedorExterno)) throw error;
      // Con catálogo cargado se sigue trabajando; se reintenta más tarde.
      this.proximoIntento = new Date(ahora + ESPERA_REINTENTO_MS);
    }
  }

  async sincronizar(): Promise<number> {
    const listas = await this.proveedor.listas();
    const items = derivarCatalogo(listas.valor);
    await this.instrumentos.sincronizar(items);
    this.ultimaSincronizacion = this.ahora();
    this.proximoIntento = null;
    return items.length;
  }

  async buscar(usuarioId: string, busqueda: string): Promise<InstrumentoDto[]> {
    await this.asegurarCatalogo();
    const candidatos = tickersCandidatos(busqueda);
    const exactos = await this.instrumentos.porTickers(candidatos);
    exactos.sort((a, b) => candidatos.indexOf(a.ticker) - candidatos.indexOf(b.ticker));
    const porPrefijo = await this.instrumentos.porPrefijo(busqueda, LIMITE_BUSQUEDA);
    const vistos = new Set<string>();
    const resultado = [...exactos, ...porPrefijo]
      .filter((instrumento) => !vistos.has(instrumento.id) && vistos.add(instrumento.id))
      .slice(0, LIMITE_BUSQUEDA)
      .map(aCatalogado);
    const manuales = await this.precios.deUsuario(usuarioId, resultado.map((i) => i.id));
    return resultado.map((instrumento) => aDto(instrumento, manuales.get(instrumento.id)));
  }

  async obtener(usuarioId: string, id: string): Promise<InstrumentoDto> {
    const instrumento = await this.catalogado(id);
    const manuales = await this.precios.deUsuario(usuarioId, [id]);
    return aDto(instrumento, manuales.get(id));
  }

  async catalogado(id: string): Promise<InstrumentoCatalogado> {
    const instrumento = await this.instrumentos.buscarPorId(id);
    if (!instrumento) throw new ErrorNoEncontrado("el activo");
    return aCatalogado(instrumento);
  }

  async catalogados(ids: readonly string[]): Promise<Map<string, InstrumentoCatalogado>> {
    const instrumentos = await this.instrumentos.porIds(ids);
    return new Map(instrumentos.map((instrumento) => [instrumento.id, aCatalogado(instrumento)]));
  }

  async editar(usuarioId: string, id: string, entrada: EditarInstrumentoEntrada): Promise<InstrumentoDto> {
    await this.catalogado(id);
    await this.instrumentos.editar(id, entrada);
    return this.obtener(usuarioId, id);
  }

  async fijarPrecioManual(
    usuarioId: string,
    id: string,
    entrada: { precio: Decimal; moneda: Moneda },
  ): Promise<InstrumentoDto> {
    await this.catalogado(id);
    await this.precios.fijar(usuarioId, id, entrada.precio, entrada.moneda, this.ahora());
    return this.obtener(usuarioId, id);
  }

  async quitarPrecioManual(usuarioId: string, id: string): Promise<InstrumentoDto> {
    await this.catalogado(id);
    await this.precios.quitar(usuarioId, id);
    return this.obtener(usuarioId, id);
  }

  preciosManuales(usuarioId: string, ids: readonly string[]): Promise<Map<string, PrecioManual>> {
    return this.precios.deUsuario(usuarioId, ids);
  }
}
```

- [ ] **Step 11: Implementar esquemas, controlador, rutas y módulo**

`backend/src/modulos/instrumentos/instrumentos.esquemas.ts`:
```ts
import { z } from "zod";
import type { EditarInstrumentoEntrada } from "@cartera/contratos";
import { esquemaDecimalPositivo, esquemaMoneda } from "../../compartido/esquemas";

const LARGO_MAXIMO_TICKER = 20;
const LARGO_MAXIMO_TEXTO = 120;
const MENSAJE_BUSQUEDA = "Escribí el ticker o parte del ticker.";

export const esquemaBusqueda = z.object({
  q: z
    .string({ message: MENSAJE_BUSQUEDA })
    .trim()
    .min(1, MENSAJE_BUSQUEDA)
    .max(LARGO_MAXIMO_TICKER, `El ticker puede tener hasta ${LARGO_MAXIMO_TICKER} caracteres.`)
    .transform((texto) => texto.toUpperCase()),
});

const textoOpcional = z
  .string()
  .trim()
  .max(LARGO_MAXIMO_TEXTO, `Puede tener hasta ${LARGO_MAXIMO_TEXTO} caracteres.`)
  .nullable()
  .optional();

export const esquemaEditarInstrumento = z
  .object({ nombre: textoOpcional, emisor: textoOpcional, sector: textoOpcional })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: "No mandaste ningún cambio.",
  }) satisfies z.ZodType<EditarInstrumentoEntrada>;

export const esquemaPrecioManual = z.object({
  precio: esquemaDecimalPositivo,
  moneda: esquemaMoneda,
});
```

`backend/src/modulos/instrumentos/instrumentos.controlador.ts`:
```ts
import type { RequestHandler } from "express";
import { parametro } from "../../compartido/http/parametros";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import {
  esquemaBusqueda,
  esquemaEditarInstrumento,
  esquemaPrecioManual,
} from "./instrumentos.esquemas";
import type { InstrumentosServicio } from "./instrumentos.servicio";

export class InstrumentosControlador {
  constructor(private readonly servicio: InstrumentosServicio) {}

  readonly buscar: RequestHandler = async (req, res) => {
    const { q } = validar(esquemaBusqueda, req.query);
    res.json(await this.servicio.buscar(usuarioDe(req).id, q));
  };

  readonly obtener: RequestHandler = async (req, res) => {
    res.json(await this.servicio.obtener(usuarioDe(req).id, parametro(req, "id")));
  };

  readonly editar: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaEditarInstrumento, req.body);
    res.json(await this.servicio.editar(usuarioDe(req).id, parametro(req, "id"), entrada));
  };

  readonly fijarPrecioManual: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaPrecioManual, req.body);
    res.json(await this.servicio.fijarPrecioManual(usuarioDe(req).id, parametro(req, "id"), entrada));
  };

  readonly quitarPrecioManual: RequestHandler = async (req, res) => {
    res.json(await this.servicio.quitarPrecioManual(usuarioDe(req).id, parametro(req, "id")));
  };
}
```

`backend/src/modulos/instrumentos/instrumentos.rutas.ts`:
```ts
import { Router } from "express";
import { requiereRol } from "../../compartido/http/requiere-rol";
import type { InstrumentosControlador } from "./instrumentos.controlador";

export function crearRutasInstrumentos(controlador: InstrumentosControlador): Router {
  const rutas = Router();
  rutas.get("/buscar", controlador.buscar);
  rutas.get("/:id", controlador.obtener);
  rutas.patch(
    "/:id",
    requiereRol("ADMIN", "Solo un administrador puede cambiar los datos del catálogo."),
    controlador.editar,
  );
  rutas.put("/:id/precio-manual", controlador.fijarPrecioManual);
  rutas.delete("/:id/precio-manual", controlador.quitarPrecioManual);
  return rutas;
}
```

`backend/src/modulos/instrumentos/index.ts`:
```ts
import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { ProveedorCotizaciones } from "../../proveedores/cotizaciones/proveedor-cotizaciones";
import { InstrumentosControlador } from "./instrumentos.controlador";
import { InstrumentosRepositorio } from "./instrumentos.repositorio";
import { crearRutasInstrumentos } from "./instrumentos.rutas";
import { InstrumentosServicio } from "./instrumentos.servicio";
import { PreciosManualesRepositorio } from "./precios-manuales.repositorio";

export type { InstrumentosServicio, InstrumentoCatalogado } from "./instrumentos.servicio";
export type { PrecioManual } from "./precios-manuales.repositorio";
export type { Simbolos } from "./catalogo";
export { familiaDe } from "./catalogo";
export { TEXTO_TIPO_INSTRUMENTO, explicacionPrecio } from "./textos";

export interface ModuloInstrumentos {
  servicio: InstrumentosServicio;
  rutas: Router;
}

export function crearModuloInstrumentos(
  bd: PrismaClient,
  proveedor: ProveedorCotizaciones,
  ahora: () => Date,
): ModuloInstrumentos {
  const servicio = new InstrumentosServicio(
    new InstrumentosRepositorio(bd),
    new PreciosManualesRepositorio(bd),
    proveedor,
    ahora,
  );
  return { servicio, rutas: crearRutasInstrumentos(new InstrumentosControlador(servicio)) };
}
```

- [ ] **Step 12: Contenedor con proveedores inyectables**

Reemplazar todo `backend/src/contenedor.ts` por:
```ts
import type { PrismaClient } from "./generado/prisma/client";
import type { Entorno } from "./config/entorno";
import { crearClienteBD } from "./compartido/base-datos/cliente";
import { AuditoriaRepositorio } from "./compartido/auditoria/auditoria.repositorio";
import { crearModuloAutenticacion, type ModuloAutenticacion } from "./modulos/autenticacion";
import { crearModuloCarteras, type ModuloCarteras } from "./modulos/carteras";
import { crearModuloCuentas, type ModuloCuentas } from "./modulos/cuentas";
import { crearModuloInstrumentos, type ModuloInstrumentos } from "./modulos/instrumentos";
import type { ProveedorCotizaciones } from "./proveedores/cotizaciones/proveedor-cotizaciones";
import { Data912Proveedor } from "./proveedores/cotizaciones/data912.proveedor";
import type {
  ProveedorDolarActual,
  ProveedorDolarHistorico,
  ProveedorFeriados,
} from "./proveedores/dolar/proveedor-dolar";
import { DolarApiProveedor } from "./proveedores/dolar/dolarapi.proveedor";
import { ArgentinaDatosProveedor } from "./proveedores/dolar/argentinadatos.proveedor";

const MS_POR_SEGUNDO = 1000;

export interface Proveedores {
  cotizaciones: ProveedorCotizaciones;
  dolarActual: ProveedorDolarActual;
  dolarHistorico: ProveedorDolarHistorico;
  feriados: ProveedorFeriados;
}

export interface OpcionesContenedor {
  /** Los tests pasan proveedores con respuestas guardadas. */
  proveedores?: Proveedores;
  ahora?: () => Date;
}

/** Punto único de composición: crea y conecta todas las piezas del backend. */
export interface Contenedor {
  entorno: Entorno;
  bd: PrismaClient;
  ahora: () => Date;
  proveedores: Proveedores;
  auditoria: AuditoriaRepositorio;
  autenticacion: ModuloAutenticacion;
  carteras: ModuloCarteras;
  cuentas: ModuloCuentas;
  instrumentos: ModuloInstrumentos;
}

function crearProveedoresReales(entorno: Entorno): Proveedores {
  const argentinaDatos = new ArgentinaDatosProveedor();
  return {
    cotizaciones: new Data912Proveedor({
      ttlVivoMs: entorno.CACHE_COTIZACIONES_SEGUNDOS * MS_POR_SEGUNDO,
    }),
    dolarActual: new DolarApiProveedor(),
    dolarHistorico: argentinaDatos,
    feriados: argentinaDatos,
  };
}

export function crearContenedor(
  entorno: Entorno,
  bd: PrismaClient = crearClienteBD(entorno.DATABASE_URL),
  opciones: OpcionesContenedor = {},
): Contenedor {
  const ahora = opciones.ahora ?? (() => new Date());
  const proveedores = opciones.proveedores ?? crearProveedoresReales(entorno);
  const auditoria = new AuditoriaRepositorio(bd);
  return {
    entorno,
    bd,
    ahora,
    proveedores,
    auditoria,
    autenticacion: crearModuloAutenticacion(bd, entorno),
    carteras: crearModuloCarteras(bd, auditoria),
    cuentas: crearModuloCuentas(bd, auditoria),
    instrumentos: crearModuloInstrumentos(bd, proveedores.cotizaciones, ahora),
  };
}
```

En `backend/src/app.ts`, debajo de `privadas.use("/cuentas", contenedor.cuentas.rutas);` agregar:
```ts
  privadas.use("/instrumentos", contenedor.instrumentos.rutas);
```

- [ ] **Step 13: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 14: Mostrar el estado**

Run: `git status --short`

---
### Task 7: Motor — tipos, importes y estrategias de costo

**Files:**
- Create: `contratos/src/operaciones.ts` (solo `TipoOperacion` en esta tarea) · Modify: `contratos/src/index.ts`
- Create: `backend/src/motor/tipos.ts`, `backend/src/motor/importe.ts`, `backend/src/motor/posicion.ts`
- Create: `backend/src/motor/costo/estrategia-costo.ts`, `backend/src/motor/costo/precio-promedio.ts`, `backend/src/motor/costo/fifo.ts`
- Test: `backend/test/motor/costo.test.ts`

**Interfaces:**
- Consumes: `Decimal`, `CERO` (T3); `Moneda`, `MetodoCosto` (contratos).
- Produces:
  - contratos: `type TipoOperacion` (los 21 tipos del esquema)
  - `interface Importe { readonly ars: Decimal; readonly usd: Decimal }`; `interface OperacionMotor { id; tipo: TipoOperacion; fecha: Date; secuencia: number; carteraId: string; cuentaId: string | null; instrumentoId: string | null; ticker: string | null; cantidad: Decimal | null; precio: Decimal | null; moneda: Moneda; tipoCambio: Decimal; gastos: Decimal; monto: Decimal | null; factorPrecio: Decimal }`; `interface Lote { operacionId; fecha: Date; cantidad: Decimal; costo: Importe }`; `interface Posicion { clave; carteraId; instrumentoId; ticker; cuentaId: string | null; lotes: Lote[]; realizado: Importe; cobros: Importe; costoHistorico: Importe; monedaPrecio: Moneda; factorPrecio: Decimal }`; `interface EstadoCartera { posiciones: Map<string, Posicion>; efectivo: Map<Moneda, Decimal>; aportesNetos: Importe; comisionesSueltas: Importe; registraEfectivo: boolean }`; `interface PrecioVigente { porMoneda: Partial<Record<Moneda, Decimal>>; variacionPct: Decimal | null; fuente: "MERCADO" | "MANUAL"; actualizadoEn: Date; desactualizado: boolean }`; `crearEstadoVacio(): EstadoCartera`
  - `IMPORTE_CERO`, `importeDe(monto, moneda, tipoCambio): Importe`, `sumar(a, b)`, `restar(a, b)`, `escalar(importe, factor: Decimal)`, `sumarTodos(importes: Iterable<Importe>)`, `enMoneda(importe, moneda: Moneda | "USD"): Decimal`
  - `cantidadDe(posicion): Decimal`, `costoDe(posicion): Importe`, `claveDePosicion(carteraId, instrumentoId, cuentaId): string`
  - `interface ResultadoConsumo { restantes: Lote[]; costoConsumido: Importe }`; `interface EstrategiaCosto { readonly metodo: MetodoCosto; consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo }`; `class PrecioPromedio`, `class Fifo`; `estrategiaDeCosto(metodo: MetodoCosto): EstrategiaCosto`

- [ ] **Step 1: Agregar el tipo de operación a los contratos**

`contratos/src/operaciones.ts`:
```ts
export type TipoOperacion =
  | "TENENCIA_INICIAL"
  | "COMPRA"
  | "VENTA"
  | "DIVIDENDO"
  | "RENTA"
  | "AMORTIZACION"
  | "SUSCRIPCION_FCI"
  | "RESCATE_FCI"
  | "DEPOSITO"
  | "EXTRACCION"
  | "COMPRA_MONEDA"
  | "VENTA_MONEDA"
  | "CAUCION_COLOCACION"
  | "CAUCION_VENCIMIENTO"
  | "COMISION"
  | "IMPUESTO"
  | "SPLIT"
  | "CANJE"
  | "TRANSFERENCIA_ENTRADA"
  | "TRANSFERENCIA_SALIDA"
  | "AJUSTE";
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./operaciones";
```

- [ ] **Step 2: Escribir el test que falla**

`backend/test/motor/costo.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Decimal } from "../../src/compartido/decimal";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { enMoneda, escalar, importeDe, restar, sumar, sumarTodos } from "../../src/motor/importe";
import type { Importe, Lote } from "../../src/motor/tipos";

const d = (valor: string | number) => new Decimal(valor);
const importe = (ars: number, usd: number): Importe => ({ ars: d(ars), usd: d(usd) });
const texto = (i: Importe) => ({ ars: i.ars.toString(), usd: i.usd.toString() });

function lote(id: string, cantidad: number, costo: Importe): Lote {
  return { operacionId: id, fecha: new Date("2026-01-10T00:00:00Z"), cantidad: d(cantidad), costo };
}

const LOTES = [lote("a", 10, importe(1000, 10)), lote("b", 10, importe(2000, 16))];

describe("importes en pesos y dólares", () => {
  it("convierte según la moneda de la operación y el tipo de cambio", () => {
    expect(texto(importeDe(d(1500), "ARS", d(1500)))).toEqual({ ars: "1500", usd: "1" });
    expect(texto(importeDe(d(15), "USD_MEP", d(1500)))).toEqual({ ars: "22500", usd: "15" });
  });

  it("suma, resta, escala y elige la moneda", () => {
    expect(texto(sumar(importe(1, 2), importe(3, 4)))).toEqual({ ars: "4", usd: "6" });
    expect(texto(restar(importe(1, 2), importe(3, 4)))).toEqual({ ars: "-2", usd: "-2" });
    expect(texto(escalar(importe(10, 4), d("0.5")))).toEqual({ ars: "5", usd: "2" });
    expect(texto(sumarTodos([importe(1, 1), importe(2, 2), importe(3, 3)]))).toEqual({ ars: "6", usd: "6" });
    expect(enMoneda(importe(10, 4), "ARS").toString()).toBe("10");
    expect(enMoneda(importe(10, 4), "USD_CCL").toString()).toBe("4");
  });
});

describe("precio promedio", () => {
  const ppp = estrategiaDeCosto("PRECIO_PROMEDIO");

  it("vender se lleva el costo promedio y deja el resto con el mismo promedio", () => {
    const { costoConsumido, restantes } = ppp.consumir(LOTES, d(5));
    expect(texto(costoConsumido)).toEqual({ ars: "750", usd: "6.5" });
    expect(restantes.map((l) => [l.operacionId, l.cantidad.toString(), texto(l.costo)])).toEqual([
      ["a", "7.5", { ars: "750", usd: "7.5" }],
      ["b", "7.5", { ars: "1500", usd: "12" }],
    ]);
  });

  it("vender todo no deja lotes", () => {
    const { costoConsumido, restantes } = ppp.consumir(LOTES, d(20));
    expect(texto(costoConsumido)).toEqual({ ars: "3000", usd: "26" });
    expect(restantes).toEqual([]);
  });
});

describe("FIFO", () => {
  const fifo = estrategiaDeCosto("FIFO");

  it("vende primero lo más viejo", () => {
    const { costoConsumido, restantes } = fifo.consumir(LOTES, d(15));
    expect(texto(costoConsumido)).toEqual({ ars: "2000", usd: "18" });
    expect(restantes.map((l) => [l.operacionId, l.cantidad.toString(), texto(l.costo)])).toEqual([
      ["b", "5", { ars: "1000", usd: "8" }],
    ]);
  });

  it("no modifica los lotes originales", () => {
    fifo.consumir(LOTES, d(15));
    expect(LOTES[0]?.cantidad.toString()).toBe("10");
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/motor`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Implementar tipos, importes y posición**

`backend/src/motor/tipos.ts`:
```ts
import type { Moneda, TipoOperacion } from "@cartera/contratos";
import type { Decimal } from "../compartido/decimal";

/** Un mismo valor expresado en pesos y en dólares (al dólar de referencia del usuario). */
export interface Importe {
  readonly ars: Decimal;
  readonly usd: Decimal;
}

/** Operación lista para calcular: sin Prisma, con todos los números como Decimal. */
export interface OperacionMotor {
  id: string;
  tipo: TipoOperacion;
  fecha: Date;
  /** Desempata operaciones del mismo día: el orden en que se cargaron. */
  secuencia: number;
  carteraId: string;
  cuentaId: string | null;
  instrumentoId: string | null;
  ticker: string | null;
  cantidad: Decimal | null;
  precio: Decimal | null;
  moneda: Moneda;
  /** Pesos por dólar de referencia en la fecha de la operación. */
  tipoCambio: Decimal;
  /** Comisión + derechos de mercado + IVA + otros gastos, en la moneda de la operación. */
  gastos: Decimal;
  /** Importe de las operaciones sin precio: cobros, depósitos, extracciones, comisiones. */
  monto: Decimal | null;
  /** 0,01 en renta fija (cotiza cada 100 nominales), 1 en el resto. */
  factorPrecio: Decimal;
}

/** Una compra (o tenencia inicial) que todavía no se vendió del todo. */
export interface Lote {
  operacionId: string;
  fecha: Date;
  cantidad: Decimal;
  /** Costo total del lote, gastos incluidos. */
  costo: Importe;
}

/** Tenencia de un activo en una cartera y cuenta. */
export interface Posicion {
  clave: string;
  carteraId: string;
  instrumentoId: string;
  ticker: string;
  cuentaId: string | null;
  lotes: Lote[];
  realizado: Importe;
  cobros: Importe;
  /** Todo lo que se pagó alguna vez por este activo: base del rendimiento. */
  costoHistorico: Importe;
  /** Moneda en la que el usuario opera este activo (la de su última compra). */
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
}

export interface EstadoCartera {
  posiciones: Map<string, Posicion>;
  efectivo: Map<Moneda, Decimal>;
  aportesNetos: Importe;
  comisionesSueltas: Importe;
  /** El efectivo solo se muestra si el usuario registró depósitos o extracciones. */
  registraEfectivo: boolean;
}

export interface PrecioVigente {
  porMoneda: Partial<Record<Moneda, Decimal>>;
  variacionPct: Decimal | null;
  fuente: "MERCADO" | "MANUAL";
  actualizadoEn: Date;
  desactualizado: boolean;
}
```

`backend/src/motor/importe.ts`:
```ts
import type { Moneda } from "@cartera/contratos";
import { CERO, type Decimal } from "../compartido/decimal";
import type { Importe } from "./tipos";

export const IMPORTE_CERO: Importe = { ars: CERO, usd: CERO };

/** Un monto en la moneda de la operación, expresado en pesos y en dólares. */
export function importeDe(monto: Decimal, moneda: Moneda, tipoCambio: Decimal): Importe {
  return moneda === "ARS"
    ? { ars: monto, usd: monto.div(tipoCambio) }
    : { ars: monto.mul(tipoCambio), usd: monto };
}

export function sumar(a: Importe, b: Importe): Importe {
  return { ars: a.ars.plus(b.ars), usd: a.usd.plus(b.usd) };
}

export function restar(a: Importe, b: Importe): Importe {
  return { ars: a.ars.minus(b.ars), usd: a.usd.minus(b.usd) };
}

export function escalar(importe: Importe, factor: Decimal): Importe {
  return { ars: importe.ars.mul(factor), usd: importe.usd.mul(factor) };
}

export function sumarTodos(importes: Iterable<Importe>): Importe {
  let total = IMPORTE_CERO;
  for (const importe of importes) total = sumar(total, importe);
  return total;
}

/** La parte en pesos para ARS; la parte en dólares para cualquier dólar. */
export function enMoneda(importe: Importe, moneda: Moneda | "USD"): Decimal {
  return moneda === "ARS" ? importe.ars : importe.usd;
}
```

`backend/src/motor/posicion.ts`:
```ts
import { CERO, type Decimal } from "../compartido/decimal";
import { IMPORTE_CERO, sumarTodos } from "./importe";
import type { EstadoCartera, Importe, Posicion } from "./tipos";

export function cantidadDe(posicion: Posicion): Decimal {
  return posicion.lotes.reduce((total, lote) => total.plus(lote.cantidad), CERO);
}

/** Lo que se pagó por lo que se tiene hoy. */
export function costoDe(posicion: Posicion): Importe {
  return sumarTodos(posicion.lotes.map((lote) => lote.costo));
}

export function claveDePosicion(
  carteraId: string,
  instrumentoId: string,
  cuentaId: string | null,
): string {
  return `${carteraId}|${instrumentoId}|${cuentaId ?? "-"}`;
}

export function crearEstadoVacio(): EstadoCartera {
  return {
    posiciones: new Map(),
    efectivo: new Map(),
    aportesNetos: IMPORTE_CERO,
    comisionesSueltas: IMPORTE_CERO,
    registraEfectivo: false,
  };
}
```

> Nota: `crearEstadoVacio` vive en `posicion.ts` (no en `tipos.ts`) para que `tipos.ts` sea solo de tipos.

- [ ] **Step 5: Implementar las estrategias de costo**

`backend/src/motor/costo/estrategia-costo.ts`:
```ts
import type { MetodoCosto } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import type { Importe, Lote } from "../tipos";
import { Fifo } from "./fifo";
import { PrecioPromedio } from "./precio-promedio";

export interface ResultadoConsumo {
  restantes: Lote[];
  costoConsumido: Importe;
}

/** Cómo se calcula el costo de lo que se vende. La cantidad ya viene validada (≤ tenencia). */
export interface EstrategiaCosto {
  readonly metodo: MetodoCosto;
  consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo;
}

const ESTRATEGIAS: Record<MetodoCosto, EstrategiaCosto> = {
  PRECIO_PROMEDIO: new PrecioPromedio(),
  FIFO: new Fifo(),
};

export function estrategiaDeCosto(metodo: MetodoCosto): EstrategiaCosto {
  return ESTRATEGIAS[metodo];
}
```

`backend/src/motor/costo/precio-promedio.ts`:
```ts
import { CERO, Decimal } from "../../compartido/decimal";
import { escalar, sumarTodos } from "../importe";
import type { Lote } from "../tipos";
import type { EstrategiaCosto, ResultadoConsumo } from "./estrategia-costo";

/** Cada unidad vendida cuesta el promedio de todas: todos los lotes bajan en la misma proporción. */
export class PrecioPromedio implements EstrategiaCosto {
  readonly metodo = "PRECIO_PROMEDIO" as const;

  consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo {
    const total = lotes.reduce((suma, lote) => suma.plus(lote.cantidad), CERO);
    const proporcion = total.isZero() ? CERO : cantidad.div(total);
    const queda = new Decimal(1).minus(proporcion);
    return {
      costoConsumido: escalar(sumarTodos(lotes.map((lote) => lote.costo)), proporcion),
      restantes: lotes
        .map((lote) => ({ ...lote, cantidad: lote.cantidad.mul(queda), costo: escalar(lote.costo, queda) }))
        .filter((lote) => lote.cantidad.gt(0)),
    };
  }
}
```

`backend/src/motor/costo/fifo.ts`:
```ts
import type { Decimal } from "../../compartido/decimal";
import { IMPORTE_CERO, escalar, sumar } from "../importe";
import type { Lote } from "../tipos";
import type { EstrategiaCosto, ResultadoConsumo } from "./estrategia-costo";

/** Se vende primero lo que se compró primero. */
export class Fifo implements EstrategiaCosto {
  readonly metodo = "FIFO" as const;

  consumir(lotes: readonly Lote[], cantidad: Decimal): ResultadoConsumo {
    let pendiente = cantidad;
    let costoConsumido = IMPORTE_CERO;
    const restantes: Lote[] = [];
    for (const lote of lotes) {
      if (pendiente.lte(0)) {
        restantes.push(lote);
        continue;
      }
      const tomada = pendiente.lt(lote.cantidad) ? pendiente : lote.cantidad;
      const proporcion = tomada.div(lote.cantidad);
      costoConsumido = sumar(costoConsumido, escalar(lote.costo, proporcion));
      pendiente = pendiente.minus(tomada);
      const queda = lote.cantidad.minus(tomada);
      if (queda.gt(0)) {
        restantes.push({ ...lote, cantidad: queda, costo: escalar(lote.costo, queda.div(lote.cantidad)) });
      }
    }
    return { restantes, costoConsumido };
  }
}
```

- [ ] **Step 6: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS (la regla de capas permite al motor importar `compartido/`).

- [ ] **Step 7: Mostrar el estado**

Run: `git status --short`

---

### Task 8: Motor — un manejador por tipo de operación y reconstrucción de la tenencia

**Files:**
- Create: `backend/src/motor/operaciones/textos.ts`, `manejador-operacion.ts`, `manejadores.ts`, `registro-manejadores.ts` (en `backend/src/motor/operaciones/`)
- Create: `backend/src/motor/tenencia.ts`
- Create: `backend/test/utilidades/operaciones-motor.ts`
- Test: `backend/test/motor/tenencia.test.ts`

**Interfaces:**
- Consumes: tipos, importes, posición, estrategias (T7); `ErrorValidacion` (T1); `formatoFechaCorta` (T3); `formatearNumero` (T3).
- Produces:
  - `TEXTO_TIPO_OPERACION: Record<TipoOperacion, string>`
  - `interface ContextoAplicacion { estrategia: EstrategiaCosto }`; `abstract class ManejadorOperacion { tipo; descripcion; aplicar(estado, operacion, contexto): void }`
  - Manejadores: `TenenciaInicialManejador`, `CompraManejador`, `VentaManejador`, `DividendoManejador`, `RentaManejador`, `AmortizacionManejador`, `DepositoManejador`, `ExtraccionManejador`, `ComisionManejador`
  - `interface TipoDisponible { tipo: TipoOperacion; texto: string; descripcion: string }`; `class RegistroManejadores { obtener(tipo): ManejadorOperacion; disponibles(): TipoDisponible[] }`; `crearRegistroManejadores(): RegistroManejadores`
  - `ordenarOperaciones(ops): OperacionMotor[]`; `reconstruir(ops, estrategia, registro): EstadoCartera`
  - (tests) `crearOperacion(tipo, datos?): OperacionMotor` y `d(valor): Decimal`

- [ ] **Step 1: Crear el constructor de operaciones para tests**

`backend/test/utilidades/operaciones-motor.ts`:
```ts
import type { Moneda, TipoOperacion } from "@cartera/contratos";
import { Decimal } from "../../src/compartido/decimal";
import type { OperacionMotor } from "../../src/motor/tipos";

export const d = (valor: string | number) => new Decimal(valor);

let secuencia = 0;

export interface DatosOperacionPrueba {
  id?: string;
  fecha?: string;
  carteraId?: string;
  cuentaId?: string | null;
  instrumentoId?: string | null;
  ticker?: string | null;
  cantidad?: number | string;
  precio?: number | string;
  monto?: number | string;
  moneda?: Moneda;
  tipoCambio?: number | string;
  gastos?: number | string;
  factorPrecio?: number | string;
}

/** Operación de prueba: por defecto AMZN, en pesos, cartera "c1", dólar a 1000. */
export function crearOperacion(tipo: TipoOperacion, datos: DatosOperacionPrueba = {}): OperacionMotor {
  secuencia += 1;
  const opcional = (valor: number | string | undefined) => (valor === undefined ? null : d(valor));
  return {
    id: datos.id ?? `op-${secuencia}`,
    tipo,
    fecha: new Date(`${datos.fecha ?? "2026-01-10"}T00:00:00.000Z`),
    secuencia,
    carteraId: datos.carteraId ?? "c1",
    cuentaId: datos.cuentaId ?? null,
    instrumentoId: datos.instrumentoId === undefined ? "i-amzn" : datos.instrumentoId,
    ticker: datos.ticker === undefined ? "AMZN" : datos.ticker,
    cantidad: opcional(datos.cantidad),
    precio: opcional(datos.precio),
    monto: opcional(datos.monto),
    moneda: datos.moneda ?? "ARS",
    tipoCambio: d(datos.tipoCambio ?? 1000),
    gastos: d(datos.gastos ?? 0),
    factorPrecio: d(datos.factorPrecio ?? 1),
  };
}
```

- [ ] **Step 2: Escribir el test que falla**

`backend/test/motor/tenencia.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../src/motor/operaciones/registro-manejadores";
import { reconstruir } from "../../src/motor/tenencia";
import { cantidadDe, costoDe } from "../../src/motor/posicion";
import type { EstadoCartera, Importe, OperacionMotor } from "../../src/motor/tipos";
import { crearOperacion as op } from "../utilidades/operaciones-motor";

const registro = crearRegistroManejadores();
const ppp = estrategiaDeCosto("PRECIO_PROMEDIO");
const fifo = estrategiaDeCosto("FIFO");
const texto = (i: Importe) => ({ ars: i.ars.toString(), usd: i.usd.toString() });

function calcular(ops: OperacionMotor[], estrategia = ppp): EstadoCartera {
  return reconstruir(ops, estrategia, registro);
}

function unica(estado: EstadoCartera) {
  const [posicion] = [...estado.posiciones.values()];
  if (!posicion) throw new Error("sin posición");
  return posicion;
}

describe("tenencia inicial y compras", () => {
  it("la tenencia inicial suma el activo al costo y no mueve efectivo", () => {
    const estado = calcular([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 })]);
    const posicion = unica(estado);
    expect(cantidadDe(posicion).toString()).toBe("10");
    expect(texto(costoDe(posicion))).toEqual({ ars: "10000", usd: "10" });
    expect(estado.efectivo.size).toBe(0);
    expect(estado.registraEfectivo).toBe(false);
  });

  it("la compra incluye los gastos en el costo y descuenta el efectivo", () => {
    const estado = calcular([op("COMPRA", { cantidad: 10, precio: 1000, gastos: 50 })]);
    expect(texto(costoDe(unica(estado)))).toEqual({ ars: "10050", usd: "10.05" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("-10050");
  });

  it("una compra en dólares se valúa en pesos con el tipo de cambio de ese día", () => {
    const estado = calcular([op("COMPRA", { cantidad: 10, precio: "1.5", moneda: "USD_MEP", tipoCambio: 1500 })]);
    expect(texto(costoDe(unica(estado)))).toEqual({ ars: "22500", usd: "15" });
    expect(unica(estado).monedaPrecio).toBe("USD_MEP");
  });

  it("la renta fija cotiza cada 100 nominales", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { ticker: "AL30", instrumentoId: "i-al30", cantidad: 1000, precio: 83940, factorPrecio: "0.01" }),
    ]);
    expect(costoDe(unica(estado)).ars.toString()).toBe("839400");
  });
});

describe("ventas", () => {
  const historia = () => [
    op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000, fecha: "2026-01-10" }),
    op("COMPRA", { cantidad: 10, precio: 2000, fecha: "2026-01-12" }),
    op("VENTA", { cantidad: 5, precio: 3000, fecha: "2026-01-15" }),
  ];

  it("con precio promedio, la ganancia usa el costo promedio", () => {
    const posicion = unica(calcular(historia()));
    expect(texto(posicion.realizado)).toEqual({ ars: "7500", usd: "7.5" });
    expect(cantidadDe(posicion).toString()).toBe("15");
  });

  it("con FIFO, la ganancia usa el costo de lo más viejo", () => {
    const posicion = unica(calcular(historia(), fifo));
    expect(texto(posicion.realizado)).toEqual({ ars: "10000", usd: "10" });
  });

  it("los gastos de la venta bajan lo cobrado", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
      op("VENTA", { cantidad: 10, precio: 1000, gastos: 100, fecha: "2026-02-01" }),
    ]);
    expect(texto(unica(estado).realizado)).toEqual({ ars: "-100", usd: "-0.1" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("9900");
  });

  it("vender más de lo que se tenía se rechaza con fecha y cantidades", () => {
    expect(() =>
      calcular([
        op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
        op("VENTA", { cantidad: 20, precio: 1000, fecha: "2026-01-15" }),
      ]),
    ).toThrow("El 15/01/2026 vendés 20 AMZN, pero en ese momento tenías 10.");
  });

  it("se aplica por fecha aunque la venta se haya cargado antes", () => {
    const venta = op("VENTA", { cantidad: 5, precio: 3000, fecha: "2026-02-01" });
    const compra = op("COMPRA", { cantidad: 10, precio: 1000, fecha: "2026-01-10" });
    expect(cantidadDe(unica(calcular([venta, compra]))).toString()).toBe("5");
  });

  it("el mismo día, la tenencia inicial va antes que una venta cargada primero", () => {
    const venta = op("VENTA", { cantidad: 5, precio: 1000, fecha: "2026-01-10" });
    const inicial = op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000, fecha: "2026-01-10" });
    expect(cantidadDe(unica(calcular([venta, inicial]))).toString()).toBe("5");
  });
});

describe("cobros", () => {
  it("un dividendo suma a lo cobrado y al efectivo", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
      op("DIVIDENDO", { monto: 500, fecha: "2026-03-01" }),
    ]);
    expect(texto(unica(estado).cobros)).toEqual({ ars: "500", usd: "0.5" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("500");
  });

  it("una amortización devuelve capital: baja lo invertido sin contar como ganancia", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { ticker: "AL30", instrumentoId: "i-al30", cantidad: 1000, precio: 100, moneda: "USD_MEP", factorPrecio: "0.01" }),
      op("AMORTIZACION", { ticker: "AL30", instrumentoId: "i-al30", monto: 250, moneda: "USD_MEP", fecha: "2026-07-09" }),
    ]);
    const posicion = unica(estado);
    expect(texto(costoDe(posicion))).toEqual({ ars: "750000", usd: "750" });
    expect(texto(posicion.realizado)).toEqual({ ars: "0", usd: "0" });
    expect(estado.efectivo.get("USD_MEP")?.toString()).toBe("250");
  });

  it("una amortización de un activo que no se tenía se rechaza", () => {
    expect(() => calcular([op("AMORTIZACION", { monto: 10, fecha: "2026-03-01" })])).toThrow(
      "El 01/03/2026 registrás una amortización de AMZN, pero en ese momento no tenías ese activo.",
    );
  });
});

describe("efectivo y comisiones", () => {
  it("depósitos y extracciones activan el seguimiento del efectivo", () => {
    const estado = calcular([
      op("DEPOSITO", { instrumentoId: null, ticker: null, monto: 100000 }),
      op("EXTRACCION", { instrumentoId: null, ticker: null, monto: 30000, fecha: "2026-01-20" }),
    ]);
    expect(estado.registraEfectivo).toBe(true);
    expect(estado.efectivo.get("ARS")?.toString()).toBe("70000");
    expect(texto(estado.aportesNetos)).toEqual({ ars: "70000", usd: "70" });
  });

  it("una comisión sin activo es un gasto suelto; con activo, resta a su resultado", () => {
    const estado = calcular([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 }),
      op("COMISION", { instrumentoId: null, ticker: null, monto: 200 }),
      op("COMISION", { monto: 50 }),
    ]);
    expect(texto(estado.comisionesSueltas)).toEqual({ ars: "200", usd: "0.2" });
    expect(texto(unica(estado).realizado)).toEqual({ ars: "-50", usd: "-0.05" });
    expect(estado.efectivo.get("ARS")?.toString()).toBe("-250");
  });
});

describe("validaciones en lenguaje llano", () => {
  it("los tipos de la etapa 2 todavía no se pueden registrar", () => {
    expect(() => calcular([op("SPLIT", { cantidad: 1 })])).toThrow(
      "Todavía no se pueden registrar operaciones de tipo «Split».",
    );
  });

  it("dice qué dato falta y en qué operación", () => {
    expect(() => calcular([op("COMPRA", { precio: 1000 })])).toThrow(
      "Falta la cantidad en la operación del 10/01/2026.",
    );
  });

  it("el registro describe los tipos disponibles", () => {
    const disponibles = registro.disponibles();
    expect(disponibles.map((t) => t.tipo)).toEqual([
      "TENENCIA_INICIAL", "COMPRA", "VENTA", "DIVIDENDO", "RENTA", "AMORTIZACION", "DEPOSITO", "EXTRACCION", "COMISION",
    ]);
    expect(disponibles[0]).toEqual({
      tipo: "TENENCIA_INICIAL",
      texto: "Tenencia inicial",
      descripcion: "Un activo que ya tenías, con su cantidad y su precio promedio de compra. No mueve efectivo.",
    });
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/motor/tenencia`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Textos y clase base**

`backend/src/motor/operaciones/textos.ts`:
```ts
import type { TipoOperacion } from "@cartera/contratos";

export const TEXTO_TIPO_OPERACION: Record<TipoOperacion, string> = {
  TENENCIA_INICIAL: "Tenencia inicial",
  COMPRA: "Compra",
  VENTA: "Venta",
  DIVIDENDO: "Dividendo",
  RENTA: "Renta (cupón)",
  AMORTIZACION: "Amortización",
  SUSCRIPCION_FCI: "Suscripción a un fondo",
  RESCATE_FCI: "Rescate de un fondo",
  DEPOSITO: "Depósito",
  EXTRACCION: "Extracción",
  COMPRA_MONEDA: "Compra de dólares",
  VENTA_MONEDA: "Venta de dólares",
  CAUCION_COLOCACION: "Colocación de caución",
  CAUCION_VENCIMIENTO: "Vencimiento de caución",
  COMISION: "Comisión o gasto",
  IMPUESTO: "Impuesto",
  SPLIT: "Split",
  CANJE: "Canje",
  TRANSFERENCIA_ENTRADA: "Transferencia recibida",
  TRANSFERENCIA_SALIDA: "Transferencia enviada",
  AJUSTE: "Ajuste",
};
```

`backend/src/motor/operaciones/manejador-operacion.ts`:
```ts
import type { Moneda, TipoOperacion } from "@cartera/contratos";
import { CERO, type Decimal } from "../../compartido/decimal";
import { ErrorValidacion } from "../../compartido/errores";
import { formatoFechaCorta } from "../../compartido/fechas";
import type { EstrategiaCosto } from "../costo/estrategia-costo";
import { IMPORTE_CERO } from "../importe";
import { claveDePosicion } from "../posicion";
import type { EstadoCartera, OperacionMotor, Posicion } from "../tipos";

export interface ContextoAplicacion {
  estrategia: EstrategiaCosto;
}

/** Cada tipo de operación sabe cómo cambia la cartera. Sin I/O: solo modifica el estado. */
export abstract class ManejadorOperacion {
  abstract readonly tipo: TipoOperacion;
  /** Qué registra este tipo, en lenguaje llano (lo muestra el formulario). */
  abstract readonly descripcion: string;

  abstract aplicar(
    estado: EstadoCartera,
    operacion: OperacionMotor,
    contexto: ContextoAplicacion,
  ): void;

  protected requerir(valor: Decimal | null, dato: string, operacion: OperacionMotor): Decimal {
    if (valor === null) {
      throw new ErrorValidacion(`Falta ${dato} en la operación del ${formatoFechaCorta(operacion.fecha)}.`);
    }
    return valor;
  }

  protected posicionExistente(estado: EstadoCartera, operacion: OperacionMotor): Posicion | undefined {
    if (!operacion.instrumentoId) return undefined;
    return estado.posiciones.get(
      claveDePosicion(operacion.carteraId, operacion.instrumentoId, operacion.cuentaId),
    );
  }

  protected posicion(estado: EstadoCartera, operacion: OperacionMotor): Posicion {
    if (!operacion.instrumentoId || !operacion.ticker) {
      throw new ErrorValidacion(`Falta el activo en la operación del ${formatoFechaCorta(operacion.fecha)}.`);
    }
    const existente = this.posicionExistente(estado, operacion);
    if (existente) return existente;
    const nueva: Posicion = {
      clave: claveDePosicion(operacion.carteraId, operacion.instrumentoId, operacion.cuentaId),
      carteraId: operacion.carteraId,
      instrumentoId: operacion.instrumentoId,
      ticker: operacion.ticker,
      cuentaId: operacion.cuentaId,
      lotes: [],
      realizado: IMPORTE_CERO,
      cobros: IMPORTE_CERO,
      costoHistorico: IMPORTE_CERO,
      monedaPrecio: operacion.moneda,
      factorPrecio: operacion.factorPrecio,
    };
    estado.posiciones.set(nueva.clave, nueva);
    return nueva;
  }

  protected moverEfectivo(estado: EstadoCartera, moneda: Moneda, delta: Decimal): void {
    estado.efectivo.set(moneda, (estado.efectivo.get(moneda) ?? CERO).plus(delta));
  }
}
```

- [ ] **Step 5: Los manejadores concretos**

`backend/src/motor/operaciones/manejadores.ts`:
```ts
import { CERO, Decimal } from "../../compartido/decimal";
import { ErrorValidacion } from "../../compartido/errores";
import { formatoFechaCorta } from "../../compartido/fechas";
import { formatearNumero } from "../../compartido/formato";
import { escalar, importeDe, restar, sumar } from "../importe";
import { cantidadDe, costoDe } from "../posicion";
import type { EstadoCartera, OperacionMotor } from "../tipos";
import { ManejadorOperacion, type ContextoAplicacion } from "./manejador-operacion";

const DECIMALES_CANTIDAD = 6;
const UNO = new Decimal(1);

function bruto(operacion: OperacionMotor, cantidad: Decimal, precio: Decimal): Decimal {
  return cantidad.mul(precio).mul(operacion.factorPrecio);
}

/** Alta de tenencia: agrega un lote con su costo (gastos incluidos). */
abstract class ManejadorAlta extends ManejadorOperacion {
  protected abstract readonly pagaConEfectivo: boolean;

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const cantidad = this.requerir(operacion.cantidad, "la cantidad", operacion);
    const precio = this.requerir(operacion.precio, "el precio", operacion);
    const pagado = bruto(operacion, cantidad, precio).plus(operacion.gastos);
    const costo = importeDe(pagado, operacion.moneda, operacion.tipoCambio);
    const posicion = this.posicion(estado, operacion);
    posicion.lotes.push({ operacionId: operacion.id, fecha: operacion.fecha, cantidad, costo });
    posicion.costoHistorico = sumar(posicion.costoHistorico, costo);
    posicion.monedaPrecio = operacion.moneda;
    posicion.factorPrecio = operacion.factorPrecio;
    if (this.pagaConEfectivo) this.moverEfectivo(estado, operacion.moneda, pagado.neg());
  }
}

export class TenenciaInicialManejador extends ManejadorAlta {
  readonly tipo = "TENENCIA_INICIAL" as const;
  readonly descripcion =
    "Un activo que ya tenías, con su cantidad y su precio promedio de compra. No mueve efectivo.";
  protected readonly pagaConEfectivo = false;
}

export class CompraManejador extends ManejadorAlta {
  readonly tipo = "COMPRA" as const;
  readonly descripcion = "Una compra nueva: suma a tu tenencia y descuenta lo que pagaste.";
  protected readonly pagaConEfectivo = true;
}

export class VentaManejador extends ManejadorOperacion {
  readonly tipo = "VENTA" as const;
  readonly descripcion =
    "Una venta: resta de tu tenencia, suma lo que cobraste y calcula cuánto ganaste o perdiste.";

  aplicar(estado: EstadoCartera, operacion: OperacionMotor, contexto: ContextoAplicacion): void {
    const cantidad = this.requerir(operacion.cantidad, "la cantidad", operacion);
    const precio = this.requerir(operacion.precio, "el precio", operacion);
    const posicion = this.posicionExistente(estado, operacion);
    const tenida = posicion ? cantidadDe(posicion) : CERO;
    if (!posicion || cantidad.gt(tenida)) {
      throw new ErrorValidacion(
        `El ${formatoFechaCorta(operacion.fecha)} vendés ${formatearNumero(cantidad, DECIMALES_CANTIDAD)} ` +
          `${operacion.ticker ?? "del activo"}, pero en ese momento tenías ` +
          `${formatearNumero(tenida, DECIMALES_CANTIDAD)}.`,
      );
    }
    const { restantes, costoConsumido } = contexto.estrategia.consumir(posicion.lotes, cantidad);
    const cobrado = bruto(operacion, cantidad, precio).minus(operacion.gastos);
    const ingreso = importeDe(cobrado, operacion.moneda, operacion.tipoCambio);
    posicion.lotes = restantes;
    posicion.realizado = sumar(posicion.realizado, restar(ingreso, costoConsumido));
    this.moverEfectivo(estado, operacion.moneda, cobrado);
  }
}

/** Cobros que no cambian la tenencia: suman a lo cobrado y al efectivo. */
abstract class ManejadorCobro extends ManejadorOperacion {
  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const posicion = this.posicion(estado, operacion);
    posicion.cobros = sumar(posicion.cobros, importeDe(monto, operacion.moneda, operacion.tipoCambio));
    this.moverEfectivo(estado, operacion.moneda, monto);
  }
}

export class DividendoManejador extends ManejadorCobro {
  readonly tipo = "DIVIDENDO" as const;
  readonly descripcion = "Un dividendo que te pagó una acción o un CEDEAR.";
}

export class RentaManejador extends ManejadorCobro {
  readonly tipo = "RENTA" as const;
  readonly descripcion = "Los intereses (cupón) que te pagó un bono o una obligación negociable.";
}

export class AmortizacionManejador extends ManejadorOperacion {
  readonly tipo = "AMORTIZACION" as const;
  readonly descripcion =
    "La devolución de parte del capital de un bono u obligación negociable: baja lo invertido en ese activo.";

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const posicion = this.posicionExistente(estado, operacion);
    if (!posicion || cantidadDe(posicion).isZero()) {
      throw new ErrorValidacion(
        `El ${formatoFechaCorta(operacion.fecha)} registrás una amortización de ` +
          `${operacion.ticker ?? "un activo"}, pero en ese momento no tenías ese activo.`,
      );
    }
    const devuelto = importeDe(monto, operacion.moneda, operacion.tipoCambio);
    const costo = costoDe(posicion);
    // Se devuelve capital: el costo baja en la misma proporción. Lo que exceda el costo es ganancia.
    const proporcion = costo.ars.isZero() ? UNO : Decimal.min(UNO, devuelto.ars.div(costo.ars));
    const queda = UNO.minus(proporcion);
    posicion.lotes = posicion.lotes.map((lote) => ({ ...lote, costo: escalar(lote.costo, queda) }));
    posicion.realizado = sumar(posicion.realizado, restar(devuelto, escalar(costo, proporcion)));
    this.moverEfectivo(estado, operacion.moneda, monto);
  }
}

/** Movimientos de dinero propio: cambian el efectivo y lo aportado. */
abstract class ManejadorEfectivo extends ManejadorOperacion {
  protected abstract readonly signo: 1 | -1;

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const conSigno = this.signo === 1 ? monto : monto.neg();
    this.moverEfectivo(estado, operacion.moneda, conSigno);
    estado.aportesNetos = sumar(
      estado.aportesNetos,
      importeDe(conSigno, operacion.moneda, operacion.tipoCambio),
    );
    estado.registraEfectivo = true;
  }
}

export class DepositoManejador extends ManejadorEfectivo {
  readonly tipo = "DEPOSITO" as const;
  readonly descripcion = "Dinero que ingresaste a tu cuenta del bróker.";
  protected readonly signo = 1;
}

export class ExtraccionManejador extends ManejadorEfectivo {
  readonly tipo = "EXTRACCION" as const;
  readonly descripcion = "Dinero que retiraste de tu cuenta del bróker.";
  protected readonly signo = -1;
}

export class ComisionManejador extends ManejadorOperacion {
  readonly tipo = "COMISION" as const;
  readonly descripcion =
    "Una comisión o gasto que te cobró el bróker (mantenimiento, custodia u otros).";

  aplicar(estado: EstadoCartera, operacion: OperacionMotor): void {
    const monto = this.requerir(operacion.monto, "el monto", operacion);
    const importe = importeDe(monto, operacion.moneda, operacion.tipoCambio);
    if (operacion.instrumentoId) {
      const posicion = this.posicion(estado, operacion);
      posicion.realizado = restar(posicion.realizado, importe);
    } else {
      estado.comisionesSueltas = sumar(estado.comisionesSueltas, importe);
    }
    this.moverEfectivo(estado, operacion.moneda, monto.neg());
  }
}
```

- [ ] **Step 6: Registro y reconstrucción**

`backend/src/motor/operaciones/registro-manejadores.ts`:
```ts
import type { TipoOperacion } from "@cartera/contratos";
import { ErrorValidacion } from "../../compartido/errores";
import type { ManejadorOperacion } from "./manejador-operacion";
import {
  AmortizacionManejador,
  CompraManejador,
  ComisionManejador,
  DepositoManejador,
  DividendoManejador,
  ExtraccionManejador,
  RentaManejador,
  TenenciaInicialManejador,
  VentaManejador,
} from "./manejadores";
import { TEXTO_TIPO_OPERACION } from "./textos";

export interface TipoDisponible {
  tipo: TipoOperacion;
  texto: string;
  descripcion: string;
}

/** Encuentra el manejador de cada tipo: agregar un tipo nuevo es registrar una clase más. */
export class RegistroManejadores {
  private readonly porTipo: ReadonlyMap<TipoOperacion, ManejadorOperacion>;

  constructor(private readonly manejadores: readonly ManejadorOperacion[]) {
    this.porTipo = new Map(manejadores.map((manejador) => [manejador.tipo, manejador]));
  }

  obtener(tipo: TipoOperacion): ManejadorOperacion {
    const manejador = this.porTipo.get(tipo);
    if (!manejador) {
      throw new ErrorValidacion(
        `Todavía no se pueden registrar operaciones de tipo «${TEXTO_TIPO_OPERACION[tipo]}».`,
      );
    }
    return manejador;
  }

  disponibles(): TipoDisponible[] {
    return this.manejadores.map((manejador) => ({
      tipo: manejador.tipo,
      texto: TEXTO_TIPO_OPERACION[manejador.tipo],
      descripcion: manejador.descripcion,
    }));
  }
}

export function crearRegistroManejadores(): RegistroManejadores {
  return new RegistroManejadores([
    new TenenciaInicialManejador(),
    new CompraManejador(),
    new VentaManejador(),
    new DividendoManejador(),
    new RentaManejador(),
    new AmortizacionManejador(),
    new DepositoManejador(),
    new ExtraccionManejador(),
    new ComisionManejador(),
  ]);
}
```

`backend/src/motor/tenencia.ts`:
```ts
import type { EstrategiaCosto } from "./costo/estrategia-costo";
import type { RegistroManejadores } from "./operaciones/registro-manejadores";
import { crearEstadoVacio } from "./posicion";
import type { EstadoCartera, OperacionMotor } from "./tipos";

/** El mismo día, la tenencia inicial va primero: es lo que se tenía antes de operar. */
function prioridad(operacion: OperacionMotor): number {
  return operacion.tipo === "TENENCIA_INICIAL" ? 0 : 1;
}

export function ordenarOperaciones(operaciones: readonly OperacionMotor[]): OperacionMotor[] {
  return [...operaciones].sort(
    (a, b) =>
      a.fecha.getTime() - b.fecha.getTime() ||
      prioridad(a) - prioridad(b) ||
      a.secuencia - b.secuencia,
  );
}

/** Estado de la cartera después de aplicar toda la historia, en orden. */
export function reconstruir(
  operaciones: readonly OperacionMotor[],
  estrategia: EstrategiaCosto,
  registro: RegistroManejadores,
): EstadoCartera {
  const estado = crearEstadoVacio();
  for (const operacion of ordenarOperaciones(operaciones)) {
    registro.obtener(operacion.tipo).aplicar(estado, operacion, { estrategia });
  }
  return estado;
}
```

- [ ] **Step 7: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 8: Mostrar el estado**

Run: `git status --short`

---

### Task 9: Motor — valuación, totales, ponderaciones y simulación

**Files:**
- Create: `backend/src/motor/valuadores/valuador.ts`, `por-cotizacion.ts`, `por-devengamiento.ts`, `fabrica.ts` (en `backend/src/motor/valuadores/`)
- Create: `backend/src/motor/totales.ts`, `backend/src/motor/ponderacion.ts`, `backend/src/motor/simulacion.ts`
- Test: `backend/test/motor/valuacion.test.ts`, `backend/test/motor/simulacion.test.ts`

**Interfaces:**
- Consumes: todo el motor (T7, T8).
- Produces:
  - `type FuentePrecio = "MERCADO" | "MANUAL" | "COSTO" | "DEVENGADO"`; `interface ValuacionPosicion { valor: Importe; precio: Decimal | null; variacionPct: Decimal | null; sinCotizacion: boolean; fuente: FuentePrecio }`; `interface ContextoValuacion { dolar: Decimal; ahora: Date; tasaAnual: Decimal | null }`; `interface Valuador { valuar(posicion, precio: PrecioVigente | undefined, contexto): ValuacionPosicion }`; `ValuadorPorCotizacion`, `ValuadorPorDevengamiento`; `valuadorPara(tipo: TipoInstrumento): Valuador`
  - `interface PosicionValuada { posicion: Posicion; valuacion: ValuacionPosicion }`; `interface TotalesCartera { valor; valorPosiciones; invertido; noRealizado; realizado; cobros; comisionesSueltas; resultadoTotal; costoHistorico; variacionDiaria: Importe; efectivo: Importe | null; rendimientoPct: { ars: Decimal | null; usd: Decimal | null }; variacionDiariaPct: { ars: Decimal | null; usd: Decimal | null } }`; `totalizar(valuadas, estado, dolar): TotalesCartera`
  - `interface EntradaPeso { clave; etiqueta; valor: Decimal }`; `interface Peso extends EntradaPeso { porcentaje: Decimal }`; `ponderar(entradas): Peso[]`
  - `type CambioSimulado = { accion: "crear" | "editar"; operacion: OperacionMotor } | { accion: "borrar"; id: string }`; `aplicarCambio(ops, cambio): OperacionMotor[]`; `interface FotoPosicion { ticker; cantidad: Decimal; costo: Importe; monedaPrecio: Moneda; factorPrecio: Decimal }`; `type ResultadoSimulacion = { valida: true; antes: FotoPosicion | null; despues: FotoPosicion | null } | { valida: false; mensaje: string }`; `simular(ops, cambio, estrategia, registro): ResultadoSimulacion`; `precioPromedio(foto): Decimal | null`

- [ ] **Step 1: Escribir los tests que fallan**

`backend/test/motor/valuacion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../src/motor/operaciones/registro-manejadores";
import { reconstruir } from "../../src/motor/tenencia";
import { valuadorPara } from "../../src/motor/valuadores/fabrica";
import { totalizar } from "../../src/motor/totales";
import { ponderar } from "../../src/motor/ponderacion";
import type { EstadoCartera, Importe, OperacionMotor, Posicion, PrecioVigente } from "../../src/motor/tipos";
import { crearOperacion as op, d } from "../utilidades/operaciones-motor";

const DOLAR = d(1500);
const AHORA = new Date("2026-02-09T00:00:00Z");
const texto = (i: Importe) => ({ ars: i.ars.toString(), usd: i.usd.toString() });

function estadoDe(ops: OperacionMotor[]): EstadoCartera {
  return reconstruir(ops, estrategiaDeCosto("PRECIO_PROMEDIO"), crearRegistroManejadores());
}

function primera(estado: EstadoCartera): Posicion {
  const [posicion] = [...estado.posiciones.values()];
  if (!posicion) throw new Error("sin posición");
  return posicion;
}

function precio(porMoneda: PrecioVigente["porMoneda"], extra: Partial<PrecioVigente> = {}): PrecioVigente {
  return { porMoneda, variacionPct: null, fuente: "MERCADO", actualizadoEn: AHORA, desactualizado: false, ...extra };
}

const contexto = { dolar: DOLAR, ahora: AHORA, tasaAnual: null };

describe("valuador por cotización", () => {
  const valuador = valuadorPara("CEDEAR");

  it("un activo operado en pesos se valúa con su precio en pesos", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 2000 })]));
    const valuacion = valuador.valuar(posicion, precio({ ARS: d(2775), USD_MEP: d("1.805") }, { variacionPct: d("-1.6") }), contexto);
    expect(texto(valuacion.valor)).toEqual({ ars: "27750", usd: "18.5" });
    expect(valuacion.precio?.toString()).toBe("2775");
    expect(valuacion.variacionPct?.toString()).toBe("-1.6");
    expect(valuacion.fuente).toBe("MERCADO");
  });

  it("un activo operado en dólares se valúa con su precio en dólares", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 72, precio: "1.5", moneda: "USD_MEP" })]));
    const valuacion = valuador.valuar(posicion, precio({ ARS: d(2775), USD_MEP: d("1.805") }), contexto);
    expect(texto(valuacion.valor)).toEqual({ ars: "194940", usd: "129.96" });
    expect(valuacion.precio?.toString()).toBe("1.805");
  });

  it("si no cotiza en su moneda, usa la otra convirtiendo con el dólar", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1, moneda: "USD_MEP" })]));
    const valuacion = valuador.valuar(posicion, precio({ ARS: d(3000) }), contexto);
    expect(texto(valuacion.valor)).toEqual({ ars: "30000", usd: "20" });
    expect(valuacion.precio?.toString()).toBe("2");
  });

  it("la renta fija aplica el factor de 100 nominales", () => {
    const posicion = primera(estadoDe([
      op("TENENCIA_INICIAL", { ticker: "YM39O", instrumentoId: "i-ym39", cantidad: 344, precio: "109.3", moneda: "USD_MEP", factorPrecio: "0.01" }),
    ]));
    const valuacion = valuadorPara("ON").valuar(posicion, precio({ USD_MEP: d("110.2") }), contexto);
    expect(valuacion.valor.usd.toString()).toBe("379.088");
  });

  it("sin cotización se valúa al costo y se marca", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 })]));
    const valuacion = valuador.valuar(posicion, undefined, contexto);
    expect(valuacion).toMatchObject({ sinCotizacion: true, fuente: "COSTO", precio: null });
    expect(texto(valuacion.valor)).toEqual({ ars: "10000", usd: "10" });
  });

  it("respeta el precio manual como fuente", () => {
    const posicion = primera(estadoDe([op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000 })]));
    const valuacion = valuador.valuar(posicion, precio({ ARS: d(1100) }, { fuente: "MANUAL" }), contexto);
    expect(valuacion.fuente).toBe("MANUAL");
    expect(valuacion.valor.ars.toString()).toBe("11000");
  });
});

describe("valuador por devengamiento", () => {
  it("suma el interés de los días transcurridos con la tasa nominal anual", () => {
    const posicion = primera(estadoDe([
      op("TENENCIA_INICIAL", { ticker: "PF", instrumentoId: "i-pf", cantidad: 1, precio: 100000, fecha: "2026-01-10" }),
    ]));
    const valuacion = valuadorPara("PLAZO_FIJO").valuar(posicion, undefined, { ...contexto, tasaAnual: d("36.5") });
    expect(valuacion.valor.ars.toString()).toBe("103000");
    expect(valuacion.fuente).toBe("DEVENGADO");
  });
});

describe("totales", () => {
  it("suma valor, invertido, resultados y variación del día", () => {
    const estado = estadoDe([
      op("TENENCIA_INICIAL", { cantidad: 10, precio: 1000, tipoCambio: 1000 }),
      op("TENENCIA_INICIAL", { ticker: "VIEJO", instrumentoId: "i-viejo", cantidad: 5, precio: 1000, tipoCambio: 1000 }),
      op("VENTA", { ticker: "VIEJO", instrumentoId: "i-viejo", cantidad: 5, precio: 1200, tipoCambio: 1000, fecha: "2026-01-20" }),
      op("DIVIDENDO", { monto: 300, tipoCambio: 1000, fecha: "2026-01-25" }),
      op("COMISION", { instrumentoId: null, ticker: null, monto: 100, tipoCambio: 1000 }),
    ]);
    const valuadas = [...estado.posiciones.values()].map((posicion) => ({
      posicion,
      valuacion: valuadorPara("CEDEAR").valuar(
        posicion,
        posicion.ticker === "AMZN" ? precio({ ARS: d(1500) }, { variacionPct: d(25) }) : undefined,
        contexto,
      ),
    }));
    const totales = totalizar(valuadas, estado, DOLAR);
    expect(totales.valor.ars.toString()).toBe("15000");
    expect(totales.invertido.ars.toString()).toBe("10000");
    expect(totales.noRealizado.ars.toString()).toBe("5000");
    expect(totales.realizado.ars.toString()).toBe("1000");
    expect(totales.cobros.ars.toString()).toBe("300");
    expect(totales.resultadoTotal.ars.toString()).toBe("6200");
    expect(totales.costoHistorico.ars.toString()).toBe("15000");
    expect(totales.rendimientoPct.ars?.toFixed(4)).toBe("41.3333");
    expect(totales.variacionDiaria.ars.toString()).toBe("3000");
    expect(totales.variacionDiariaPct.ars?.toString()).toBe("25");
    expect(totales.efectivo).toBeNull();
  });

  it("el efectivo solo suma si se registran depósitos", () => {
    const estado = estadoDe([op("DEPOSITO", { instrumentoId: null, ticker: null, monto: 30, moneda: "USD_MEP" })]);
    const totales = totalizar([], estado, DOLAR);
    expect(totales.efectivo && texto(totales.efectivo)).toEqual({ ars: "45000", usd: "30" });
    expect(totales.valor.usd.toString()).toBe("30");
    expect(totales.rendimientoPct.ars).toBeNull();
  });
});

describe("ponderación", () => {
  it("agrupa por clave, ordena de mayor a menor y calcula el porcentaje", () => {
    const pesos = ponderar([
      { clave: "CEDEAR", etiqueta: "CEDEAR", valor: d(300) },
      { clave: "ON", etiqueta: "Obligación negociable", valor: d(600) },
      { clave: "CEDEAR", etiqueta: "CEDEAR", valor: d(100) },
      { clave: "VACIO", etiqueta: "Vacío", valor: d(0) },
    ]);
    expect(pesos.map((p) => [p.clave, p.valor.toString(), p.porcentaje.toString()])).toEqual([
      ["ON", "600", "60"],
      ["CEDEAR", "400", "40"],
    ]);
  });

  it("sin valores devuelve una lista vacía", () => {
    expect(ponderar([])).toEqual([]);
  });
});
```

`backend/test/motor/simulacion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { estrategiaDeCosto } from "../../src/motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../src/motor/operaciones/registro-manejadores";
import { precioPromedio, simular } from "../../src/motor/simulacion";
import { crearOperacion as op } from "../utilidades/operaciones-motor";

const registro = crearRegistroManejadores();
const ppp = estrategiaDeCosto("PRECIO_PROMEDIO");

describe("simulación", () => {
  const inicial = op("TENENCIA_INICIAL", { id: "ini", cantidad: 72, precio: 2500 });
  const venta = op("VENTA", { id: "venta", cantidad: 50, precio: 3000, fecha: "2026-03-01" });

  it("muestra la tenencia y el precio promedio antes y después de una compra", () => {
    const compra = op("COMPRA", { cantidad: 100, precio: 2785, fecha: "2026-02-01" });
    const resultado = simular([inicial], { accion: "crear", operacion: compra }, ppp, registro);
    if (!resultado.valida) throw new Error(resultado.mensaje);
    expect(resultado.antes?.cantidad.toString()).toBe("72");
    expect(resultado.despues?.cantidad.toString()).toBe("172");
    expect(resultado.antes && precioPromedio(resultado.antes)?.toString()).toBe("2500");
    expect(resultado.despues && precioPromedio(resultado.despues)?.toFixed(2)).toBe("2665.70");
  });

  it("borrar una compra que deja a una venta posterior sin tenencia es inválido y explica por qué", () => {
    const resultado = simular([inicial, venta], { accion: "borrar", id: "ini" }, ppp, registro);
    expect(resultado).toEqual({
      valida: false,
      mensaje: "El 01/03/2026 vendés 50 AMZN, pero en ese momento tenías 0.",
    });
  });

  it("editar reemplaza la operación por la nueva versión", () => {
    const editada = { ...inicial, cantidad: inicial.cantidad?.mul(2) ?? null };
    const resultado = simular([inicial, venta], { accion: "editar", operacion: editada }, ppp, registro);
    if (!resultado.valida) throw new Error(resultado.mensaje);
    expect(resultado.despues?.cantidad.toString()).toBe("94");
  });

  it("una operación sin activo no tiene posición afectada", () => {
    const deposito = op("DEPOSITO", { instrumentoId: null, ticker: null, monto: 1000 });
    const resultado = simular([], { accion: "crear", operacion: deposito }, ppp, registro);
    expect(resultado).toEqual({ valida: true, antes: null, despues: null });
  });
});
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm test -w @cartera/backend -- test/motor`
Expected: FAIL — módulos inexistentes (los tests de T7 y T8 siguen pasando).

- [ ] **Step 3: Implementar los valuadores**

`backend/src/motor/valuadores/valuador.ts`:
```ts
import type { Decimal } from "../../compartido/decimal";
import type { Importe, Posicion, PrecioVigente } from "../tipos";

export type FuentePrecio = "MERCADO" | "MANUAL" | "COSTO" | "DEVENGADO";

export interface ValuacionPosicion {
  valor: Importe;
  /** Precio actual en la moneda en que el usuario opera el activo. */
  precio: Decimal | null;
  variacionPct: Decimal | null;
  sinCotizacion: boolean;
  fuente: FuentePrecio;
}

export interface ContextoValuacion {
  /** Pesos por dólar de referencia hoy. */
  dolar: Decimal;
  ahora: Date;
  /** Tasa nominal anual (%) de los instrumentos que devengan. */
  tasaAnual: Decimal | null;
}

/** Cómo se valúa una familia de instrumentos. */
export interface Valuador {
  valuar(
    posicion: Posicion,
    precio: PrecioVigente | undefined,
    contexto: ContextoValuacion,
  ): ValuacionPosicion;
}
```

`backend/src/motor/valuadores/por-cotizacion.ts`:
```ts
import type { Moneda } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import { cantidadDe, costoDe } from "../posicion";
import type { Importe, Posicion, PrecioVigente } from "../tipos";
import type { ContextoValuacion, ValuacionPosicion, Valuador } from "./valuador";

const MONEDAS_DOLAR: readonly Moneda[] = ["USD_MEP", "USD_CCL", "USD_EXTERIOR"];

interface Cotizacion {
  precio: Decimal;
  moneda: Moneda;
}

/** El precio en la moneda del usuario; si no hay, el de pesos; si no, cualquier dólar. */
function elegirCotizacion(precio: PrecioVigente, preferida: Moneda): Cotizacion | null {
  for (const moneda of [preferida, "ARS" as const, ...MONEDAS_DOLAR]) {
    const valor = precio.porMoneda[moneda];
    if (valor) return { precio: valor, moneda };
  }
  return null;
}

function convertir(valor: Decimal, desde: Moneda, hacia: Moneda, dolar: Decimal): Decimal {
  const desdePesos = desde === "ARS";
  if (desdePesos === (hacia === "ARS")) return valor;
  return desdePesos ? valor.div(dolar) : valor.mul(dolar);
}

/** Acciones, CEDEARs, bonos, ONs y letras: cantidad × precio de mercado × factor. */
export class ValuadorPorCotizacion implements Valuador {
  valuar(
    posicion: Posicion,
    precio: PrecioVigente | undefined,
    contexto: ContextoValuacion,
  ): ValuacionPosicion {
    const cotizacion = precio ? elegirCotizacion(precio, posicion.monedaPrecio) : null;
    if (!precio || !cotizacion) {
      return { valor: costoDe(posicion), precio: null, variacionPct: null, sinCotizacion: true, fuente: "COSTO" };
    }
    const bruto = cantidadDe(posicion).mul(cotizacion.precio).mul(posicion.factorPrecio);
    const valor: Importe =
      cotizacion.moneda === "ARS"
        ? { ars: bruto, usd: bruto.div(contexto.dolar) }
        : { ars: bruto.mul(contexto.dolar), usd: bruto };
    return {
      valor,
      precio: convertir(cotizacion.precio, cotizacion.moneda, posicion.monedaPrecio, contexto.dolar),
      variacionPct: precio.variacionPct,
      sinCotizacion: false,
      fuente: precio.fuente,
    };
  }
}
```

`backend/src/motor/valuadores/por-devengamiento.ts`:
```ts
import { Decimal } from "../../compartido/decimal";
import { IMPORTE_CERO, escalar, sumar } from "../importe";
import { costoDe } from "../posicion";
import type { Posicion, PrecioVigente } from "../tipos";
import type { ContextoValuacion, ValuacionPosicion, Valuador } from "./valuador";

const DIAS_POR_ANIO = 365;
const MS_POR_DIA = 86_400_000;
const CIEN = 100;

/** Plazos fijos y cauciones: capital más el interés de los días transcurridos. */
export class ValuadorPorDevengamiento implements Valuador {
  valuar(
    posicion: Posicion,
    _precio: PrecioVigente | undefined,
    contexto: ContextoValuacion,
  ): ValuacionPosicion {
    const { tasaAnual, ahora } = contexto;
    if (!tasaAnual) {
      return { valor: costoDe(posicion), precio: null, variacionPct: null, sinCotizacion: false, fuente: "COSTO" };
    }
    const valor = posicion.lotes.reduce((total, lote) => {
      const dias = Math.max(0, Math.floor((ahora.getTime() - lote.fecha.getTime()) / MS_POR_DIA));
      const factor = new Decimal(1).plus(tasaAnual.div(CIEN).mul(dias).div(DIAS_POR_ANIO));
      return sumar(total, escalar(lote.costo, factor));
    }, IMPORTE_CERO);
    return { valor, precio: null, variacionPct: null, sinCotizacion: false, fuente: "DEVENGADO" };
  }
}
```

`backend/src/motor/valuadores/fabrica.ts`:
```ts
import type { TipoInstrumento } from "@cartera/contratos";
import { ValuadorPorCotizacion } from "./por-cotizacion";
import { ValuadorPorDevengamiento } from "./por-devengamiento";
import type { Valuador } from "./valuador";

const POR_COTIZACION = new ValuadorPorCotizacion();
const POR_DEVENGAMIENTO = new ValuadorPorDevengamiento();
const TIPOS_QUE_DEVENGAN: ReadonlySet<TipoInstrumento> = new Set(["PLAZO_FIJO", "CAUCION"]);

export function valuadorPara(tipo: TipoInstrumento): Valuador {
  return TIPOS_QUE_DEVENGAN.has(tipo) ? POR_DEVENGAMIENTO : POR_COTIZACION;
}
```

- [ ] **Step 4: Totales y ponderación**

`backend/src/motor/totales.ts`:
```ts
import { CIEN, type Decimal } from "../compartido/decimal";
import { IMPORTE_CERO, importeDe, restar, sumar, sumarTodos } from "./importe";
import { costoDe } from "./posicion";
import type { EstadoCartera, Importe, Posicion } from "./tipos";
import type { ValuacionPosicion } from "./valuadores/valuador";

export interface PosicionValuada {
  posicion: Posicion;
  valuacion: ValuacionPosicion;
}

export interface PorcentajeDoble {
  ars: Decimal | null;
  usd: Decimal | null;
}

export interface TotalesCartera {
  /** Todo: posiciones más efectivo (si se registra). */
  valor: Importe;
  valorPosiciones: Importe;
  /** Lo que se pagó por lo que se tiene hoy. */
  invertido: Importe;
  noRealizado: Importe;
  realizado: Importe;
  cobros: Importe;
  comisionesSueltas: Importe;
  resultadoTotal: Importe;
  /** Todo lo que se pagó alguna vez: base del rendimiento. */
  costoHistorico: Importe;
  rendimientoPct: PorcentajeDoble;
  variacionDiaria: Importe;
  variacionDiariaPct: PorcentajeDoble;
  efectivo: Importe | null;
}

function porcentaje(parte: Importe, base: Importe): PorcentajeDoble {
  return {
    ars: base.ars.isZero() ? null : parte.ars.div(base.ars).mul(CIEN),
    usd: base.usd.isZero() ? null : parte.usd.div(base.usd).mul(CIEN),
  };
}

/** Parte del valor actual que cambió hoy: valor − valor / (1 + variación%). */
function variacionDelDia(valuadas: readonly PosicionValuada[]): Importe {
  return sumarTodos(
    valuadas.flatMap(({ valuacion }) => {
      const pct = valuacion.variacionPct;
      if (!pct || valuacion.sinCotizacion) return [];
      const divisor = pct.div(CIEN).plus(1);
      if (divisor.lte(0)) return [];
      const valor = valuacion.valor;
      return [restar(valor, { ars: valor.ars.div(divisor), usd: valor.usd.div(divisor) })];
    }),
  );
}

function efectivoComoImporte(estado: EstadoCartera, dolar: Decimal): Importe {
  let total = IMPORTE_CERO;
  for (const [moneda, monto] of estado.efectivo) total = sumar(total, importeDe(monto, moneda, dolar));
  return total;
}

export function totalizar(
  valuadas: readonly PosicionValuada[],
  estado: EstadoCartera,
  dolar: Decimal,
): TotalesCartera {
  const posiciones = [...estado.posiciones.values()];
  const valorPosiciones = sumarTodos(valuadas.map((v) => v.valuacion.valor));
  const invertido = sumarTodos(valuadas.map((v) => costoDe(v.posicion)));
  const noRealizado = restar(valorPosiciones, invertido);
  const realizado = sumarTodos(posiciones.map((p) => p.realizado));
  const cobros = sumarTodos(posiciones.map((p) => p.cobros));
  const costoHistorico = sumarTodos(posiciones.map((p) => p.costoHistorico));
  const efectivo = estado.registraEfectivo ? efectivoComoImporte(estado, dolar) : null;
  const resultadoTotal = restar(sumar(sumar(noRealizado, realizado), cobros), estado.comisionesSueltas);
  const variacionDiaria = variacionDelDia(valuadas);
  return {
    valor: efectivo ? sumar(valorPosiciones, efectivo) : valorPosiciones,
    valorPosiciones,
    invertido,
    noRealizado,
    realizado,
    cobros,
    comisionesSueltas: estado.comisionesSueltas,
    resultadoTotal,
    costoHistorico,
    rendimientoPct: porcentaje(resultadoTotal, costoHistorico),
    variacionDiaria,
    variacionDiariaPct: porcentaje(variacionDiaria, restar(valorPosiciones, variacionDiaria)),
    efectivo,
  };
}
```

`backend/src/motor/ponderacion.ts`:
```ts
import { CERO, CIEN, type Decimal } from "../compartido/decimal";

export interface EntradaPeso {
  clave: string;
  etiqueta: string;
  valor: Decimal;
}

export interface Peso extends EntradaPeso {
  porcentaje: Decimal;
}

/** Qué parte del total representa cada grupo, de mayor a menor. */
export function ponderar(entradas: readonly EntradaPeso[]): Peso[] {
  const porClave = new Map<string, EntradaPeso>();
  for (const entrada of entradas) {
    const actual = porClave.get(entrada.clave);
    porClave.set(entrada.clave, actual ? { ...actual, valor: actual.valor.plus(entrada.valor) } : { ...entrada });
  }
  const positivas = [...porClave.values()].filter((entrada) => entrada.valor.gt(0));
  const total = positivas.reduce((suma, entrada) => suma.plus(entrada.valor), CERO);
  return positivas
    .sort((a, b) => b.valor.comparedTo(a.valor) || a.etiqueta.localeCompare(b.etiqueta, "es"))
    .map((entrada) => ({ ...entrada, porcentaje: entrada.valor.div(total).mul(CIEN) }));
}
```

- [ ] **Step 5: Simulación**

`backend/src/motor/simulacion.ts`:
```ts
import type { Moneda } from "@cartera/contratos";
import type { Decimal } from "../compartido/decimal";
import { ErrorApp } from "../compartido/errores";
import type { EstrategiaCosto } from "./costo/estrategia-costo";
import { enMoneda } from "./importe";
import type { RegistroManejadores } from "./operaciones/registro-manejadores";
import { cantidadDe, claveDePosicion, costoDe } from "./posicion";
import { reconstruir } from "./tenencia";
import type { EstadoCartera, Importe, OperacionMotor } from "./tipos";

export type CambioSimulado =
  | { accion: "crear" | "editar"; operacion: OperacionMotor }
  | { accion: "borrar"; id: string };

export interface FotoPosicion {
  ticker: string;
  cantidad: Decimal;
  costo: Importe;
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
}

export type ResultadoSimulacion =
  | { valida: true; antes: FotoPosicion | null; despues: FotoPosicion | null }
  | { valida: false; mensaje: string };

export function aplicarCambio(
  operaciones: readonly OperacionMotor[],
  cambio: CambioSimulado,
): OperacionMotor[] {
  switch (cambio.accion) {
    case "crear":
      return [...operaciones, cambio.operacion];
    case "editar":
      return operaciones.map((op) => (op.id === cambio.operacion.id ? cambio.operacion : op));
    case "borrar":
      return operaciones.filter((op) => op.id !== cambio.id);
  }
}

function claveAfectada(operaciones: readonly OperacionMotor[], cambio: CambioSimulado): string | null {
  const operacion =
    cambio.accion === "borrar" ? operaciones.find((op) => op.id === cambio.id) : cambio.operacion;
  if (!operacion?.instrumentoId) return null;
  return claveDePosicion(operacion.carteraId, operacion.instrumentoId, operacion.cuentaId);
}

function foto(estado: EstadoCartera, clave: string): FotoPosicion | null {
  const posicion = estado.posiciones.get(clave);
  if (!posicion) return null;
  return {
    ticker: posicion.ticker,
    cantidad: cantidadDe(posicion),
    costo: costoDe(posicion),
    monedaPrecio: posicion.monedaPrecio,
    factorPrecio: posicion.factorPrecio,
  };
}

/** Qué pasaría con la posición afectada. Si el cambio deja la historia inválida, dice por qué. */
export function simular(
  operaciones: readonly OperacionMotor[],
  cambio: CambioSimulado,
  estrategia: EstrategiaCosto,
  registro: RegistroManejadores,
): ResultadoSimulacion {
  const clave = claveAfectada(operaciones, cambio);
  let despues: EstadoCartera;
  try {
    despues = reconstruir(aplicarCambio(operaciones, cambio), estrategia, registro);
  } catch (error) {
    if (error instanceof ErrorApp) return { valida: false, mensaje: error.message };
    throw error;
  }
  if (!clave) return { valida: true, antes: null, despues: null };
  const antes = reconstruir(operaciones, estrategia, registro);
  return { valida: true, antes: foto(antes, clave), despues: foto(despues, clave) };
}

/** Precio promedio por unidad (o cada 100 nominales), en la moneda del activo. */
export function precioPromedio(posicion: FotoPosicion): Decimal | null {
  if (posicion.cantidad.isZero()) return null;
  return enMoneda(posicion.costo, posicion.monedaPrecio).div(posicion.cantidad).div(posicion.factorPrecio);
}
```

- [ ] **Step 6: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 7: Mostrar el estado**

Run: `git status --short`

---
### Task 10: Mercado — horario, precios vigentes, dólar e histórico

**Files:**
- Create: `contratos/src/mercado.ts` · Modify: `contratos/src/index.ts`
- Create: `backend/src/modulos/mercado/horario-mercado.ts`, `mercado.servicio.ts`, `mercado.controlador.ts`, `mercado.rutas.ts`, `index.ts` (en `backend/src/modulos/mercado/`)
- Modify: `backend/src/contenedor.ts` (reemplazo completo), `backend/src/app.ts`
- Test: `backend/test/modulos/mercado/horario-mercado.test.ts`, `backend/test/modulos/mercado/mercado.servicio.test.ts`, `backend/test/modulos/mercado/mercado.api.test.ts`

**Interfaces:**
- Consumes: proveedores (T5); `InstrumentoCatalogado`, `PrecioManual`, `Simbolos` (T6); `PrecioVigente` (T7); `hoyEn`, `aFechaDia`, `formatoFechaCorta` (T3); `ErrorProveedorExterno`, `ErrorValidacion`.
- Produces:
  - contratos: `interface EstadoMercadoDto { abierto: boolean; proximaActualizacionEn: string | null; datosDe: string | null; desactualizado: boolean; mensaje: string }`
  - `INTERVALO_ACTUALIZACION_MS = 60_000`; `class HorarioMercado(feriados, zonaHoraria, ahora) { estaAbierto(momento?): Promise<boolean> }`
  - `interface FuentePreciosManuales { preciosManuales(usuarioId: string, ids: readonly string[]): Promise<Map<string, PrecioManual>> }`
  - `interface PreciosDelMercado { precios: Map<string, PrecioVigente>; datosDe: Date | null; desactualizado: boolean }`; `interface DolarVigente { tipo: TipoDolar; valor: Decimal; actualizadoEn: Date; desactualizado: boolean }`; `interface HistoricoActivo { disponible: boolean; moneda: Moneda; puntos: PuntoHistorico[] }`
  - `class MercadoServicio` con `precios(usuarioId, instrumentos: readonly InstrumentoCatalogado[]): Promise<PreciosDelMercado>`, `dolarVigente(tipo): Promise<DolarVigente>`, `dolarEnFecha(tipo, fecha: string): Promise<Decimal>`, `estado(datos: { datosDe: Date | null; desactualizado: boolean }): Promise<EstadoMercadoDto>`, `actualizar(): Promise<EstadoMercadoDto>`, `historico(instrumento, moneda, tipoDolar): Promise<HistoricoActivo>`
  - `interface ModuloMercado { servicio: MercadoServicio; rutas: Router }`; `crearModuloMercado(dependencias)`; `Contenedor` suma `mercado`; ruta `POST /api/cotizaciones/actualizar`

- [ ] **Step 1: Contrato del estado del mercado**

`contratos/src/mercado.ts`:
```ts
export interface EstadoMercadoDto {
  abierto: boolean;
  /** ISO 8601. null con el mercado cerrado: no hace falta volver a pedir. */
  proximaActualizacionEn: string | null;
  /** ISO 8601: de cuándo son los precios que se muestran. */
  datosDe: string | null;
  desactualizado: boolean;
  /** Frase lista para mostrar: "El mercado está abierto. Los precios se actualizan solos cada minuto." */
  mensaje: string;
}
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./mercado";
```

- [ ] **Step 2: Escribir los tests que fallan**

`backend/test/modulos/mercado/horario-mercado.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { HorarioMercado } from "../../../src/modulos/mercado/horario-mercado";
import { crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";

const ZONA = "America/Argentina/Buenos_Aires";

function horario(momento: string, feriadosCaidos = false) {
  const ahora = () => new Date(momento);
  const { argentinaDatos } = crearProveedoresPrueba({
    ahora,
    rutasExtra: feriadosCaidos ? { [URLS.feriados2026]: new Error("timeout") } : {},
  });
  return new HorarioMercado(argentinaDatos, ZONA, ahora);
}

describe("HorarioMercado (BYMA: lunes a viernes de 11 a 17, hora argentina)", () => {
  it.each([
    ["lunes 15:00", "2026-09-28T18:00:00Z", true],
    ["lunes 10:59", "2026-09-28T13:59:00Z", false],
    ["lunes 11:00", "2026-09-28T14:00:00Z", true],
    ["lunes 17:00 (ya cerró)", "2026-09-28T20:00:00Z", false],
    ["sábado 15:00", "2026-09-26T18:00:00Z", false],
    ["feriado 12/10 a las 15:00", "2026-10-12T18:00:00Z", false],
  ])("%s", async (_caso, momento, abierto) => {
    expect(await horario(momento).estaAbierto()).toBe(abierto);
  });

  it("si no se pueden consultar los feriados, un día hábil se toma como abierto", async () => {
    expect(await horario("2026-09-28T18:00:00Z", true).estaAbierto()).toBe(true);
  });
});
```

`backend/test/modulos/mercado/mercado.servicio.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/compartido/decimal";
import { ErrorValidacion } from "../../../src/compartido/errores";
import { HorarioMercado } from "../../../src/modulos/mercado/horario-mercado";
import { MercadoServicio } from "../../../src/modulos/mercado/mercado.servicio";
import type { InstrumentoCatalogado, PrecioManual } from "../../../src/modulos/instrumentos";
import {
  AHORA_FIXTURES,
  crearProveedoresPrueba,
  URLS,
} from "../../utilidades/proveedores-prueba";
import type { RespuestaFalsa } from "../../utilidades/http-falso";

const ZONA = "America/Argentina/Buenos_Aires";

function instrumento(datos: Partial<InstrumentoCatalogado>): InstrumentoCatalogado {
  return {
    id: "i-amzn",
    ticker: "AMZN",
    nombre: null,
    tipo: "CEDEAR",
    familia: "CEDEARS",
    simbolos: { ARS: "AMZN", USD_MEP: "AMZND", USD_CCL: "AMZNC" },
    factorPrecio: new Decimal(1),
    tasaAnual: null,
    emisor: null,
    sector: null,
    ...datos,
  };
}

const AMZN = instrumento({});
const YM39 = instrumento({ id: "i-ym39", ticker: "YM39O", tipo: "ON", familia: "OBLIGACIONES", simbolos: { ARS: "YM39O", USD_MEP: "YM39D" }, factorPrecio: new Decimal("0.01") });
const RARO = instrumento({ id: "i-raro", ticker: "RARO", simbolos: { ARS: "RARO" } });

function crear(rutasExtra: Record<string, RespuestaFalsa> = {}, manuales = new Map<string, PrecioManual>()) {
  const ahora = () => AHORA_FIXTURES;
  const p = crearProveedoresPrueba({ ahora, rutasExtra });
  const servicio = new MercadoServicio(
    p.cotizaciones,
    p.dolarActual,
    p.argentinaDatos,
    new HorarioMercado(p.argentinaDatos, ZONA, ahora),
    { preciosManuales: async () => manuales },
    ZONA,
    ahora,
  );
  return { servicio, buscar: p.buscar };
}

const caidas = (...urls: string[]) => Object.fromEntries(urls.map((u) => [u, new Error("caído")]));
const TODAS_LAS_LISTAS = [URLS.acciones, URLS.cedears, URLS.bonos, URLS.obligaciones, URLS.letras];

describe("precios vigentes", () => {
  it("junta el precio de cada moneda y la variación del día", async () => {
    const { servicio } = crear();
    const { precios, desactualizado, datosDe } = await servicio.precios("u1", [AMZN, YM39]);
    const amzn = precios.get("i-amzn");
    expect(amzn?.porMoneda.ARS?.toString()).toBe("2775");
    expect(amzn?.porMoneda.USD_MEP?.toString()).toBe("1.805");
    expect(amzn?.variacionPct?.toString()).toBe("-1.6");
    expect(amzn?.fuente).toBe("MERCADO");
    expect(precios.get("i-ym39")?.porMoneda.USD_MEP?.toString()).toBe("110.2");
    expect(desactualizado).toBe(false);
    expect(datosDe).toEqual(AHORA_FIXTURES);
  });

  it("sin cotización usa el precio manual del usuario", async () => {
    const manual: PrecioManual = { precio: new Decimal(500), moneda: "ARS", cargadoEn: new Date("2026-09-20T12:00:00Z") };
    const { servicio } = crear({}, new Map([["i-raro", manual]]));
    const { precios } = await servicio.precios("u1", [RARO]);
    expect(precios.get("i-raro")).toMatchObject({ fuente: "MANUAL", porMoneda: { ARS: new Decimal(500) } });
  });

  it("con data912 caído no falla: usa los manuales y marca desactualizado", async () => {
    const manual: PrecioManual = { precio: new Decimal(3000), moneda: "ARS", cargadoEn: AHORA_FIXTURES };
    const { servicio } = crear(caidas(...TODAS_LAS_LISTAS), new Map([["i-amzn", manual]]));
    const resultado = await servicio.precios("u1", [AMZN, YM39]);
    expect(resultado.desactualizado).toBe(true);
    expect(resultado.datosDe).toBeNull();
    expect(resultado.precios.get("i-amzn")?.fuente).toBe("MANUAL");
    expect(resultado.precios.has("i-ym39")).toBe(false);
  });
});

describe("dólar", () => {
  it("valor vigente del dólar de referencia", async () => {
    const dolar = await crear().servicio.dolarVigente("MEP");
    expect(dolar.valor.toString()).toBe("1556.5");
    expect(dolar.desactualizado).toBe(false);
  });

  it("si dolarapi falla, usa el último valor histórico y lo marca", async () => {
    const dolar = await crear(caidas(URLS.dolares)).servicio.dolarVigente("MEP");
    expect(dolar.valor.toString()).toBe("1557.3");
    expect(dolar.desactualizado).toBe(true);
  });

  it("para una fecha pasada usa el último valor hasta ese día (fines de semana incluidos)", async () => {
    const { servicio } = crear();
    expect((await servicio.dolarEnFecha("MEP", "2026-09-15")).toString()).toBe("1536.7");
    expect((await servicio.dolarEnFecha("MEP", "2026-09-20")).toString()).toBe("1540.1");
  });

  it("para hoy usa el valor vigente", async () => {
    expect((await crear().servicio.dolarEnFecha("MEP", "2026-09-28")).toString()).toBe("1556.5");
  });

  it("para una fecha sin datos pide cargar el tipo de cambio a mano", async () => {
    const error = await crear().servicio.dolarEnFecha("MEP", "2026-09-13").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorValidacion);
    expect((error as ErrorValidacion).message).toBe(
      "No tenemos el valor del dólar para el 13/09/2026. Cargá el tipo de cambio a mano.",
    );
    expect((error as ErrorValidacion).detalles?.[0]?.campo).toBe("tipoCambio");
  });
});

describe("histórico de precios", () => {
  it("un CEDEAR operado en dólares se convierte con el dólar de cada día", async () => {
    const historico = await crear().servicio.historico(AMZN, "USD_MEP", "MEP");
    expect(historico.disponible).toBe(true);
    expect(historico.moneda).toBe("USD_MEP");
    const ultimo = historico.puntos.at(-1);
    expect(ultimo?.fecha).toBe("2026-09-25");
    expect(ultimo?.cierre.toFixed(4)).toBe("1.8245");
  });

  it("en pesos devuelve la serie tal cual", async () => {
    const historico = await crear().servicio.historico(AMZN, "ARS", "MEP");
    expect(historico.puntos.at(-1)?.cierre.toString()).toBe("2820");
  });

  it("las ONs no tienen histórico y no se consulta la red", async () => {
    const { servicio, buscar } = crear();
    expect(await servicio.historico(YM39, "USD_MEP", "MEP")).toEqual({ disponible: false, moneda: "USD_MEP", puntos: [] });
    expect(buscar.llamadas.filter((u) => u.includes("historical"))).toHaveLength(0);
  });
});

describe("estado del mercado", () => {
  it("abierto y al día", async () => {
    const estado = await crear().servicio.estado({ datosDe: AHORA_FIXTURES, desactualizado: false });
    expect(estado).toEqual({
      abierto: true,
      proximaActualizacionEn: "2026-09-28T18:01:00.000Z",
      datosDe: "2026-09-28T18:00:00.000Z",
      desactualizado: false,
      mensaje: "El mercado está abierto. Los precios se actualizan solos cada minuto.",
    });
  });

  it("con precios viejos lo dice con la hora argentina", async () => {
    const estado = await crear().servicio.estado({ datosDe: new Date("2026-09-28T19:58:00Z"), desactualizado: true });
    expect(estado.mensaje).toBe("No pudimos actualizar los precios. Mostramos los de las 16:58 del 28/09.");
  });

  it("sin ningún precio explica qué se usa en su lugar", async () => {
    const estado = await crear().servicio.estado({ datosDe: null, desactualizado: true });
    expect(estado.mensaje).toBe(
      "No pudimos obtener los precios del mercado. Se usan los precios que cargaste a mano o, si no hay, lo que pagaste.",
    );
  });
});
```

`backend/test/modulos/mercado/mercado.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { crearAppPrueba, registrarUsuario, type AppPrueba } from "../../utilidades/app-prueba";

describe("POST /api/cotizaciones/actualizar", () => {
  let prueba: AppPrueba;
  beforeAll(async () => {
    prueba = await crearAppPrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("fuerza la actualización y devuelve el estado del mercado", async () => {
    const usuario = await registrarUsuario(prueba.app);
    const respuesta = await request(prueba.app)
      .post("/api/cotizaciones/actualizar")
      .set("Authorization", `Bearer ${usuario.token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ abierto: true, desactualizado: false });
    expect(prueba.buscar.llamadas.filter((u) => u.includes("/live/"))).toHaveLength(5);
  });
});
```

- [ ] **Step 3: Correrlos y ver que fallan**

Run: `npm test -w @cartera/backend -- test/modulos/mercado`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Horario del mercado**

`backend/src/modulos/mercado/horario-mercado.ts`:
```ts
import { ErrorProveedorExterno } from "../../compartido/errores";
import type { ProveedorFeriados } from "../../proveedores/dolar/proveedor-dolar";

const MINUTOS_POR_HORA = 60;
const APERTURA = 11 * MINUTOS_POR_HORA;
const CIERRE = 17 * MINUTOS_POR_HORA;
const DIAS_HABILES: ReadonlySet<string> = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/** Cada cuánto conviene volver a pedir precios con el mercado abierto. */
export const INTERVALO_ACTUALIZACION_MS = 60_000;

interface PartesLocales {
  fecha: string;
  anio: number;
  diaSemana: string;
  minutos: number;
}

function partesLocales(momento: Date, zonaHoraria: string): PartesLocales {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zonaHoraria,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(momento)
      .map((parte) => [parte.type, parte.value]),
  );
  return {
    fecha: `${partes["year"]}-${partes["month"]}-${partes["day"]}`,
    anio: Number(partes["year"]),
    diaSemana: partes["weekday"] ?? "",
    minutos: Number(partes["hour"]) * MINUTOS_POR_HORA + Number(partes["minute"]),
  };
}

/** BYMA opera de lunes a viernes de 11 a 17 (hora argentina), salvo feriados. */
export class HorarioMercado {
  constructor(
    private readonly feriados: ProveedorFeriados,
    private readonly zonaHoraria: string,
    private readonly ahora: () => Date,
  ) {}

  async estaAbierto(momento: Date = this.ahora()): Promise<boolean> {
    const partes = partesLocales(momento, this.zonaHoraria);
    const enHorario = partes.minutos >= APERTURA && partes.minutos < CIERRE;
    if (!DIAS_HABILES.has(partes.diaSemana) || !enHorario) return false;
    return !(await this.esFeriado(partes));
  }

  private async esFeriado(partes: PartesLocales): Promise<boolean> {
    try {
      return (await this.feriados.feriados(partes.anio)).valor.includes(partes.fecha);
    } catch (error) {
      // Sin la lista de feriados, un día hábil se toma como abierto (el proveedor ya lo registró).
      if (error instanceof ErrorProveedorExterno) return false;
      throw error;
    }
  }
}
```

- [ ] **Step 5: Servicio de mercado**

`backend/src/modulos/mercado/mercado.servicio.ts`:
```ts
import type { EstadoMercadoDto, Moneda, TipoDolar } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import { ErrorProveedorExterno, ErrorValidacion } from "../../compartido/errores";
import { aFechaDia, formatoFechaCorta, hoyEn } from "../../compartido/fechas";
import type { PrecioVigente } from "../../motor/tipos";
import type {
  FilaMercado,
  ListasMercado,
  ProveedorCotizaciones,
  PuntoHistorico,
} from "../../proveedores/cotizaciones/proveedor-cotizaciones";
import type { DatoConFecha } from "../../proveedores/http/proveedor-http-base";
import type {
  ProveedorDolarActual,
  ProveedorDolarHistorico,
  PuntoDolar,
} from "../../proveedores/dolar/proveedor-dolar";
import type { InstrumentoCatalogado, PrecioManual } from "../instrumentos";
import { INTERVALO_ACTUALIZACION_MS, type HorarioMercado } from "./horario-mercado";

export interface FuentePreciosManuales {
  preciosManuales(usuarioId: string, ids: readonly string[]): Promise<Map<string, PrecioManual>>;
}

export interface PreciosDelMercado {
  precios: Map<string, PrecioVigente>;
  datosDe: Date | null;
  desactualizado: boolean;
}

export interface DolarVigente {
  tipo: TipoDolar;
  valor: Decimal;
  actualizadoEn: Date;
  desactualizado: boolean;
}

export interface HistoricoActivo {
  disponible: boolean;
  moneda: Moneda;
  puntos: PuntoHistorico[];
}

/** Último valor con fecha menor o igual a la pedida (la serie viene ordenada por fecha). */
function ultimoHasta(serie: readonly PuntoDolar[], fecha: string): PuntoDolar | undefined {
  let encontrado: PuntoDolar | undefined;
  for (const punto of serie) {
    if (punto.fecha > fecha) break;
    encontrado = punto;
  }
  return encontrado;
}

export class MercadoServicio {
  constructor(
    private readonly cotizaciones: ProveedorCotizaciones,
    private readonly dolarActual: ProveedorDolarActual,
    private readonly dolarHistorico: ProveedorDolarHistorico,
    private readonly horario: HorarioMercado,
    private readonly manuales: FuentePreciosManuales,
    private readonly zonaHoraria: string,
    private readonly ahora: () => Date,
  ) {}

  /** Precio de cada instrumento: el de mercado; si no hay, el que cargó el usuario. */
  async precios(
    usuarioId: string,
    instrumentos: readonly InstrumentoCatalogado[],
  ): Promise<PreciosDelMercado> {
    const listas = await this.listasSinFallar();
    const porSimbolo = new Map<string, FilaMercado>();
    if (listas) {
      for (const filas of Object.values(listas.valor)) {
        for (const fila of filas) porSimbolo.set(fila.simbolo, fila);
      }
    }
    const manuales = await this.manuales.preciosManuales(usuarioId, instrumentos.map((i) => i.id));
    const precios = new Map<string, PrecioVigente>();
    for (const instrumento of instrumentos) {
      const deMercado = listas ? this.deMercado(instrumento, porSimbolo, listas) : null;
      const manual = manuales.get(instrumento.id);
      if (deMercado) precios.set(instrumento.id, deMercado);
      else if (manual) {
        precios.set(instrumento.id, {
          porMoneda: { [manual.moneda]: manual.precio },
          variacionPct: null,
          fuente: "MANUAL",
          actualizadoEn: manual.cargadoEn,
          desactualizado: false,
        });
      }
    }
    return {
      precios,
      datosDe: listas?.obtenidoEn ?? null,
      desactualizado: !listas || listas.desactualizado,
    };
  }

  async dolarVigente(tipo: TipoDolar): Promise<DolarVigente> {
    try {
      const actuales = await this.dolarActual.actuales();
      const cotizacion = actuales.valor.find((c) => c.tipo === tipo);
      if (cotizacion) {
        return {
          tipo,
          valor: cotizacion.venta,
          actualizadoEn: cotizacion.actualizadoEn,
          desactualizado: actuales.desactualizado,
        };
      }
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
    }
    const ultimo = (await this.serieDolar(tipo)).at(-1);
    if (!ultimo) {
      throw new ErrorProveedorExterno(
        "No pudimos obtener el valor del dólar para convertir tu cartera. Probá de nuevo en unos minutos.",
      );
    }
    return { tipo, valor: ultimo.venta, actualizadoEn: aFechaDia(ultimo.fecha), desactualizado: true };
  }

  /** Dólar de un día: hoy, el vigente; antes, el último cierre hasta ese día. */
  async dolarEnFecha(tipo: TipoDolar, fecha: string): Promise<Decimal> {
    if (fecha >= hoyEn(this.zonaHoraria, this.ahora())) return (await this.dolarVigente(tipo)).valor;
    const mensaje = `No tenemos el valor del dólar para el ${formatoFechaCorta(aFechaDia(fecha))}. Cargá el tipo de cambio a mano.`;
    let serie: PuntoDolar[];
    try {
      serie = await this.serieDolar(tipo);
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
      throw new ErrorValidacion(mensaje, [{ campo: "tipoCambio", mensaje }]);
    }
    const punto = ultimoHasta(serie, fecha);
    if (!punto) throw new ErrorValidacion(mensaje, [{ campo: "tipoCambio", mensaje }]);
    return punto.venta;
  }

  async estado(datos: { datosDe: Date | null; desactualizado: boolean }): Promise<EstadoMercadoDto> {
    const abierto = await this.horario.estaAbierto();
    return {
      abierto,
      proximaActualizacionEn: abierto
        ? new Date(this.ahora().getTime() + INTERVALO_ACTUALIZACION_MS).toISOString()
        : null,
      datosDe: datos.datosDe?.toISOString() ?? null,
      desactualizado: datos.desactualizado,
      mensaje: this.mensajeEstado(abierto, datos.datosDe, datos.desactualizado),
    };
  }

  /** Pide precios y dólar ignorando la caché (botón "Actualizar precios"). */
  async actualizar(): Promise<EstadoMercadoDto> {
    const listas = await this.listasSinFallar(true);
    try {
      await this.dolarActual.actuales(true);
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
    }
    return this.estado({
      datosDe: listas?.obtenidoEn ?? null,
      desactualizado: !listas || listas.desactualizado,
    });
  }

  /**
   * Cierres diarios del activo. data912 tiene acciones y CEDEARs solo en pesos, bonos en pesos
   * o dólares, y no tiene ONs ni letras. Una serie en pesos se pasa a dólares con el dólar de cada día.
   */
  async historico(
    instrumento: InstrumentoCatalogado,
    moneda: Moneda,
    tipoDolar: TipoDolar,
  ): Promise<HistoricoActivo> {
    const sinHistorico: HistoricoActivo = { disponible: false, moneda, puntos: [] };
    const familia = instrumento.familia;
    if (!familia || familia === "OBLIGACIONES" || familia === "LETRAS") return sinHistorico;
    const propio = familia === "BONOS" ? instrumento.simbolos[moneda] : undefined;
    const simbolo = propio ?? instrumento.simbolos.ARS;
    if (!simbolo) return sinHistorico;
    let puntos: PuntoHistorico[];
    try {
      puntos = (await this.cotizaciones.historico(familia, simbolo)).valor;
    } catch (error) {
      if (error instanceof ErrorProveedorExterno) return sinHistorico;
      throw error;
    }
    if (puntos.length === 0) return sinHistorico;
    const enPesos = !propio;
    if (!enPesos || moneda === "ARS") {
      return { disponible: true, moneda: propio ? moneda : "ARS", puntos };
    }
    return this.pasarADolares(puntos, moneda, tipoDolar);
  }

  private async pasarADolares(
    puntos: readonly PuntoHistorico[],
    moneda: Moneda,
    tipoDolar: TipoDolar,
  ): Promise<HistoricoActivo> {
    let serie: PuntoDolar[];
    try {
      serie = await this.serieDolar(tipoDolar);
    } catch (error) {
      if (error instanceof ErrorProveedorExterno) return { disponible: true, moneda: "ARS", puntos: [...puntos] };
      throw error;
    }
    const convertidos: PuntoHistorico[] = [];
    for (const punto of puntos) {
      const dolar = ultimoHasta(serie, punto.fecha);
      if (dolar) convertidos.push({ fecha: punto.fecha, cierre: punto.cierre.div(dolar.venta) });
    }
    return { disponible: convertidos.length > 0, moneda, puntos: convertidos };
  }

  private deMercado(
    instrumento: InstrumentoCatalogado,
    porSimbolo: ReadonlyMap<string, FilaMercado>,
    listas: DatoConFecha<ListasMercado>,
  ): PrecioVigente | null {
    const porMoneda: Partial<Record<Moneda, Decimal>> = {};
    let variacionPct: Decimal | null = null;
    for (const [moneda, simbolo] of Object.entries(instrumento.simbolos) as [Moneda, string][]) {
      const fila = porSimbolo.get(simbolo);
      if (!fila) continue;
      porMoneda[moneda] = fila.precio;
      if (moneda === "ARS" || variacionPct === null) variacionPct = fila.variacionPct ?? variacionPct;
    }
    if (Object.keys(porMoneda).length === 0) return null;
    return {
      porMoneda,
      variacionPct,
      fuente: "MERCADO",
      actualizadoEn: listas.obtenidoEn,
      desactualizado: listas.desactualizado,
    };
  }

  private async listasSinFallar(forzar = false): Promise<DatoConFecha<ListasMercado> | null> {
    try {
      return await this.cotizaciones.listas(forzar);
    } catch (error) {
      if (error instanceof ErrorProveedorExterno) return null;
      throw error;
    }
  }

  private async serieDolar(tipo: TipoDolar): Promise<PuntoDolar[]> {
    return (await this.dolarHistorico.historico(tipo)).valor;
  }

  private mensajeEstado(abierto: boolean, datosDe: Date | null, desactualizado: boolean): string {
    if (desactualizado && !datosDe) {
      return "No pudimos obtener los precios del mercado. Se usan los precios que cargaste a mano o, si no hay, lo que pagaste.";
    }
    if (desactualizado && datosDe) {
      const hora = new Intl.DateTimeFormat("es-AR", {
        timeZone: this.zonaHoraria,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(datosDe);
      const dia = new Intl.DateTimeFormat("es-AR", {
        timeZone: this.zonaHoraria,
        day: "2-digit",
        month: "2-digit",
      }).format(datosDe);
      return `No pudimos actualizar los precios. Mostramos los de las ${hora} del ${dia}.`;
    }
    return abierto
      ? "El mercado está abierto. Los precios se actualizan solos cada minuto."
      : "El mercado está cerrado. Mostramos los últimos precios disponibles.";
  }
}
```

- [ ] **Step 6: Controlador, rutas y módulo**

`backend/src/modulos/mercado/mercado.controlador.ts`:
```ts
import type { RequestHandler } from "express";
import type { MercadoServicio } from "./mercado.servicio";

export class MercadoControlador {
  constructor(private readonly servicio: MercadoServicio) {}

  readonly actualizar: RequestHandler = async (_req, res) => {
    res.json(await this.servicio.actualizar());
  };
}
```

`backend/src/modulos/mercado/mercado.rutas.ts`:
```ts
import { Router } from "express";
import type { MercadoControlador } from "./mercado.controlador";

export function crearRutasMercado(controlador: MercadoControlador): Router {
  const rutas = Router();
  rutas.post("/actualizar", controlador.actualizar);
  return rutas;
}
```

`backend/src/modulos/mercado/index.ts`:
```ts
import type { Router } from "express";
import type { ProveedorCotizaciones } from "../../proveedores/cotizaciones/proveedor-cotizaciones";
import type {
  ProveedorDolarActual,
  ProveedorDolarHistorico,
  ProveedorFeriados,
} from "../../proveedores/dolar/proveedor-dolar";
import { HorarioMercado } from "./horario-mercado";
import { MercadoControlador } from "./mercado.controlador";
import { crearRutasMercado } from "./mercado.rutas";
import { MercadoServicio, type FuentePreciosManuales } from "./mercado.servicio";

export type {
  MercadoServicio,
  DolarVigente,
  PreciosDelMercado,
  HistoricoActivo,
} from "./mercado.servicio";

export interface DependenciasMercado {
  cotizaciones: ProveedorCotizaciones;
  dolarActual: ProveedorDolarActual;
  dolarHistorico: ProveedorDolarHistorico;
  feriados: ProveedorFeriados;
  manuales: FuentePreciosManuales;
  zonaHoraria: string;
  ahora: () => Date;
}

export interface ModuloMercado {
  servicio: MercadoServicio;
  rutas: Router;
}

export function crearModuloMercado(dependencias: DependenciasMercado): ModuloMercado {
  const servicio = new MercadoServicio(
    dependencias.cotizaciones,
    dependencias.dolarActual,
    dependencias.dolarHistorico,
    new HorarioMercado(dependencias.feriados, dependencias.zonaHoraria, dependencias.ahora),
    dependencias.manuales,
    dependencias.zonaHoraria,
    dependencias.ahora,
  );
  return { servicio, rutas: crearRutasMercado(new MercadoControlador(servicio)) };
}
```

- [ ] **Step 7: Conectar el módulo**

En `backend/src/contenedor.ts`:
- Agregar el import: `import { crearModuloMercado, type ModuloMercado } from "./modulos/mercado";`
- En la interfaz `Contenedor`, agregar debajo de `instrumentos: ModuloInstrumentos;`: `mercado: ModuloMercado;`
- Reemplazar el `return { … };` final de `crearContenedor` por:
```ts
  const instrumentos = crearModuloInstrumentos(bd, proveedores.cotizaciones, ahora);
  const mercado = crearModuloMercado({
    ...proveedores,
    manuales: instrumentos.servicio,
    zonaHoraria: entorno.ZONA_HORARIA,
    ahora,
  });
  return {
    entorno,
    bd,
    ahora,
    proveedores,
    auditoria,
    autenticacion: crearModuloAutenticacion(bd, entorno),
    carteras: crearModuloCarteras(bd, auditoria),
    cuentas: crearModuloCuentas(bd, auditoria),
    instrumentos,
    mercado,
  };
```

En `backend/src/app.ts`, debajo de `privadas.use("/instrumentos", contenedor.instrumentos.rutas);` agregar:
```ts
  privadas.use("/cotizaciones", contenedor.mercado.rutas);
```

- [ ] **Step 8: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 9: Mostrar el estado**

Run: `git status --short`

---
### Task 11: Operaciones — alta, edición y borrado validados contra la historia, y simulación

**Files:**
- Modify: `contratos/src/operaciones.ts` (agregar al final)
- Create: `backend/src/compartido/preferencias.ts`
- Create: `backend/src/modulos/operaciones/operaciones.repositorio.ts`, `a-motor.ts`, `redaccion.ts`, `operaciones.esquemas.ts`, `operaciones.servicio.ts`, `operaciones.controlador.ts`, `operaciones.rutas.ts`, `index.ts` (en `backend/src/modulos/operaciones/`)
- Modify: `backend/src/contenedor.ts`, `backend/src/app.ts`
- Test: `backend/test/modulos/operaciones/redaccion.test.ts`, `backend/test/modulos/operaciones/operaciones.api.test.ts`

**Interfaces:**
- Consumes: motor completo (T7–T9); `InstrumentosServicio`, `InstrumentoCatalogado` (T6); `MercadoServicio.dolarEnFecha` (T10); `CarterasServicio.obtener`, `CuentasServicio.obtener` (plan 1); `ServicioAuditado`, `RepositorioDelUsuario`, `ControladorCrud`, `crearRutasCrud` (plan 1); esquemas (T3).
- Produces:
  - contratos: `TipoOperacionDisponible`, `OperacionConPrecioEntrada`, `CobroEntrada`, `MovimientoEfectivoEntrada`, `ComisionEntrada`, `DatosOperacionEntrada`, `CrearOperacionEntrada`, `EditarOperacionEntrada`, `SimularOperacionEntrada`, `InstrumentoResumidoDto`, `OperacionDto`, `EstadoPosicionDto`, `SimulacionDto`, `CampoOperacion`, `TipoOperacionDto`
  - `interface FuentePreferencias { yo(usuarioId: string): Promise<UsuarioDto> }`
  - `type OperacionConInstrumento`; `aOperacionMotor(operacion: OperacionConInstrumento): OperacionMotor`
  - `formatearPrecio(valor, moneda)`, `describirOperacion(datos): string`, `describirSimulacion(antes, despues): string`
  - `class OperacionesServicio` (CRUD + `simular(usuarioId, entrada)`, `tipos()`, `paraCalculo(usuarioId, carteraIds): Promise<OperacionMotor[]>`, `deActivo(usuarioId, carteraIds, instrumentoId): Promise<OperacionDto[]>`)
  - `interface ModuloOperaciones { servicio: OperacionesServicio; rutas: Router }`; `crearModuloOperaciones(bd, auditoria, dependencias)`; rutas `GET /api/operaciones`, `GET /api/operaciones/tipos`, `POST /api/operaciones/simular`, `GET|PATCH|DELETE /api/operaciones/:id`, `POST /api/operaciones`

- [ ] **Step 1: Completar los contratos de operaciones**

Reemplazar todo `contratos/src/operaciones.ts` por:
```ts
import type { Moneda } from "./comunes";

export type TipoOperacion =
  | "TENENCIA_INICIAL"
  | "COMPRA"
  | "VENTA"
  | "DIVIDENDO"
  | "RENTA"
  | "AMORTIZACION"
  | "SUSCRIPCION_FCI"
  | "RESCATE_FCI"
  | "DEPOSITO"
  | "EXTRACCION"
  | "COMPRA_MONEDA"
  | "VENTA_MONEDA"
  | "CAUCION_COLOCACION"
  | "CAUCION_VENCIMIENTO"
  | "COMISION"
  | "IMPUESTO"
  | "SPLIT"
  | "CANJE"
  | "TRANSFERENCIA_ENTRADA"
  | "TRANSFERENCIA_SALIDA"
  | "AJUSTE";

/** Tipos que se pueden registrar en la etapa 1. */
export type TipoOperacionDisponible =
  | "TENENCIA_INICIAL"
  | "COMPRA"
  | "VENTA"
  | "DIVIDENDO"
  | "RENTA"
  | "AMORTIZACION"
  | "DEPOSITO"
  | "EXTRACCION"
  | "COMISION";

interface DatosComunesOperacion {
  cuentaId?: string | null;
  /** AAAA-MM-DD */
  fecha: string;
  moneda: Moneda;
  /** Pesos por dólar de ese día. Si no se manda, lo completa el backend con el histórico. */
  tipoCambio?: number | null;
  notas?: string | null;
}

export interface OperacionConPrecioEntrada extends DatosComunesOperacion {
  tipo: "TENENCIA_INICIAL" | "COMPRA" | "VENTA";
  instrumentoId: string;
  cantidad: number;
  precio: number;
  comision?: number;
  derechosMercado?: number;
  iva?: number;
  otrosGastos?: number;
}

export interface CobroEntrada extends DatosComunesOperacion {
  tipo: "DIVIDENDO" | "RENTA" | "AMORTIZACION";
  instrumentoId: string;
  monto: number;
}

export interface MovimientoEfectivoEntrada extends DatosComunesOperacion {
  tipo: "DEPOSITO" | "EXTRACCION";
  monto: number;
}

export interface ComisionEntrada extends DatosComunesOperacion {
  tipo: "COMISION";
  instrumentoId?: string | null;
  monto: number;
}

export type DatosOperacionEntrada =
  | OperacionConPrecioEntrada
  | CobroEntrada
  | MovimientoEfectivoEntrada
  | ComisionEntrada;

export type CrearOperacionEntrada = DatosOperacionEntrada & { carteraId: string };
export type EditarOperacionEntrada = DatosOperacionEntrada;

export type SimularOperacionEntrada =
  | { accion: "crear"; operacion: CrearOperacionEntrada }
  | { accion: "editar"; id: string; operacion: EditarOperacionEntrada }
  | { accion: "borrar"; id: string };

export interface InstrumentoResumidoDto {
  id: string;
  ticker: string;
  nombre: string | null;
}

export interface OperacionDto {
  id: string;
  carteraId: string;
  cuentaId: string | null;
  tipo: TipoOperacion;
  tipoTexto: string;
  fecha: string;
  instrumento: InstrumentoResumidoDto | null;
  cantidad: number | null;
  precio: number | null;
  moneda: Moneda;
  monto: number | null;
  gastos: number;
  tipoCambio: number;
  notas: string | null;
  origen: "MANUAL" | "IMPORTACION" | "SISTEMA";
  /** "Compra de 100 AMZN a $ 2.785,00" */
  descripcion: string;
  creadoEn: string;
}

export interface EstadoPosicionDto {
  cantidad: number;
  precioPromedio: number | null;
  moneda: Moneda;
}

export interface SimulacionDto {
  valida: boolean;
  /** Qué va a pasar ("Tu tenencia de AMZN pasa de 72 a 172…") o por qué no se puede. */
  mensaje: string;
  antes: EstadoPosicionDto | null;
  despues: EstadoPosicionDto | null;
}

export type CampoOperacion = "instrumento" | "cantidad" | "precio" | "gastos" | "monto";

export interface TipoOperacionDto {
  tipo: TipoOperacionDisponible;
  texto: string;
  descripcion: string;
  /** Qué campos pide el formulario para este tipo. */
  campos: CampoOperacion[];
}
```

- [ ] **Step 2: Puerto de preferencias del usuario**

`backend/src/compartido/preferencias.ts`:
```ts
import type { UsuarioDto } from "@cartera/contratos";

/** Lo que otros módulos necesitan del usuario: moneda, dólar de referencia y método de costo. */
export interface FuentePreferencias {
  yo(usuarioId: string): Promise<UsuarioDto>;
}
```

- [ ] **Step 3: Escribir el test de redacción (que falla)**

`backend/test/modulos/operaciones/redaccion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/compartido/decimal";
import {
  describirOperacion,
  describirSimulacion,
  formatearPrecio,
} from "../../../src/modulos/operaciones/redaccion";
import type { FotoPosicion } from "../../../src/motor/simulacion";

const d = (valor: string | number) => new Decimal(valor);

function foto(cantidad: number, costoArs: number, costoUsd: number, moneda: FotoPosicion["monedaPrecio"] = "ARS"): FotoPosicion {
  return { ticker: "AMZN", cantidad: d(cantidad), costo: { ars: d(costoArs), usd: d(costoUsd) }, monedaPrecio: moneda, factorPrecio: d(1) };
}

describe("redacción de operaciones", () => {
  it("los precios chicos llevan más decimales", () => {
    expect(formatearPrecio(d(2785), "ARS")).toBe("$ 2.785,00");
    expect(formatearPrecio(d("1.805"), "USD_MEP")).toBe("US$ 1,8050");
  });

  it("describe cada tipo en una frase", () => {
    const base = { ticker: "AMZN", cantidad: d(100), precio: d(2785), monto: null, moneda: "ARS" as const };
    expect(describirOperacion({ ...base, tipo: "COMPRA" })).toBe("Compra de 100 AMZN a $ 2.785,00");
    expect(describirOperacion({ ...base, tipo: "TENENCIA_INICIAL" })).toBe("Tenencia inicial de 100 AMZN a $ 2.785,00 promedio");
    expect(describirOperacion({ ...base, tipo: "VENTA" })).toBe("Venta de 100 AMZN a $ 2.785,00");
    const cobro = { ticker: "YPFD", cantidad: null, precio: null, monto: d("12.5"), moneda: "USD_MEP" as const };
    expect(describirOperacion({ ...cobro, tipo: "DIVIDENDO" })).toBe("Dividendo de YPFD por US$ 12,50");
    expect(describirOperacion({ ...cobro, tipo: "RENTA" })).toBe("Renta (cupón) de YPFD por US$ 12,50");
    expect(describirOperacion({ ...cobro, tipo: "DEPOSITO", ticker: null })).toBe("Depósito de US$ 12,50");
    expect(describirOperacion({ ...cobro, tipo: "COMISION", ticker: null })).toBe("Comisión o gasto por US$ 12,50");
  });

  it("explica el efecto de una operación sobre la tenencia", () => {
    expect(describirSimulacion(foto(72, 180000, 120), foto(172, 458500, 305))).toBe(
      "Tu tenencia de AMZN pasa de 72 a 172 y tu precio promedio de $ 2.500,00 a $ 2.665,70.",
    );
    expect(describirSimulacion(null, foto(72, 180000, 120))).toBe(
      "Vas a tener 72 AMZN con un precio promedio de $ 2.500,00.",
    );
    expect(describirSimulacion(foto(72, 180000, 120), foto(22, 55000, 36.67))).toBe(
      "Tu tenencia de AMZN pasa de 72 a 22.",
    );
    expect(describirSimulacion(foto(72, 180000, 120), foto(0, 0, 0))).toBe("Tu tenencia de AMZN pasa de 72 a 0.");
    expect(describirSimulacion(null, null)).toBe("La operación se puede registrar.");
  });
});
```

- [ ] **Step 4: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/operaciones/redaccion`
Expected: FAIL — módulo inexistente.

- [ ] **Step 5: Implementar la redacción**

`backend/src/modulos/operaciones/redaccion.ts`:
```ts
import type { Moneda, TipoOperacion } from "@cartera/contratos";
import type { Decimal } from "../../compartido/decimal";
import { formatearMoneda, formatearNumero } from "../../compartido/formato";
import { TEXTO_TIPO_OPERACION } from "../../motor/operaciones/textos";
import { precioPromedio, type FotoPosicion } from "../../motor/simulacion";

const DECIMALES_CANTIDAD = 6;
const UMBRAL_PRECIO_CHICO = 10;
const DECIMALES_PRECIO_CHICO = 4;

/** Precios menores a 10 (típicos en dólares) llevan 4 decimales; el resto, 2. */
export function formatearPrecio(valor: Decimal, moneda: Moneda): string {
  return formatearMoneda(
    valor,
    moneda,
    valor.abs().lt(UMBRAL_PRECIO_CHICO) ? DECIMALES_PRECIO_CHICO : 2,
  );
}

export interface DatosDescripcion {
  tipo: TipoOperacion;
  ticker: string | null;
  cantidad: Decimal | null;
  precio: Decimal | null;
  monto: Decimal | null;
  moneda: Moneda;
}

export function describirOperacion(datos: DatosDescripcion): string {
  const texto = TEXTO_TIPO_OPERACION[datos.tipo];
  const activo = datos.ticker ?? "";
  if (datos.cantidad && datos.precio) {
    const detalle = `${texto} de ${formatearNumero(datos.cantidad, DECIMALES_CANTIDAD)} ${activo} a ${formatearPrecio(datos.precio, datos.moneda)}`;
    return datos.tipo === "TENENCIA_INICIAL" ? `${detalle} promedio` : detalle;
  }
  if (datos.monto) {
    const monto = formatearMoneda(datos.monto, datos.moneda);
    if (datos.tipo === "COMISION") return datos.ticker ? `${texto} de ${activo} por ${monto}` : `${texto} por ${monto}`;
    return datos.ticker ? `${texto} de ${activo} por ${monto}` : `${texto} de ${monto}`;
  }
  return texto;
}

function promedioTexto(posicion: FotoPosicion): string | null {
  const promedio = precioPromedio(posicion);
  return promedio ? formatearPrecio(promedio, posicion.monedaPrecio) : null;
}

export function describirSimulacion(antes: FotoPosicion | null, despues: FotoPosicion | null): string {
  if (!antes && !despues) return "La operación se puede registrar.";
  if (!antes && despues) {
    const promedio = promedioTexto(despues);
    const cantidad = formatearNumero(despues.cantidad, DECIMALES_CANTIDAD);
    return promedio
      ? `Vas a tener ${cantidad} ${despues.ticker} con un precio promedio de ${promedio}.`
      : `Vas a tener ${cantidad} ${despues.ticker}.`;
  }
  const referencia = (antes ?? despues) as FotoPosicion;
  const cantidadAntes = antes ? formatearNumero(antes.cantidad, DECIMALES_CANTIDAD) : "0";
  const cantidadDespues = despues ? formatearNumero(despues.cantidad, DECIMALES_CANTIDAD) : "0";
  const base = `Tu tenencia de ${referencia.ticker} pasa de ${cantidadAntes} a ${cantidadDespues}`;
  const promedioAntes = antes ? promedioTexto(antes) : null;
  const promedioDespues = despues ? promedioTexto(despues) : null;
  if (promedioAntes && promedioDespues && promedioAntes !== promedioDespues) {
    return `${base} y tu precio promedio de ${promedioAntes} a ${promedioDespues}.`;
  }
  return `${base}.`;
}
```

- [ ] **Step 6: Correr el test de redacción**

Run: `npm test -w @cartera/backend -- test/modulos/operaciones/redaccion`
Expected: PASS.

- [ ] **Step 7: Escribir el test de API (que falla)**

`backend/test/modulos/operaciones/operaciones.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CarteraDto, InstrumentoDto, OperacionDto, Pagina } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";

describe("API de operaciones", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  let cartera: string;
  let amzn: string;
  let ym39: string;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  async function instrumento(q: string): Promise<string> {
    const respuesta = await request(prueba.app).get(`/api/instrumentos/buscar?q=${q}`).set(auth(ana)).expect(200);
    const [primero] = respuesta.body as InstrumentoDto[];
    if (!primero) throw new Error(`sin ${q}`);
    return primero.id;
  }

  function crear(cuerpo: object, usuario = ana) {
    return request(prueba.app).post("/api/operaciones").set(auth(usuario)).send({ carteraId: cartera, ...cuerpo });
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(ana)).expect(200);
    cartera = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    amzn = await instrumento("AMZN");
    ym39 = await instrumento("YM39O");
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("registra una tenencia inicial, completa el dólar del día y la describe", async () => {
    const respuesta = await crear({ tipo: "TENENCIA_INICIAL", instrumentoId: amzn, fecha: "2026-09-15", cantidad: 72, precio: 1.5, moneda: "USD_MEP" });
    expect(respuesta.status).toBe(201);
    const operacion = respuesta.body as OperacionDto;
    expect(operacion).toMatchObject({
      tipo: "TENENCIA_INICIAL",
      tipoTexto: "Tenencia inicial",
      fecha: "2026-09-15",
      instrumento: { id: amzn, ticker: "AMZN" },
      cantidad: 72,
      precio: 1.5,
      moneda: "USD_MEP",
      tipoCambio: 1536.7,
      gastos: 0,
      origen: "MANUAL",
      descripcion: "Tenencia inicial de 72 AMZN a US$ 1,5000 promedio",
    });
    const auditoria = await prueba.bd.registroAuditoria.findMany({ where: { entidadId: operacion.id } });
    expect(auditoria.map((r) => r.accion)).toEqual(["CREAR"]);
  });

  it("respeta el tipo de cambio que carga el usuario", async () => {
    const respuesta = await crear({ tipo: "TENENCIA_INICIAL", instrumentoId: ym39, fecha: "2026-09-16", cantidad: 344, precio: 109.3, moneda: "USD_MEP", tipoCambio: 1500 });
    expect(respuesta.body.tipoCambio).toBe(1500);
  });

  it("para una fecha sin dólar histórico pide cargarlo a mano; con el dato, funciona", async () => {
    const sinDato = await crear({ tipo: "DEPOSITO", fecha: "2015-06-01", monto: 1000, moneda: "USD_MEP" });
    expect(sinDato.status).toBe(400);
    expect(sinDato.body.error.mensaje).toBe("No tenemos el valor del dólar para el 01/06/2015. Cargá el tipo de cambio a mano.");
    expect(sinDato.body.error.detalles[0].campo).toBe("tipoCambio");
    const conDato = await crear({ tipo: "DEPOSITO", fecha: "2015-06-01", monto: 1000, moneda: "USD_MEP", tipoCambio: 12.5 });
    expect(conDato.status).toBe(201);
  });

  it("no acepta fechas futuras", async () => {
    const respuesta = await crear({ tipo: "DEPOSITO", fecha: "2026-09-29", monto: 10, moneda: "ARS" });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0]).toEqual({ campo: "fecha", mensaje: "La fecha no puede ser posterior a hoy." });
  });

  it("rechaza vender más de lo que había, con fecha y cantidades", async () => {
    const respuesta = await crear({ tipo: "VENTA", instrumentoId: amzn, fecha: "2026-09-20", cantidad: 100, precio: 1.9, moneda: "USD_MEP" });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toBe("El 20/09/2026 vendés 100 AMZN, pero en ese momento tenías 72.");
  });

  it("no deja borrar una operación si una venta posterior quedaría sin tenencia", async () => {
    const compra = await crear({ tipo: "COMPRA", instrumentoId: ym39, fecha: "2026-09-17", cantidad: 100, precio: 110, moneda: "USD_MEP" });
    const venta = await crear({ tipo: "VENTA", instrumentoId: ym39, fecha: "2026-09-21", cantidad: 400, precio: 111, moneda: "USD_MEP" });
    expect(venta.status).toBe(201);
    const borrar = await request(prueba.app).delete(`/api/operaciones/${compra.body.id}`).set(auth(ana));
    expect(borrar.status).toBe(409);
    expect(borrar.body.error.mensaje).toBe(
      "No se puede borrar esta operación: el 21/09/2026 vendés 400 YM39O, pero en ese momento tenías 344.",
    );
  });

  it("editar valida la historia completa", async () => {
    const compra = await crear({ tipo: "COMPRA", instrumentoId: amzn, fecha: "2026-09-18", cantidad: 10, precio: 1.8, moneda: "USD_MEP" });
    const editada = await request(prueba.app)
      .patch(`/api/operaciones/${compra.body.id}`)
      .set(auth(ana))
      .send({ tipo: "COMPRA", instrumentoId: amzn, fecha: "2026-09-18", cantidad: 20, precio: 1.8, moneda: "USD_MEP" });
    expect(editada.status).toBe(200);
    expect(editada.body.cantidad).toBe(20);
    const inicial = await request(prueba.app).get(`/api/operaciones?tipo=TENENCIA_INICIAL&instrumentoId=${amzn}`).set(auth(ana));
    const idInicial = (inicial.body as Pagina<OperacionDto>).items[0]?.id;
    await crear({ tipo: "VENTA", instrumentoId: amzn, fecha: "2026-09-22", cantidad: 90, precio: 1.9, moneda: "USD_MEP" }).expect(201);
    const invalida = await request(prueba.app)
      .patch(`/api/operaciones/${idInicial}`)
      .set(auth(ana))
      .send({ tipo: "TENENCIA_INICIAL", instrumentoId: amzn, fecha: "2026-09-15", cantidad: 10, precio: 1.5, moneda: "USD_MEP" });
    expect(invalida.status).toBe(400);
    expect(invalida.body.error.mensaje).toBe("El 22/09/2026 vendés 90 AMZN, pero en ese momento tenías 30.");
  });

  it("lista con filtros, de la más nueva a la más vieja", async () => {
    const respuesta = await request(prueba.app).get(`/api/operaciones?instrumentoId=${amzn}`).set(auth(ana)).expect(200);
    const fechas = (respuesta.body as Pagina<OperacionDto>).items.map((o) => o.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect(fechas.length).toBeGreaterThanOrEqual(3);
  });

  it("simula una compra y explica el efecto sin guardar nada", async () => {
    const antes = await prueba.bd.operacion.count();
    const respuesta = await request(prueba.app)
      .post("/api/operaciones/simular")
      .set(auth(ana))
      .send({ accion: "crear", operacion: { carteraId: cartera, tipo: "COMPRA", instrumentoId: amzn, fecha: "2026-09-23", cantidad: 100, precio: 2, moneda: "USD_MEP" } });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.valida).toBe(true);
    // AMZN a esta altura: 72 (inicial) + 20 (compra editada) − 90 (venta) = 2.
    expect(respuesta.body.mensaje).toBe(
      "Tu tenencia de AMZN pasa de 2 a 102 y tu precio promedio de US$ 1,5652 a US$ 1,9915.",
    );
    expect(respuesta.body.antes).toMatchObject({ cantidad: 2, moneda: "USD_MEP" });
    expect(respuesta.body.despues).toMatchObject({ cantidad: 102 });
    expect(await prueba.bd.operacion.count()).toBe(antes);
  });

  it("simular un borrado inválido explica por qué no se puede", async () => {
    const inicial = await request(prueba.app).get(`/api/operaciones?tipo=TENENCIA_INICIAL&instrumentoId=${amzn}`).set(auth(ana));
    const id = (inicial.body as Pagina<OperacionDto>).items[0]?.id;
    const respuesta = await request(prueba.app).post("/api/operaciones/simular").set(auth(ana)).send({ accion: "borrar", id });
    // Sin la inicial quedan solo los 20 de la compra para la venta de 90.
    expect(respuesta.body).toMatchObject({ valida: false, mensaje: "El 22/09/2026 vendés 90 AMZN, pero en ese momento tenías 20." });
  });

  it("lista los tipos disponibles con los campos que pide cada uno", async () => {
    const respuesta = await request(prueba.app).get("/api/operaciones/tipos").set(auth(ana)).expect(200);
    expect(respuesta.body).toHaveLength(9);
    expect(respuesta.body[0]).toEqual({
      tipo: "TENENCIA_INICIAL",
      texto: "Tenencia inicial",
      descripcion: "Un activo que ya tenías, con su cantidad y su precio promedio de compra. No mueve efectivo.",
      campos: ["instrumento", "cantidad", "precio", "gastos"],
    });
    expect(respuesta.body.find((t: { tipo: string }) => t.tipo === "DEPOSITO").campos).toEqual(["monto"]);
  });

  it("valida con mensajes llanos", async () => {
    const tipoRaro = await crear({ tipo: "SPLIT", fecha: "2026-09-10", moneda: "ARS" });
    expect(tipoRaro.status).toBe(400);
    expect(tipoRaro.body.error.detalles[0].mensaje).toBe("Elegí qué tipo de operación querés registrar.");
    const negativa = await crear({ tipo: "COMPRA", instrumentoId: amzn, fecha: "2026-09-10", cantidad: -5, precio: 1, moneda: "ARS" });
    expect(negativa.body.error.detalles).toEqual([{ campo: "cantidad", mensaje: "Tiene que ser un número mayor a cero." }]);
  });

  it("aislamiento: no se puede operar en carteras ajenas ni ver operaciones de otro", async () => {
    const enAjena = await crear({ tipo: "DEPOSITO", fecha: "2026-09-10", monto: 10, moneda: "ARS" }, beto);
    expect(enAjena.status).toBe(404);
    expect(enAjena.body.error.mensaje).toBe("No se encontró la cartera.");
    const deAna = await request(prueba.app).get("/api/operaciones").set(auth(ana));
    const id = (deAna.body as Pagina<OperacionDto>).items[0]?.id;
    expect((await request(prueba.app).get(`/api/operaciones/${id}`).set(auth(beto))).status).toBe(404);
    expect((await request(prueba.app).delete(`/api/operaciones/${id}`).set(auth(beto))).status).toBe(404);
    expect((await request(prueba.app).get("/api/operaciones").set(auth(beto))).body.items).toEqual([]);
  });

  it("un activo inexistente da 404 en castellano", async () => {
    const respuesta = await crear({ tipo: "COMPRA", instrumentoId: "no-existe", fecha: "2026-09-10", cantidad: 1, precio: 1, moneda: "ARS" });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró el activo.");
  });
});
```

- [ ] **Step 8: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/operaciones/operaciones.api`
Expected: FAIL — `/api/operaciones` no existe.

- [ ] **Step 9: Repositorio y conversión al motor**

`backend/src/modulos/operaciones/operaciones.repositorio.ts`:
```ts
import type { Operacion, Prisma } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import type { Donde } from "../../compartido/repositorios/delegado-prisma";
import { RepositorioDelUsuario } from "../../compartido/repositorios/repositorio-del-usuario";
import type { OperacionConInstrumento } from "./a-motor";

export type NuevaOperacion = Prisma.OperacionUncheckedCreateInput;
export type EdicionOperacion = Pick<
  Prisma.OperacionUncheckedUpdateInput,
  | "tipo"
  | "cuentaId"
  | "instrumentoId"
  | "fechaConcertacion"
  | "cantidad"
  | "precio"
  | "moneda"
  | "tipoCambio"
  | "comision"
  | "derechosMercado"
  | "iva"
  | "otrosGastos"
  | "montoNeto"
  | "notas"
>;

export class OperacionesRepositorio extends RepositorioDelUsuario<
  Operacion,
  NuevaOperacion,
  NuevaOperacion,
  EdicionOperacion
> {
  protected readonly entidad = "la operación";
  protected readonly camposOrdenables = ["fechaConcertacion", "creadoEn", "tipo"] as const;
  protected readonly ordenPorDefecto = "fechaConcertacion";

  protected delegado(bd: ClienteBD) {
    return bd.operacion;
  }

  /** Una operación es del usuario si su cartera (no borrada) es suya. */
  protected override alcance(usuarioId: string): Donde {
    return { cartera: { usuarioId, eliminadoEn: null } };
  }

  /** El servicio valida la cartera antes de crear. */
  protected conDueno(_usuarioId: string, datos: NuevaOperacion): NuevaOperacion {
    return datos;
  }

  /** Toda la historia de esas carteras, con el instrumento, para el motor. */
  deCarteras(
    carteraIds: readonly string[],
    bd: ClienteBD = this.bd,
    instrumentoId?: string,
  ): Promise<OperacionConInstrumento[]> {
    return bd.operacion.findMany({
      where: {
        carteraId: { in: [...carteraIds] },
        eliminadoEn: null,
        ...(instrumentoId ? { instrumentoId } : {}),
      },
      include: { instrumento: true },
      orderBy: [{ fechaConcertacion: "asc" }, { creadoEn: "asc" }],
    });
  }
}
```

`backend/src/modulos/operaciones/a-motor.ts`:
```ts
import type { Instrumento, Operacion } from "../../generado/prisma/client";
import { CERO, Decimal, aDecimal } from "../../compartido/decimal";
import type { OperacionMotor } from "../../motor/tipos";

export type OperacionConInstrumento = Operacion & { instrumento: Instrumento | null };

function decimalONulo(valor: { toString(): string } | null): Decimal | null {
  return valor === null ? null : aDecimal(valor);
}

export function gastosDe(operacion: Operacion): Decimal {
  return [operacion.comision, operacion.derechosMercado, operacion.iva, operacion.otrosGastos].reduce<Decimal>(
    (total, gasto) => total.plus(aDecimal(gasto)),
    CERO,
  );
}

export function aOperacionMotor(operacion: OperacionConInstrumento): OperacionMotor {
  return {
    id: operacion.id,
    tipo: operacion.tipo,
    fecha: operacion.fechaConcertacion,
    secuencia: operacion.creadoEn.getTime(),
    carteraId: operacion.carteraId,
    cuentaId: operacion.cuentaId,
    instrumentoId: operacion.instrumentoId,
    ticker: operacion.instrumento?.ticker ?? null,
    cantidad: decimalONulo(operacion.cantidad),
    precio: decimalONulo(operacion.precio),
    moneda: operacion.moneda,
    // Siempre se completa al guardar; el 1 solo protege de una fila cargada a mano en la base.
    tipoCambio: operacion.tipoCambio ? aDecimal(operacion.tipoCambio) : new Decimal(1),
    gastos: gastosDe(operacion),
    monto: decimalONulo(operacion.montoNeto),
    factorPrecio: operacion.instrumento ? aDecimal(operacion.instrumento.factorPrecio) : new Decimal(1),
  };
}
```

- [ ] **Step 10: Esquemas**

`backend/src/modulos/operaciones/operaciones.esquemas.ts`:
```ts
import { z } from "zod";
import type { TipoOperacionDisponible } from "@cartera/contratos";
import {
  esquemaDecimalNoNegativo,
  esquemaDecimalPositivo,
  esquemaFechaDia,
  esquemaMoneda,
} from "../../compartido/esquemas";
import { esquemaConsultaListado } from "../../compartido/paginacion";

const LARGO_MAXIMO_NOTAS = 500;
const MENSAJE_TIPO = "Elegí qué tipo de operación querés registrar.";

export const TIPOS_DISPONIBLES = [
  "TENENCIA_INICIAL",
  "COMPRA",
  "VENTA",
  "DIVIDENDO",
  "RENTA",
  "AMORTIZACION",
  "DEPOSITO",
  "EXTRACCION",
  "COMISION",
] as const satisfies readonly TipoOperacionDisponible[];

const id = (mensaje: string) => z.string({ message: mensaje }).min(1, mensaje);
const instrumentoId = id("Elegí el activo.");
const gasto = esquemaDecimalNoNegativo.optional();

const comunes = {
  cuentaId: z.string().min(1).nullable().optional(),
  fecha: esquemaFechaDia,
  moneda: esquemaMoneda,
  tipoCambio: esquemaDecimalPositivo.nullable().optional(),
  notas: z
    .string()
    .trim()
    .max(LARGO_MAXIMO_NOTAS, `Las notas pueden tener hasta ${LARGO_MAXIMO_NOTAS} caracteres.`)
    .nullable()
    .optional(),
};

function conPrecio<T extends "TENENCIA_INICIAL" | "COMPRA" | "VENTA">(tipo: T) {
  return z.object({
    tipo: z.literal(tipo),
    ...comunes,
    instrumentoId,
    cantidad: esquemaDecimalPositivo,
    precio: esquemaDecimalPositivo,
    comision: gasto,
    derechosMercado: gasto,
    iva: gasto,
    otrosGastos: gasto,
  });
}

function cobro<T extends "DIVIDENDO" | "RENTA" | "AMORTIZACION">(tipo: T) {
  return z.object({ tipo: z.literal(tipo), ...comunes, instrumentoId, monto: esquemaDecimalPositivo });
}

function efectivo<T extends "DEPOSITO" | "EXTRACCION">(tipo: T) {
  return z.object({ tipo: z.literal(tipo), ...comunes, monto: esquemaDecimalPositivo });
}

export const esquemaDatosOperacion = z.discriminatedUnion(
  "tipo",
  [
    conPrecio("TENENCIA_INICIAL"),
    conPrecio("COMPRA"),
    conPrecio("VENTA"),
    cobro("DIVIDENDO"),
    cobro("RENTA"),
    cobro("AMORTIZACION"),
    efectivo("DEPOSITO"),
    efectivo("EXTRACCION"),
    z.object({
      tipo: z.literal("COMISION"),
      ...comunes,
      instrumentoId: instrumentoId.nullable().optional(),
      monto: esquemaDecimalPositivo,
    }),
  ],
  { message: MENSAJE_TIPO },
);

export const esquemaCrearOperacion = esquemaDatosOperacion.and(
  z.object({ carteraId: id("Elegí la cartera.") }),
);

export const esquemaSimularOperacion = z.discriminatedUnion(
  "accion",
  [
    z.object({ accion: z.literal("crear"), operacion: esquemaCrearOperacion }),
    z.object({ accion: z.literal("editar"), id: id("Falta la operación."), operacion: esquemaDatosOperacion }),
    z.object({ accion: z.literal("borrar"), id: id("Falta la operación.") }),
  ],
  { message: "Elegí qué querés simular: crear, editar o borrar." },
);

export const esquemaConsultaOperaciones = esquemaConsultaListado.extend({
  direccion: z.enum(["asc", "desc"]).default("desc"),
  carteraId: z.string().min(1).optional(),
  instrumentoId: z.string().min(1).optional(),
  tipo: z.enum(TIPOS_DISPONIBLES).optional(),
  desde: esquemaFechaDia.optional(),
  hasta: esquemaFechaDia.optional(),
});

export type DatosOperacion = z.output<typeof esquemaDatosOperacion>;
export type EntradaCrearOperacion = z.output<typeof esquemaCrearOperacion>;
export type EntradaSimularOperacion = z.output<typeof esquemaSimularOperacion>;
export type ConsultaOperaciones = z.output<typeof esquemaConsultaOperaciones>;
```

- [ ] **Step 11: Servicio**

`backend/src/modulos/operaciones/operaciones.servicio.ts`:
```ts
import type {
  CampoOperacion,
  EstadoPosicionDto,
  OperacionDto,
  Pagina,
  SimulacionDto,
  TipoOperacionDto,
  UsuarioDto,
} from "@cartera/contratos";
import type { Operacion, PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { ServicioAuditado } from "../../compartido/auditoria/servicio-auditado";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { CERO, aDecimal, aNumero, type Decimal } from "../../compartido/decimal";
import { ErrorConflicto, ErrorValidacion } from "../../compartido/errores";
import { aFechaDia, aTextoDia, hoyEn } from "../../compartido/fechas";
import type { ServicioCrud } from "../../compartido/http/controlador-crud";
import { mapearPagina } from "../../compartido/paginacion";
import type { FuentePreferencias } from "../../compartido/preferencias";
import { estrategiaDeCosto } from "../../motor/costo/estrategia-costo";
import { crearRegistroManejadores } from "../../motor/operaciones/registro-manejadores";
import { TEXTO_TIPO_OPERACION } from "../../motor/operaciones/textos";
import {
  aplicarCambio,
  precioPromedio,
  simular,
  type CambioSimulado,
  type FotoPosicion,
} from "../../motor/simulacion";
import { reconstruir } from "../../motor/tenencia";
import type { OperacionMotor } from "../../motor/tipos";
import type { CarterasServicio } from "../carteras";
import type { CuentasServicio } from "../cuentas";
import type { InstrumentoCatalogado, InstrumentosServicio } from "../instrumentos";
import type { MercadoServicio } from "../mercado";
import { aOperacionMotor, gastosDe } from "./a-motor";
import type {
  ConsultaOperaciones,
  DatosOperacion,
  EntradaCrearOperacion,
  EntradaSimularOperacion,
} from "./operaciones.esquemas";
import type {
  EdicionOperacion,
  NuevaOperacion,
  OperacionesRepositorio,
} from "./operaciones.repositorio";
import { describirOperacion, describirSimulacion } from "./redaccion";

const DECIMALES_CANTIDAD = 6;
const DECIMALES_PRECIO = 6;
const DECIMALES_MONTO = 2;
const DECIMALES_TIPO_CAMBIO = 4;
/** Una operación nueva va última entre las del mismo día. */
const SECUENCIA_NUEVA = Number.MAX_SAFE_INTEGER;

const CAMPOS_POR_TIPO: Record<TipoOperacionDto["tipo"], CampoOperacion[]> = {
  TENENCIA_INICIAL: ["instrumento", "cantidad", "precio", "gastos"],
  COMPRA: ["instrumento", "cantidad", "precio", "gastos"],
  VENTA: ["instrumento", "cantidad", "precio", "gastos"],
  DIVIDENDO: ["instrumento", "monto"],
  RENTA: ["instrumento", "monto"],
  AMORTIZACION: ["instrumento", "monto"],
  DEPOSITO: ["monto"],
  EXTRACCION: ["monto"],
  COMISION: ["instrumento", "monto"],
};

export interface DependenciasOperaciones {
  carteras: CarterasServicio;
  cuentas: CuentasServicio;
  instrumentos: InstrumentosServicio;
  mercado: MercadoServicio;
  usuarios: FuentePreferencias;
  zonaHoraria: string;
  ahora: () => Date;
}

/** Campos de la operación validada, sin importar el tipo. */
function camposDe(datos: DatosOperacion) {
  const conPrecio = "precio" in datos ? datos : null;
  return {
    instrumentoId: "instrumentoId" in datos ? (datos.instrumentoId ?? null) : null,
    cantidad: conPrecio?.cantidad ?? null,
    precio: conPrecio?.precio ?? null,
    comision: conPrecio?.comision ?? CERO,
    derechosMercado: conPrecio?.derechosMercado ?? CERO,
    iva: conPrecio?.iva ?? CERO,
    otrosGastos: conPrecio?.otrosGastos ?? CERO,
    monto: "monto" in datos ? datos.monto : null,
  };
}

/** Columnas que se guardan: sirven tanto para crear como para editar. */
interface DatosGuardables {
  tipo: DatosOperacion["tipo"];
  cuentaId: string | null;
  instrumentoId: string | null;
  fechaConcertacion: Date;
  cantidad: string | null;
  precio: string | null;
  moneda: DatosOperacion["moneda"];
  tipoCambio: string;
  comision: string;
  derechosMercado: string;
  iva: string;
  otrosGastos: string;
  montoNeto: string | null;
  notas: string | null;
}

interface Preparada {
  datos: DatosGuardables;
  motor: OperacionMotor;
  preferencias: UsuarioDto;
}

function comoTexto(valor: Decimal | null): string | null {
  return valor === null ? null : valor.toString();
}

function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export class OperacionesServicio
  extends ServicioAuditado<Operacion, NuevaOperacion, NuevaOperacion, EdicionOperacion>
  implements ServicioCrud<OperacionDto, EntradaCrearOperacion, DatosOperacion, ConsultaOperaciones>
{
  protected readonly entidadAuditada = "Operacion";
  private readonly registro = crearRegistroManejadores();

  constructor(
    bd: PrismaClient,
    private readonly operaciones: OperacionesRepositorio,
    auditoria: AuditoriaRepositorio,
    private readonly dependencias: DependenciasOperaciones,
  ) {
    super(bd, operaciones, auditoria);
  }

  async listar(usuarioId: string, consulta: ConsultaOperaciones): Promise<Pagina<OperacionDto>> {
    const { carteraId, instrumentoId, tipo, desde, hasta, ...listado } = consulta;
    const filtros = {
      ...(carteraId ? { carteraId } : {}),
      ...(instrumentoId ? { instrumentoId } : {}),
      ...(tipo ? { tipo } : {}),
      ...(desde || hasta
        ? {
            fechaConcertacion: {
              ...(desde ? { gte: aFechaDia(desde) } : {}),
              ...(hasta ? { lte: aFechaDia(hasta) } : {}),
            },
          }
        : {}),
    };
    const pagina = await this.operaciones.listar(usuarioId, { ...listado, filtros });
    const instrumentos = await this.instrumentosDe(pagina.items);
    return mapearPagina(pagina, (operacion) => this.aDto(operacion, instrumentos));
  }

  async obtener(usuarioId: string, id: string): Promise<OperacionDto> {
    const operacion = await this.operaciones.obtener(usuarioId, id);
    return this.aDto(operacion, await this.instrumentosDe([operacion]));
  }

  async crear(usuarioId: string, entrada: EntradaCrearOperacion): Promise<OperacionDto> {
    const preparada = await this.preparar(usuarioId, entrada, entrada.carteraId, {
      id: "nueva",
      secuencia: SECUENCIA_NUEVA,
    });
    const creada = await this.crearAuditadoCon(usuarioId, async (tx) => {
      const existentes = await this.historia(entrada.carteraId, tx);
      this.validarHistoria(
        aplicarCambio(existentes, { accion: "crear", operacion: preparada.motor }),
        preparada.preferencias,
      );
      const nueva: NuevaOperacion = { ...preparada.datos, carteraId: entrada.carteraId, origen: "MANUAL" };
      return nueva;
    });
    return this.obtener(usuarioId, creada.id);
  }

  async editar(usuarioId: string, id: string, entrada: DatosOperacion): Promise<OperacionDto> {
    const actual = await this.operaciones.obtener(usuarioId, id);
    const preparada = await this.preparar(usuarioId, entrada, actual.carteraId, {
      id,
      secuencia: actual.creadoEn.getTime(),
    });
    const edicion: EdicionOperacion = preparada.datos;
    await this.editarAuditado(usuarioId, id, edicion, async (tx) => {
      const existentes = await this.historia(actual.carteraId, tx);
      this.validarHistoria(
        aplicarCambio(existentes, { accion: "editar", operacion: preparada.motor }),
        preparada.preferencias,
      );
    });
    return this.obtener(usuarioId, id);
  }

  async borrar(usuarioId: string, id: string): Promise<void> {
    const actual = await this.operaciones.obtener(usuarioId, id);
    const preferencias = await this.dependencias.usuarios.yo(usuarioId);
    await this.borrarAuditado(usuarioId, id, async (tx) => {
      const existentes = await this.historia(actual.carteraId, tx);
      try {
        this.validarHistoria(aplicarCambio(existentes, { accion: "borrar", id }), preferencias);
      } catch (error) {
        if (error instanceof ErrorValidacion) {
          throw new ErrorConflicto(`No se puede borrar esta operación: ${minusculaInicial(error.message)}`);
        }
        throw error;
      }
    });
  }

  async simular(usuarioId: string, entrada: EntradaSimularOperacion): Promise<SimulacionDto> {
    let carteraId: string;
    let cambio: CambioSimulado;
    let preferencias: UsuarioDto;
    if (entrada.accion === "crear") {
      carteraId = entrada.operacion.carteraId;
      const preparada = await this.preparar(usuarioId, entrada.operacion, carteraId, {
        id: "nueva",
        secuencia: SECUENCIA_NUEVA,
      });
      cambio = { accion: "crear", operacion: preparada.motor };
      preferencias = preparada.preferencias;
    } else {
      const actual = await this.operaciones.obtener(usuarioId, entrada.id);
      carteraId = actual.carteraId;
      if (entrada.accion === "editar") {
        const preparada = await this.preparar(usuarioId, entrada.operacion, carteraId, {
          id: entrada.id,
          secuencia: actual.creadoEn.getTime(),
        });
        cambio = { accion: "editar", operacion: preparada.motor };
        preferencias = preparada.preferencias;
      } else {
        cambio = { accion: "borrar", id: entrada.id };
        preferencias = await this.dependencias.usuarios.yo(usuarioId);
      }
    }
    const resultado = simular(
      await this.historia(carteraId, this.bd),
      cambio,
      estrategiaDeCosto(preferencias.metodoCosto),
      this.registro,
    );
    if (!resultado.valida) {
      return { valida: false, mensaje: resultado.mensaje, antes: null, despues: null };
    }
    return {
      valida: true,
      mensaje: describirSimulacion(resultado.antes, resultado.despues),
      antes: this.aEstadoPosicion(resultado.antes),
      despues: this.aEstadoPosicion(resultado.despues),
    };
  }

  tipos(): TipoOperacionDto[] {
    return this.registro.disponibles().flatMap((tipo) => {
      const campos = CAMPOS_POR_TIPO[tipo.tipo as TipoOperacionDto["tipo"]];
      return campos ? [{ ...tipo, tipo: tipo.tipo as TipoOperacionDto["tipo"], campos }] : [];
    });
  }

  /** Historia de las carteras (ya verificadas como del usuario) para el motor. */
  async paraCalculo(carteraIds: readonly string[]): Promise<OperacionMotor[]> {
    return (await this.operaciones.deCarteras(carteraIds)).map(aOperacionMotor);
  }

  async deActivo(carteraIds: readonly string[], instrumentoId: string): Promise<OperacionDto[]> {
    const operaciones = await this.operaciones.deCarteras(carteraIds, undefined, instrumentoId);
    const instrumentos = await this.instrumentosDe(operaciones);
    return operaciones.reverse().map((operacion) => this.aDto(operacion, instrumentos));
  }

  private async preparar(
    usuarioId: string,
    datos: DatosOperacion,
    carteraId: string,
    identidad: { id: string; secuencia: number },
  ): Promise<Preparada> {
    const { carteras, cuentas, instrumentos, mercado, usuarios, zonaHoraria, ahora } = this.dependencias;
    await carteras.obtener(usuarioId, carteraId);
    if (datos.cuentaId) await cuentas.obtener(usuarioId, datos.cuentaId);
    const campos = camposDe(datos);
    const instrumento: InstrumentoCatalogado | null = campos.instrumentoId
      ? await instrumentos.catalogado(campos.instrumentoId)
      : null;
    if (datos.fecha > hoyEn(zonaHoraria, ahora())) {
      throw new ErrorValidacion("La fecha no puede ser posterior a hoy.", [
        { campo: "fecha", mensaje: "La fecha no puede ser posterior a hoy." },
      ]);
    }
    const preferencias = await usuarios.yo(usuarioId);
    const tipoCambio = datos.tipoCambio ?? (await mercado.dolarEnFecha(preferencias.dolarReferencia, datos.fecha));
    const guardables: DatosGuardables = {
      tipo: datos.tipo,
      cuentaId: datos.cuentaId ?? null,
      instrumentoId: campos.instrumentoId,
      fechaConcertacion: aFechaDia(datos.fecha),
      cantidad: comoTexto(campos.cantidad),
      precio: comoTexto(campos.precio),
      moneda: datos.moneda,
      tipoCambio: tipoCambio.toString(),
      comision: campos.comision.toString(),
      derechosMercado: campos.derechosMercado.toString(),
      iva: campos.iva.toString(),
      otrosGastos: campos.otrosGastos.toString(),
      montoNeto: comoTexto(campos.monto),
      notas: datos.notas ?? null,
    };
    const motor: OperacionMotor = {
      id: identidad.id,
      tipo: datos.tipo,
      fecha: aFechaDia(datos.fecha),
      secuencia: identidad.secuencia,
      carteraId,
      cuentaId: datos.cuentaId ?? null,
      instrumentoId: campos.instrumentoId,
      ticker: instrumento?.ticker ?? null,
      cantidad: campos.cantidad,
      precio: campos.precio,
      moneda: datos.moneda,
      tipoCambio,
      gastos: campos.comision.plus(campos.derechosMercado).plus(campos.iva).plus(campos.otrosGastos),
      monto: campos.monto,
      factorPrecio: instrumento?.factorPrecio ?? aDecimal(1),
    };
    return { datos: guardables, motor, preferencias };
  }

  private async historia(carteraId: string, bd: ClienteBD): Promise<OperacionMotor[]> {
    return (await this.operaciones.deCarteras([carteraId], bd)).map(aOperacionMotor);
  }

  /** Recalcula toda la historia: si algo queda inválido, el motor explica qué y cuándo. */
  private validarHistoria(operaciones: readonly OperacionMotor[], preferencias: UsuarioDto): void {
    reconstruir(operaciones, estrategiaDeCosto(preferencias.metodoCosto), this.registro);
  }

  private async instrumentosDe(
    operaciones: readonly Operacion[],
  ): Promise<Map<string, InstrumentoCatalogado>> {
    const ids = [...new Set(operaciones.flatMap((o) => (o.instrumentoId ? [o.instrumentoId] : [])))];
    return this.dependencias.instrumentos.catalogados(ids);
  }

  private aDto(operacion: Operacion, instrumentos: ReadonlyMap<string, InstrumentoCatalogado>): OperacionDto {
    const instrumento = operacion.instrumentoId ? instrumentos.get(operacion.instrumentoId) : undefined;
    const cantidad = operacion.cantidad ? aDecimal(operacion.cantidad) : null;
    const precio = operacion.precio ? aDecimal(operacion.precio) : null;
    const monto = operacion.montoNeto ? aDecimal(operacion.montoNeto) : null;
    return {
      id: operacion.id,
      carteraId: operacion.carteraId,
      cuentaId: operacion.cuentaId,
      tipo: operacion.tipo,
      tipoTexto: TEXTO_TIPO_OPERACION[operacion.tipo],
      fecha: aTextoDia(operacion.fechaConcertacion),
      instrumento: instrumento
        ? { id: instrumento.id, ticker: instrumento.ticker, nombre: instrumento.nombre }
        : null,
      cantidad: cantidad ? aNumero(cantidad, DECIMALES_CANTIDAD) : null,
      precio: precio ? aNumero(precio, DECIMALES_PRECIO) : null,
      moneda: operacion.moneda,
      monto: monto ? aNumero(monto, DECIMALES_MONTO) : null,
      gastos: aNumero(gastosDe(operacion), DECIMALES_MONTO),
      tipoCambio: aNumero(aDecimal(operacion.tipoCambio ?? 1), DECIMALES_TIPO_CAMBIO),
      notas: operacion.notas,
      origen: operacion.origen,
      descripcion: describirOperacion({
        tipo: operacion.tipo,
        ticker: instrumento?.ticker ?? null,
        cantidad,
        precio,
        monto,
        moneda: operacion.moneda,
      }),
      creadoEn: operacion.creadoEn.toISOString(),
    };
  }

  private aEstadoPosicion(foto: FotoPosicion | null): EstadoPosicionDto | null {
    if (!foto) return null;
    const promedio = precioPromedio(foto);
    return {
      cantidad: aNumero(foto.cantidad, DECIMALES_CANTIDAD),
      precioPromedio: promedio ? aNumero(promedio, DECIMALES_PRECIO) : null,
      moneda: foto.monedaPrecio,
    };
  }
}
```

> Nota de diseño: `paraCalculo` y `deActivo` reciben carteras **ya verificadas** como del usuario (el módulo de resumen las obtiene de `CarterasServicio`); por eso no reciben `usuarioId`.

- [ ] **Step 12: Controlador, rutas y módulo**

`backend/src/modulos/operaciones/operaciones.controlador.ts`:
```ts
import type { RequestHandler } from "express";
import type { OperacionDto } from "@cartera/contratos";
import { ControladorCrud } from "../../compartido/http/controlador-crud";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import {
  esquemaConsultaOperaciones,
  esquemaCrearOperacion,
  esquemaDatosOperacion,
  esquemaSimularOperacion,
  type ConsultaOperaciones,
  type DatosOperacion,
  type EntradaCrearOperacion,
} from "./operaciones.esquemas";
import type { OperacionesServicio } from "./operaciones.servicio";

export class OperacionesControlador extends ControladorCrud<
  OperacionDto,
  EntradaCrearOperacion,
  DatosOperacion,
  ConsultaOperaciones
> {
  constructor(private readonly operaciones: OperacionesServicio) {
    super(operaciones, {
      crear: esquemaCrearOperacion,
      editar: esquemaDatosOperacion,
      consulta: esquemaConsultaOperaciones,
    });
  }

  readonly tipos: RequestHandler = (_req, res) => {
    res.json(this.operaciones.tipos());
  };

  readonly simular: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaSimularOperacion, req.body);
    res.json(await this.operaciones.simular(usuarioDe(req).id, entrada));
  };
}
```

`backend/src/modulos/operaciones/operaciones.rutas.ts`:
```ts
import { Router } from "express";
import { crearRutasCrud } from "../../compartido/http/rutas-crud";
import type { OperacionesControlador } from "./operaciones.controlador";

export function crearRutasOperaciones(controlador: OperacionesControlador): Router {
  const rutas = Router();
  // Antes que las rutas con :id, para que "tipos" y "simular" no se tomen como un id.
  rutas.get("/tipos", controlador.tipos);
  rutas.post("/simular", controlador.simular);
  rutas.use(crearRutasCrud(controlador));
  return rutas;
}
```

`backend/src/modulos/operaciones/index.ts`:
```ts
import type { Router } from "express";
import type { PrismaClient } from "../../generado/prisma/client";
import type { AuditoriaRepositorio } from "../../compartido/auditoria/auditoria.repositorio";
import { OperacionesControlador } from "./operaciones.controlador";
import { OperacionesRepositorio } from "./operaciones.repositorio";
import { crearRutasOperaciones } from "./operaciones.rutas";
import { OperacionesServicio, type DependenciasOperaciones } from "./operaciones.servicio";

export type { OperacionesServicio, DependenciasOperaciones } from "./operaciones.servicio";

export interface ModuloOperaciones {
  servicio: OperacionesServicio;
  rutas: Router;
}

export function crearModuloOperaciones(
  bd: PrismaClient,
  auditoria: AuditoriaRepositorio,
  dependencias: DependenciasOperaciones,
): ModuloOperaciones {
  const servicio = new OperacionesServicio(bd, new OperacionesRepositorio(bd), auditoria, dependencias);
  return { servicio, rutas: crearRutasOperaciones(new OperacionesControlador(servicio)) };
}
```

- [ ] **Step 13: Conectar el módulo**

En `backend/src/contenedor.ts`:
- Agregar el import: `import { crearModuloOperaciones, type ModuloOperaciones } from "./modulos/operaciones";`
- En la interfaz `Contenedor`, agregar debajo de `mercado: ModuloMercado;`: `operaciones: ModuloOperaciones;`
- En `crearContenedor`, reemplazar el `return { … };` final por:
```ts
  const autenticacion = crearModuloAutenticacion(bd, entorno);
  const carteras = crearModuloCarteras(bd, auditoria);
  const cuentas = crearModuloCuentas(bd, auditoria);
  const operaciones = crearModuloOperaciones(bd, auditoria, {
    carteras: carteras.servicio,
    cuentas: cuentas.servicio,
    instrumentos: instrumentos.servicio,
    mercado: mercado.servicio,
    usuarios: autenticacion.servicio,
    zonaHoraria: entorno.ZONA_HORARIA,
    ahora,
  });
  return {
    entorno,
    bd,
    ahora,
    proveedores,
    auditoria,
    autenticacion,
    carteras,
    cuentas,
    instrumentos,
    mercado,
    operaciones,
  };
```

En `backend/src/app.ts`, debajo de `privadas.use("/cotizaciones", contenedor.mercado.rutas);` agregar:
```ts
  privadas.use("/operaciones", contenedor.operaciones.rutas);
```

- [ ] **Step 14: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 15: Mostrar el estado**

Run: `git status --short`

---
### Task 12: Resumen de la cartera

**Files:**
- Create: `contratos/src/resumen.ts` · Modify: `contratos/src/index.ts`
- Modify: `backend/src/modulos/carteras/carteras.repositorio.ts`, `backend/src/modulos/carteras/carteras.servicio.ts` (método `idsActivas`)
- Create: `backend/src/modulos/resumen/redaccion.ts`, `calculo.ts`, `resumen.esquemas.ts`, `resumen.servicio.ts`, `resumen.controlador.ts`, `resumen.rutas.ts`, `index.ts` (en `backend/src/modulos/resumen/`)
- Modify: `backend/src/contenedor.ts`, `backend/src/app.ts`
- Test: `backend/test/modulos/resumen/redaccion.test.ts`, `backend/test/modulos/resumen/resumen.api.test.ts`

**Interfaces:**
- Consumes: motor (T7–T9); `InstrumentosServicio` (T6); `MercadoServicio` (T10); `OperacionesServicio.paraCalculo` (T11); `CarterasServicio.obtener` (plan 1); `FuentePreferencias` (T11); formato (T3).
- Produces:
  - contratos: `MonedaVista`, `ClaveTarjeta`, `Tono`, `TarjetaDto`, `FuentePrecioDto`, `TenenciaDto`, `PesoDto`, `EfectivoDto`, `DolarDto`, `ResumenDto`, `PuntoHistoricoDto`, `MarcaOperacionDto`, `HistoricoActivoDto`, `ActivoDto`
  - `CarterasServicio.idsActivas(usuarioId): Promise<string[]>`
  - `redactarFrase(totales, vista, abierto, vacio): string`
  - `interface TenenciaAgrupada`; `agruparPorInstrumento(valuadas, catalogo): TenenciaAgrupada[]` (ordenadas por valor)
  - `class ResumenServicio { obtener(usuarioId, consulta): Promise<ResumenDto>; activo(usuarioId, instrumentoId, consulta): Promise<ActivoDto> }` (el segundo lo completa la Tarea 13)
  - `interface ModuloResumen { servicio; rutasResumen: Router; rutasActivos: Router }`; `crearModuloResumen(dependencias)`; ruta `GET /api/resumen?carteraId=&moneda=`

- [ ] **Step 1: Contratos del resumen y de la ficha**

`contratos/src/resumen.ts`:
```ts
import type { Moneda, TipoDolar } from "./comunes";
import type { InstrumentoDto, TipoInstrumento } from "./instrumentos";
import type { EstadoMercadoDto } from "./mercado";
import type { OperacionDto, TipoOperacion } from "./operaciones";

/** Moneda en la que se muestran los totales. */
export type MonedaVista = "ARS" | "USD";

export type ClaveTarjeta =
  | "valorActual"
  | "invertido"
  | "noRealizado"
  | "realizado"
  | "cobros"
  | "rendimiento"
  | "variacionDiaria";

export type Tono = "positivo" | "negativo" | "neutro";

export interface TarjetaDto {
  clave: ClaveTarjeta;
  titulo: string;
  /** Qué significa el número, en lenguaje llano. */
  explicacion: string;
  valor: number;
  porcentaje: number | null;
  tono: Tono;
}

export type FuentePrecioDto = "MERCADO" | "MANUAL" | "COSTO" | "DEVENGADO";

export interface TenenciaDto {
  instrumentoId: string;
  ticker: string;
  nombre: string | null;
  tipo: TipoInstrumento;
  tipoTexto: string;
  cantidad: number;
  /** Moneda en la que el usuario opera este activo: la de precios promedio y actual. */
  monedaPrecio: Moneda;
  precioPromedio: number | null;
  precioActual: number | null;
  variacionDiariaPct: number | null;
  /** En la moneda de la vista. */
  valor: number;
  invertido: number;
  resultado: number;
  resultadoPct: number | null;
  realizado: number;
  cobros: number;
  /** Porcentaje de la cartera. */
  peso: number;
  sinCotizacion: boolean;
  fuentePrecio: FuentePrecioDto;
  explicacionPrecio: string;
}

export interface PesoDto {
  clave: string;
  etiqueta: string;
  valor: number;
  porcentaje: number;
}

export interface EfectivoDto {
  valor: number;
  detalle: { moneda: Moneda; monto: number }[];
}

export interface DolarDto {
  tipo: TipoDolar;
  valor: number;
  actualizadoEn: string;
  desactualizado: boolean;
}

export interface ResumenDto {
  moneda: MonedaVista;
  /** null = todas las carteras activas. */
  carteraId: string | null;
  vacio: boolean;
  frase: string;
  tarjetas: TarjetaDto[];
  tenencias: TenenciaDto[];
  ponderaciones: { porActivo: PesoDto[]; porTipo: PesoDto[] };
  efectivo: EfectivoDto | null;
  dolar: DolarDto;
  mercado: EstadoMercadoDto;
  avisos: string[];
}

export interface PuntoHistoricoDto {
  fecha: string;
  cierre: number;
}

export interface MarcaOperacionDto {
  fecha: string;
  tipo: TipoOperacion;
  tipoTexto: string;
  cantidad: number | null;
  precio: number | null;
}

export interface HistoricoActivoDto {
  disponible: boolean;
  /** Por qué no hay historial, en lenguaje llano. */
  mensaje: string | null;
  moneda: Moneda;
  puntos: PuntoHistoricoDto[];
  marcas: MarcaOperacionDto[];
}

export interface ActivoDto {
  instrumento: InstrumentoDto;
  tenencia: TenenciaDto | null;
  operaciones: OperacionDto[];
  historico: HistoricoActivoDto;
}
```

En `contratos/src/index.ts`, agregar al final:
```ts
export * from "./resumen";
```

- [ ] **Step 2: Escribir el test de redacción (que falla)**

`backend/test/modulos/resumen/redaccion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/compartido/decimal";
import { redactarFrase } from "../../../src/modulos/resumen/redaccion";
import type { TotalesCartera } from "../../../src/motor/totales";

const d = (valor: string | number) => new Decimal(valor);
const imp = (ars: string | number, usd: string | number) => ({ ars: d(ars), usd: d(usd) });

function totales(datos: Partial<TotalesCartera>): TotalesCartera {
  const cero = imp(0, 0);
  return {
    valor: cero, valorPosiciones: cero, invertido: cero, noRealizado: cero, realizado: cero, cobros: cero,
    comisionesSueltas: cero, resultadoTotal: cero, costoHistorico: cero, variacionDiaria: cero, efectivo: null,
    rendimientoPct: { ars: null, usd: null }, variacionDiariaPct: { ars: null, usd: null },
    ...datos,
  };
}

describe("frase de resumen", () => {
  const cartera = totales({
    valor: imp("74900000", "48320"),
    resultadoTotal: imp("4865000", "3140.4"),
    rendimientoPct: { ars: d("6.94"), usd: d("6.94") },
    variacionDiariaPct: { ars: d("-0.44"), usd: d("-0.44") },
  });

  it("en dólares, con el equivalente en pesos", () => {
    expect(redactarFrase(cartera, "USD", true, false)).toBe(
      "Tu cartera vale US$ 48.320 (≈ $ 74,9 M). Desde que empezaste ganaste US$ 3.140 (+6,9%). Hoy bajó 0,4%.",
    );
  });

  it("en pesos, y con el mercado cerrado habla de la última rueda", () => {
    expect(redactarFrase(cartera, "ARS", false, false)).toBe(
      "Tu cartera vale $ 74,9 M (≈ US$ 48.320). Desde que empezaste ganaste $ 4,9 M (+6,9%). En la última rueda bajó 0,4%.",
    );
  });

  it("dice perdiste cuando el resultado es negativo y omite lo que no se puede calcular", () => {
    const enRojo = totales({ valor: imp(900, "0.9"), resultadoTotal: imp(-100, "-0.1"), rendimientoPct: { ars: d(-10), usd: d(-10) } });
    expect(redactarFrase(enRojo, "ARS", true, false)).toBe(
      "Tu cartera vale $ 900 (≈ US$ 1). Desde que empezaste perdiste $ 100 (-10,0%).",
    );
  });

  it("sin activos invita a empezar", () => {
    expect(redactarFrase(totales({}), "USD", true, true)).toBe(
      "Todavía no cargaste activos. Empezá con «Agregar activo que ya tengo».",
    );
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/resumen/redaccion`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar la redacción**

`backend/src/modulos/resumen/redaccion.ts`:
```ts
import type { MonedaVista } from "@cartera/contratos";
import { formatearMonedaAbreviada, formatearPorcentaje } from "../../compartido/formato";
import { enMoneda } from "../../motor/importe";
import type { PorcentajeDoble, TotalesCartera } from "../../motor/totales";

function porcentajeDe(valor: PorcentajeDoble, vista: MonedaVista) {
  return vista === "ARS" ? valor.ars : valor.usd;
}

/** "Tu cartera vale US$ 48.320 (≈ $ 74,9 M). Desde que empezaste ganaste … Hoy bajó 0,4%." */
export function redactarFrase(
  totales: TotalesCartera,
  vista: MonedaVista,
  mercadoAbierto: boolean,
  vacio: boolean,
): string {
  if (vacio) return "Todavía no cargaste activos. Empezá con «Agregar activo que ya tengo».";
  const otra: MonedaVista = vista === "USD" ? "ARS" : "USD";
  const partes = [
    `Tu cartera vale ${formatearMonedaAbreviada(enMoneda(totales.valor, vista), vista)} ` +
      `(≈ ${formatearMonedaAbreviada(enMoneda(totales.valor, otra), otra)}).`,
  ];
  const resultado = enMoneda(totales.resultadoTotal, vista);
  const rendimiento = porcentajeDe(totales.rendimientoPct, vista);
  partes.push(
    `Desde que empezaste ${resultado.gte(0) ? "ganaste" : "perdiste"} ` +
      `${formatearMonedaAbreviada(resultado.abs(), vista)}` +
      `${rendimiento ? ` (${formatearPorcentaje(rendimiento)})` : ""}.`,
  );
  const variacion = porcentajeDe(totales.variacionDiariaPct, vista);
  if (variacion) {
    const cuando = mercadoAbierto ? "Hoy" : "En la última rueda";
    const verbo = variacion.gt(0) ? "subió" : variacion.lt(0) ? "bajó" : "no cambió";
    const cuanto = variacion.isZero() ? "" : ` ${formatearPorcentaje(variacion.abs(), false)}`;
    partes.push(`${cuando} ${verbo}${cuanto}.`);
  }
  return partes.join(" ");
}
```

- [ ] **Step 5: Correr el test de redacción**

Run: `npm test -w @cartera/backend -- test/modulos/resumen/redaccion`
Expected: 4 tests PASS.

- [ ] **Step 6: Escribir el test de API (que falla)**

`backend/test/modulos/resumen/resumen.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CarteraDto, InstrumentoDto, Pagina, ResumenDto } from "@cartera/contratos";
import {
  crearAppPrueba,
  registrarUsuario,
  type AppPrueba,
  type UsuarioLogueado,
} from "../../utilidades/app-prueba";
import { crearProveedoresPrueba, URLS } from "../../utilidades/proveedores-prueba";

const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

async function idDe(prueba: AppPrueba, usuario: UsuarioLogueado, ticker: string): Promise<string> {
  const respuesta = await request(prueba.app).get(`/api/instrumentos/buscar?q=${ticker}`).set(auth(usuario)).expect(200);
  const [primero] = respuesta.body as InstrumentoDto[];
  if (!primero) throw new Error(`sin ${ticker}`);
  return primero.id;
}

async function principal(prueba: AppPrueba, usuario: UsuarioLogueado): Promise<string> {
  const respuesta = await request(prueba.app).get("/api/carteras").set(auth(usuario)).expect(200);
  return ((respuesta.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
}

describe("API de resumen", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let beto: UsuarioLogueado;
  let carteraAna: string;

  async function resumen(usuario: UsuarioLogueado, consulta = "?moneda=USD"): Promise<ResumenDto> {
    const respuesta = await request(prueba.app).get(`/api/resumen${consulta}`).set(auth(usuario));
    expect(respuesta.status).toBe(200);
    return respuesta.body as ResumenDto;
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    beto = await registrarUsuario(prueba.app);
    carteraAna = await principal(prueba, ana);
    const operar = (cuerpo: object) =>
      request(prueba.app).post("/api/operaciones").set(auth(ana)).send({ carteraId: carteraAna, moneda: "USD_MEP", ...cuerpo }).expect(201);
    await operar({ tipo: "TENENCIA_INICIAL", instrumentoId: await idDe(prueba, ana, "AMZN"), fecha: "2026-09-15", cantidad: 72, precio: 1.5 });
    await operar({ tipo: "TENENCIA_INICIAL", instrumentoId: await idDe(prueba, ana, "YM39O"), fecha: "2026-09-16", cantidad: 344, precio: 109.3 });
    await operar({ tipo: "TENENCIA_INICIAL", instrumentoId: await idDe(prueba, ana, "YPFD"), fecha: "2026-09-16", cantidad: 50, precio: 3.89 });
    const pamp = await idDe(prueba, ana, "PAMP");
    await operar({ tipo: "TENENCIA_INICIAL", instrumentoId: pamp, fecha: "2026-09-14", cantidad: 55, precio: 3.51 });
    await operar({ tipo: "VENTA", instrumentoId: pamp, fecha: "2026-09-22", cantidad: 55, precio: 3.3 });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("arma la frase con los números reales de la cartera", async () => {
    const r = await resumen(ana);
    expect(r.frase).toBe("Tu cartera vale US$ 777 (≈ $ 1,2 M). Desde que empezaste ganaste US$ 87 (+9,9%). Hoy bajó 0,5%.");
    expect(r).toMatchObject({ moneda: "USD", carteraId: null, vacio: false, avisos: [] });
    expect(r.dolar).toMatchObject({ tipo: "MEP", valor: 1556.5, desactualizado: false });
    expect(r.mercado).toMatchObject({ abierto: true, desactualizado: false });
  });

  it("tarjetas con explicación, valor, porcentaje y tono", async () => {
    const tarjetas = Object.fromEntries((await resumen(ana)).tarjetas.map((t) => [t.clave, t]));
    expect(tarjetas["valorActual"]).toMatchObject({ titulo: "Valor actual", explicacion: "Lo que vale hoy todo lo que tenés.", valor: 776.55, tono: "neutro" });
    expect(tarjetas["invertido"]).toMatchObject({ valor: 678.49 });
    expect(tarjetas["noRealizado"]).toMatchObject({ valor: 98.06, porcentaje: 14.45, tono: "positivo", explicacion: "Lo que ganarías (o perderías) si vendieras todo hoy." });
    expect(tarjetas["realizado"]).toMatchObject({ valor: -11.55, tono: "negativo" });
    expect(tarjetas["cobros"]).toMatchObject({ valor: 0, tono: "neutro" });
    expect(tarjetas["rendimiento"]).toMatchObject({ valor: 86.51, porcentaje: 9.93, tono: "positivo" });
    expect(tarjetas["variacionDiaria"]).toMatchObject({ valor: -3.98, porcentaje: -0.51, tono: "negativo" });
  });

  it("las tenencias van de mayor a menor valor y un activo vendido por completo no aparece", async () => {
    const { tenencias } = await resumen(ana);
    expect(tenencias.map((t) => t.ticker)).toEqual(["YM39O", "YPFD", "AMZN"]);
    expect(tenencias[1]).toMatchObject({
      ticker: "YPFD",
      tipoTexto: "Acción",
      cantidad: 50,
      monedaPrecio: "USD_MEP",
      precioPromedio: 3.89,
      precioActual: 5.35,
      valor: 267.5,
      invertido: 194.5,
      resultado: 73,
      resultadoPct: 37.53,
      peso: 34.45,
      sinCotizacion: false,
      fuentePrecio: "MERCADO",
      explicacionPrecio: "Cotiza por unidad: el valor es cantidad × precio.",
    });
    expect(tenencias[0]?.explicacionPrecio).toBe("Cotiza cada 100 nominales: el valor es cantidad × precio ÷ 100.");
  });

  it("ponderaciones por activo y por tipo", async () => {
    const { ponderaciones } = await resumen(ana);
    expect(ponderaciones.porTipo.map((p) => [p.etiqueta, p.porcentaje])).toEqual([
      ["Obligación negociable", 48.82],
      ["Acción", 34.45],
      ["CEDEAR", 16.74],
    ]);
    expect(ponderaciones.porActivo[0]).toMatchObject({ etiqueta: "YM39O", porcentaje: 48.82 });
  });

  it("en pesos convierte con el dólar de referencia", async () => {
    const r = await resumen(ana, "?moneda=ARS");
    expect(r.tarjetas.find((t) => t.clave === "valorActual")?.valor).toBe(1208696.96);
  });

  it("sin moneda usa la base del usuario (dólares por defecto)", async () => {
    expect((await resumen(ana, "")).moneda).toBe("USD");
  });

  it("filtra por cartera y muestra el efectivo cuando hay depósitos", async () => {
    const otra = await request(prueba.app).post("/api/carteras").set(auth(ana)).send({ nombre: "Ahorro" }).expect(201);
    await request(prueba.app)
      .post("/api/operaciones")
      .set(auth(ana))
      .send({ carteraId: otra.body.id, tipo: "DEPOSITO", fecha: "2026-09-20", monto: 1000, moneda: "USD_MEP" })
      .expect(201);
    const r = await resumen(ana, `?moneda=USD&carteraId=${otra.body.id}`);
    expect(r.tenencias).toEqual([]);
    expect(r.efectivo).toEqual({ valor: 1000, detalle: [{ moneda: "USD_MEP", monto: 1000 }] });
    expect(r.vacio).toBe(false);
  });

  it("un usuario sin operaciones ve la invitación a empezar", async () => {
    const r = await resumen(beto);
    expect(r.vacio).toBe(true);
    expect(r.frase).toBe("Todavía no cargaste activos. Empezá con «Agregar activo que ya tengo».");
    expect(r.tenencias).toEqual([]);
  });

  it("no deja ver el resumen de una cartera ajena", async () => {
    const respuesta = await request(prueba.app).get(`/api/resumen?carteraId=${carteraAna}`).set(auth(beto));
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.mensaje).toBe("No se encontró la cartera.");
  });
});

describe("API de resumen con data912 caído", () => {
  it("se arma igual: valúa al precio manual o al costo, y avisa", async () => {
    const caido = new Error("ECONNREFUSED");
    const proveedores = crearProveedoresPrueba({
      rutasExtra: Object.fromEntries([URLS.acciones, URLS.cedears, URLS.bonos, URLS.obligaciones, URLS.letras].map((u) => [u, caido])),
    });
    const prueba = await crearAppPrueba({}, { proveedores });
    const usuario = await registrarUsuario(prueba.app);
    const cartera = await principal(prueba, usuario);
    // Sin data912 no hay catálogo: se cargan dos activos directo en la base.
    const crearInstrumento = (ticker: string) =>
      prueba.bd.instrumento.create({ data: { ticker, tipo: "CEDEAR", mercado: "BYMA", simbolos: { ARS: ticker } } });
    const amzn = await crearInstrumento("AMZN");
    const msft = await crearInstrumento("MSFT");
    for (const instrumento of [amzn, msft]) {
      await request(prueba.app)
        .post("/api/operaciones")
        .set(auth(usuario))
        .send({ carteraId: cartera, tipo: "TENENCIA_INICIAL", instrumentoId: instrumento.id, fecha: "2026-09-15", cantidad: 10, precio: 1000, moneda: "ARS" })
        .expect(201);
    }
    await request(prueba.app).put(`/api/instrumentos/${amzn.id}/precio-manual`).set(auth(usuario)).send({ precio: 1200, moneda: "ARS" }).expect(200);

    const respuesta = await request(prueba.app).get("/api/resumen?moneda=ARS").set(auth(usuario));
    expect(respuesta.status).toBe(200);
    const r = respuesta.body as ResumenDto;
    const porTicker = Object.fromEntries(r.tenencias.map((t) => [t.ticker, t]));
    expect(porTicker["AMZN"]).toMatchObject({ fuentePrecio: "MANUAL", valor: 12000, sinCotizacion: false });
    expect(porTicker["MSFT"]).toMatchObject({ fuentePrecio: "COSTO", valor: 10000, sinCotizacion: true });
    expect(r.mercado.desactualizado).toBe(true);
    expect(r.avisos).toEqual([
      "No pudimos obtener los precios del mercado. Se usan los precios que cargaste a mano o, si no hay, lo que pagaste.",
      "No encontramos precio de mercado para MSFT: se muestra lo que pagaste. Podés cargar un precio a mano desde la ficha del activo.",
      "AMZN usa el precio que cargaste a mano el 28/09/2026.",
    ]);
    expect(JSON.stringify(r)).not.toMatch(/ECONNREFUSED|data912/);
    await prueba.cerrar();
  });
});
```

- [ ] **Step 7: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/resumen/resumen.api`
Expected: FAIL — `/api/resumen` no existe.

- [ ] **Step 8: Carteras activas**

En `backend/src/modulos/carteras/carteras.repositorio.ts`, inmediatamente antes de `  /** Posición para una cartera nueva: al final de las del usuario. */`, agregar:
```ts
  /** Carteras que cuentan para el resumen consolidado: ni borradas ni archivadas. */
  async idsActivas(usuarioId: string, bd: ClienteBD = this.bd): Promise<string[]> {
    const carteras = await bd.cartera.findMany({
      where: { usuarioId, eliminadoEn: null, archivada: false },
      select: { id: true },
    });
    return carteras.map((cartera) => cartera.id);
  }

```

En `backend/src/modulos/carteras/carteras.servicio.ts`, inmediatamente antes de `  async obtener(usuarioId: string, id: string): Promise<CarteraDto> {`, agregar:
```ts
  idsActivas(usuarioId: string): Promise<string[]> {
    return this.carteras.idsActivas(usuarioId);
  }

```

- [ ] **Step 9: Cálculo compartido por resumen y ficha**

`backend/src/modulos/resumen/calculo.ts`:
```ts
import type { Moneda } from "@cartera/contratos";
import { CERO, type Decimal } from "../../compartido/decimal";
import { IMPORTE_CERO, sumar } from "../../motor/importe";
import { cantidadDe, costoDe } from "../../motor/posicion";
import type { PosicionValuada } from "../../motor/totales";
import type { Importe } from "../../motor/tipos";
import type { ValuacionPosicion } from "../../motor/valuadores/valuador";
import type { InstrumentoCatalogado } from "../instrumentos";

/** Un activo sumado entre carteras y cuentas: así se muestra en la tabla. */
export interface TenenciaAgrupada {
  instrumento: InstrumentoCatalogado;
  cantidad: Decimal;
  costo: Importe;
  valor: Importe;
  realizado: Importe;
  cobros: Importe;
  monedaPrecio: Moneda;
  factorPrecio: Decimal;
  valuacion: ValuacionPosicion;
}

/** Solo lo que se tiene hoy, de mayor a menor valor. */
export function agruparPorInstrumento(
  valuadas: readonly PosicionValuada[],
  catalogo: ReadonlyMap<string, InstrumentoCatalogado>,
): TenenciaAgrupada[] {
  const grupos = new Map<string, TenenciaAgrupada>();
  for (const { posicion, valuacion } of valuadas) {
    const cantidad = cantidadDe(posicion);
    const instrumento = catalogo.get(posicion.instrumentoId);
    if (!instrumento || cantidad.lte(0)) continue;
    const actual = grupos.get(posicion.instrumentoId);
    grupos.set(posicion.instrumentoId, {
      instrumento,
      cantidad: (actual?.cantidad ?? CERO).plus(cantidad),
      costo: sumar(actual?.costo ?? IMPORTE_CERO, costoDe(posicion)),
      valor: sumar(actual?.valor ?? IMPORTE_CERO, valuacion.valor),
      realizado: sumar(actual?.realizado ?? IMPORTE_CERO, posicion.realizado),
      cobros: sumar(actual?.cobros ?? IMPORTE_CERO, posicion.cobros),
      monedaPrecio: actual?.monedaPrecio ?? posicion.monedaPrecio,
      factorPrecio: posicion.factorPrecio,
      valuacion: actual?.valuacion ?? valuacion,
    });
  }
  return [...grupos.values()].sort((a, b) => b.valor.ars.comparedTo(a.valor.ars));
}
```

- [ ] **Step 10: Esquema, servicio, controlador, rutas y módulo**

`backend/src/modulos/resumen/resumen.esquemas.ts`:
```ts
import { z } from "zod";

export const esquemaConsultaResumen = z.object({
  carteraId: z.string().min(1).optional(),
  moneda: z.enum(["ARS", "USD"], { message: "Elegí la moneda: ARS o USD." }).optional(),
});

export type ConsultaResumen = z.output<typeof esquemaConsultaResumen>;
```

`backend/src/modulos/resumen/resumen.servicio.ts`:
```ts
import type {
  ActivoDto,
  ClaveTarjeta,
  MonedaVista,
  PesoDto,
  ResumenDto,
  TarjetaDto,
  TenenciaDto,
  Tono,
  UsuarioDto,
} from "@cartera/contratos";
import { CIEN, aNumero, type Decimal } from "../../compartido/decimal";
import { formatoFechaCorta } from "../../compartido/fechas";
import type { FuentePreferencias } from "../../compartido/preferencias";
import { estrategiaDeCosto } from "../../motor/costo/estrategia-costo";
import { enMoneda } from "../../motor/importe";
import { crearRegistroManejadores } from "../../motor/operaciones/registro-manejadores";
import { ponderar, type Peso } from "../../motor/ponderacion";
import { cantidadDe } from "../../motor/posicion";
import { reconstruir } from "../../motor/tenencia";
import { totalizar, type PosicionValuada, type TotalesCartera } from "../../motor/totales";
import type { EstadoCartera } from "../../motor/tipos";
import { valuadorPara } from "../../motor/valuadores/fabrica";
import type { CarterasServicio } from "../carteras";
import {
  TEXTO_TIPO_INSTRUMENTO,
  explicacionPrecio,
  type InstrumentoCatalogado,
  type InstrumentosServicio,
} from "../instrumentos";
import type { DolarVigente, MercadoServicio, PreciosDelMercado } from "../mercado";
import type { OperacionesServicio } from "../operaciones";
import { agruparPorInstrumento, type TenenciaAgrupada } from "./calculo";
import { redactarFrase } from "./redaccion";
import type { ConsultaResumen } from "./resumen.esquemas";

const DECIMALES_MONTO = 2;
const DECIMALES_PORCENTAJE = 2;
const DECIMALES_PRECIO = 6;
const DECIMALES_CANTIDAD = 6;

export interface DependenciasResumen {
  carteras: CarterasServicio;
  operaciones: OperacionesServicio;
  instrumentos: InstrumentosServicio;
  mercado: MercadoServicio;
  usuarios: FuentePreferencias;
  ahora: () => Date;
}

interface Calculo {
  preferencias: UsuarioDto;
  vista: MonedaVista;
  carteraIds: string[];
  estado: EstadoCartera;
  valuadas: PosicionValuada[];
  totales: TotalesCartera;
  catalogo: Map<string, InstrumentoCatalogado>;
  precios: PreciosDelMercado;
  dolar: DolarVigente;
  tenencias: TenenciaAgrupada[];
}

interface DefinicionTarjeta {
  clave: ClaveTarjeta;
  titulo: string;
  explicacion: string;
}

const TARJETAS: Record<ClaveTarjeta, DefinicionTarjeta> = {
  valorActual: { clave: "valorActual", titulo: "Valor actual", explicacion: "Lo que vale hoy todo lo que tenés." },
  invertido: { clave: "invertido", titulo: "Invertido", explicacion: "Lo que pagaste por lo que tenés hoy." },
  noRealizado: {
    clave: "noRealizado",
    titulo: "Resultado no realizado",
    explicacion: "Lo que ganarías (o perderías) si vendieras todo hoy.",
  },
  realizado: {
    clave: "realizado",
    titulo: "Resultado realizado",
    explicacion: "Lo que ya ganaste (o perdiste) con lo que vendiste.",
  },
  cobros: { clave: "cobros", titulo: "Cobros", explicacion: "Dividendos y rentas (cupones) que cobraste." },
  rendimiento: {
    clave: "rendimiento",
    titulo: "Rendimiento total",
    explicacion: "Cuánto ganaste en total sobre todo lo que invertiste.",
  },
  variacionDiaria: {
    clave: "variacionDiaria",
    titulo: "Variación de hoy",
    explicacion: "Cuánto cambió hoy el valor de tu cartera.",
  },
};

function tono(valor: Decimal): Tono {
  return valor.gt(0) ? "positivo" : valor.lt(0) ? "negativo" : "neutro";
}

function numeroONulo(valor: Decimal | null, decimales: number): number | null {
  return valor === null ? null : aNumero(valor, decimales);
}

function aPesoDto(peso: Peso): PesoDto {
  return {
    clave: peso.clave,
    etiqueta: peso.etiqueta,
    valor: aNumero(peso.valor, DECIMALES_MONTO),
    porcentaje: aNumero(peso.porcentaje, DECIMALES_PORCENTAJE),
  };
}

export class ResumenServicio {
  private readonly registro = crearRegistroManejadores();

  constructor(private readonly dependencias: DependenciasResumen) {}

  async obtener(usuarioId: string, consulta: ConsultaResumen): Promise<ResumenDto> {
    const calculo = await this.calcular(usuarioId, consulta);
    const { totales, vista, estado, precios, dolar } = calculo;
    const vacio = calculo.tenencias.length === 0 && !estado.registraEfectivo;
    const mercado = await this.dependencias.mercado.estado(precios);
    const valorPosiciones = enMoneda(totales.valorPosiciones, vista);
    return {
      moneda: vista,
      carteraId: consulta.carteraId ?? null,
      vacio,
      frase: redactarFrase(totales, vista, mercado.abierto, vacio),
      tarjetas: this.tarjetas(totales, vista),
      tenencias: calculo.tenencias.map((grupo) => this.aTenenciaDto(grupo, vista, valorPosiciones)),
      ponderaciones: {
        porActivo: ponderar(
          calculo.tenencias.map((g) => ({ clave: g.instrumento.id, etiqueta: g.instrumento.ticker, valor: enMoneda(g.valor, vista) })),
        ).map(aPesoDto),
        porTipo: ponderar(
          calculo.tenencias.map((g) => ({ clave: g.instrumento.tipo, etiqueta: TEXTO_TIPO_INSTRUMENTO[g.instrumento.tipo], valor: enMoneda(g.valor, vista) })),
        ).map(aPesoDto),
      },
      efectivo: totales.efectivo
        ? {
            valor: aNumero(enMoneda(totales.efectivo, vista), DECIMALES_MONTO),
            detalle: [...estado.efectivo].map(([moneda, monto]) => ({ moneda, monto: aNumero(monto, DECIMALES_MONTO) })),
          }
        : null,
      dolar: {
        tipo: dolar.tipo,
        valor: aNumero(dolar.valor, DECIMALES_MONTO),
        actualizadoEn: dolar.actualizadoEn.toISOString(),
        desactualizado: dolar.desactualizado,
      },
      mercado,
      avisos: this.avisos(calculo, mercado.desactualizado ? mercado.mensaje : null),
    };
  }

  /** Lo completa la Tarea 13. */
  async activo(_usuarioId: string, _instrumentoId: string, _consulta: ConsultaResumen): Promise<ActivoDto> {
    throw new Error("Pendiente de la Tarea 13");
  }

  protected async calcular(usuarioId: string, consulta: ConsultaResumen): Promise<Calculo> {
    const { carteras, operaciones, instrumentos, mercado, usuarios, ahora } = this.dependencias;
    const preferencias = await usuarios.yo(usuarioId);
    const vista: MonedaVista = consulta.moneda ?? (preferencias.monedaBase === "ARS" ? "ARS" : "USD");
    const carteraIds = consulta.carteraId
      ? [(await carteras.obtener(usuarioId, consulta.carteraId)).id]
      : await carteras.idsActivas(usuarioId);
    const estado = reconstruir(
      await operaciones.paraCalculo(carteraIds),
      estrategiaDeCosto(preferencias.metodoCosto),
      this.registro,
    );
    const posiciones = [...estado.posiciones.values()];
    const catalogo = await instrumentos.catalogados([...new Set(posiciones.map((p) => p.instrumentoId))]);
    const vivos = posiciones.filter((p) => cantidadDe(p).gt(0)).flatMap((p) => {
      const instrumento = catalogo.get(p.instrumentoId);
      return instrumento ? [instrumento] : [];
    });
    const precios = await mercado.precios(usuarioId, [...new Map(vivos.map((i) => [i.id, i])).values()]);
    const dolar = await mercado.dolarVigente(preferencias.dolarReferencia);
    const valuadas = posiciones.flatMap((posicion) => {
      const instrumento = catalogo.get(posicion.instrumentoId);
      if (!instrumento) return [];
      const valuacion = valuadorPara(instrumento.tipo).valuar(posicion, precios.precios.get(instrumento.id), {
        dolar: dolar.valor,
        ahora: ahora(),
        tasaAnual: instrumento.tasaAnual,
      });
      return [{ posicion, valuacion }];
    });
    return {
      preferencias,
      vista,
      carteraIds,
      estado,
      valuadas,
      totales: totalizar(valuadas, estado, dolar.valor),
      catalogo,
      precios,
      dolar,
      tenencias: agruparPorInstrumento(valuadas, catalogo),
    };
  }

  protected aTenenciaDto(grupo: TenenciaAgrupada, vista: MonedaVista, valorPosiciones: Decimal): TenenciaDto {
    const valor = enMoneda(grupo.valor, vista);
    const invertido = enMoneda(grupo.costo, vista);
    const resultado = valor.minus(invertido);
    const promedio = enMoneda(grupo.costo, grupo.monedaPrecio).div(grupo.cantidad).div(grupo.factorPrecio);
    const { valuacion, instrumento } = grupo;
    return {
      instrumentoId: instrumento.id,
      ticker: instrumento.ticker,
      nombre: instrumento.nombre,
      tipo: instrumento.tipo,
      tipoTexto: TEXTO_TIPO_INSTRUMENTO[instrumento.tipo],
      cantidad: aNumero(grupo.cantidad, DECIMALES_CANTIDAD),
      monedaPrecio: grupo.monedaPrecio,
      precioPromedio: aNumero(promedio, DECIMALES_PRECIO),
      precioActual: numeroONulo(valuacion.precio, DECIMALES_PRECIO),
      variacionDiariaPct: numeroONulo(valuacion.variacionPct, DECIMALES_PORCENTAJE),
      valor: aNumero(valor, DECIMALES_MONTO),
      invertido: aNumero(invertido, DECIMALES_MONTO),
      resultado: aNumero(resultado, DECIMALES_MONTO),
      resultadoPct: invertido.isZero() ? null : aNumero(resultado.div(invertido).mul(CIEN), DECIMALES_PORCENTAJE),
      realizado: aNumero(enMoneda(grupo.realizado, vista), DECIMALES_MONTO),
      cobros: aNumero(enMoneda(grupo.cobros, vista), DECIMALES_MONTO),
      peso: valorPosiciones.isZero() ? 0 : aNumero(valor.div(valorPosiciones).mul(CIEN), DECIMALES_PORCENTAJE),
      sinCotizacion: valuacion.sinCotizacion,
      fuentePrecio: valuacion.fuente,
      explicacionPrecio: explicacionPrecio(instrumento.factorPrecio),
    };
  }

  private tarjetas(totales: TotalesCartera, vista: MonedaVista): TarjetaDto[] {
    const pct = (valor: { ars: Decimal | null; usd: Decimal | null }) => (vista === "ARS" ? valor.ars : valor.usd);
    const invertido = enMoneda(totales.invertido, vista);
    const noRealizado = enMoneda(totales.noRealizado, vista);
    const tarjeta = (clave: ClaveTarjeta, valor: Decimal, porcentaje: Decimal | null, conTono: boolean): TarjetaDto => ({
      ...TARJETAS[clave],
      valor: aNumero(valor, DECIMALES_MONTO),
      porcentaje: numeroONulo(porcentaje, DECIMALES_PORCENTAJE),
      tono: conTono ? tono(valor) : "neutro",
    });
    return [
      tarjeta("valorActual", enMoneda(totales.valor, vista), null, false),
      tarjeta("invertido", invertido, null, false),
      tarjeta("noRealizado", noRealizado, invertido.isZero() ? null : noRealizado.div(invertido).mul(CIEN), true),
      tarjeta("realizado", enMoneda(totales.realizado, vista), null, true),
      tarjeta("cobros", enMoneda(totales.cobros, vista), null, true),
      tarjeta("rendimiento", enMoneda(totales.resultadoTotal, vista), pct(totales.rendimientoPct), true),
      tarjeta("variacionDiaria", enMoneda(totales.variacionDiaria, vista), pct(totales.variacionDiariaPct), true),
    ];
  }

  private avisos(calculo: Calculo, avisoMercado: string | null): string[] {
    const avisos: string[] = avisoMercado ? [avisoMercado] : [];
    const sinPrecio = calculo.tenencias.filter((g) => g.valuacion.sinCotizacion).map((g) => g.instrumento.ticker);
    if (sinPrecio.length > 0) {
      avisos.push(
        `No encontramos precio de mercado para ${sinPrecio.join(", ")}: se muestra lo que pagaste. ` +
          "Podés cargar un precio a mano desde la ficha del activo.",
      );
    }
    for (const grupo of calculo.tenencias) {
      const precio = calculo.precios.precios.get(grupo.instrumento.id);
      if (precio?.fuente === "MANUAL") {
        avisos.push(`${grupo.instrumento.ticker} usa el precio que cargaste a mano el ${formatoFechaCorta(precio.actualizadoEn)}.`);
      }
    }
    if (calculo.dolar.desactualizado) {
      avisos.push(
        `No pudimos actualizar el dólar: se usa el último valor conocido ($ ${aNumero(calculo.dolar.valor, DECIMALES_MONTO)}).`,
      );
    }
    for (const [moneda, monto] of calculo.estado.efectivo) {
      if (calculo.estado.registraEfectivo && monto.lt(0)) {
        avisos.push(
          `Tu efectivo en ${moneda === "ARS" ? "pesos" : "dólares"} da negativo: puede faltar registrar algún depósito.`,
        );
      }
    }
    return avisos;
  }
}
```

> `formatoFechaCorta` recibe una fecha y devuelve el día UTC. El precio manual se carga con `ahora` (hora exacta): para el aviso interesa el día, y en los tests `AHORA_FIXTURES` (15:00 en Argentina) cae el mismo día en UTC.

`backend/src/modulos/resumen/resumen.controlador.ts`:
```ts
import type { RequestHandler } from "express";
import { parametro } from "../../compartido/http/parametros";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import { esquemaConsultaResumen } from "./resumen.esquemas";
import type { ResumenServicio } from "./resumen.servicio";

export class ResumenControlador {
  constructor(private readonly servicio: ResumenServicio) {}

  readonly obtener: RequestHandler = async (req, res) => {
    const consulta = validar(esquemaConsultaResumen, req.query);
    res.json(await this.servicio.obtener(usuarioDe(req).id, consulta));
  };

  readonly activo: RequestHandler = async (req, res) => {
    const consulta = validar(esquemaConsultaResumen, req.query);
    res.json(await this.servicio.activo(usuarioDe(req).id, parametro(req, "instrumentoId"), consulta));
  };
}
```

`backend/src/modulos/resumen/resumen.rutas.ts`:
```ts
import { Router } from "express";
import type { ResumenControlador } from "./resumen.controlador";

export function crearRutasResumen(controlador: ResumenControlador): Router {
  const rutas = Router();
  rutas.get("/", controlador.obtener);
  return rutas;
}

export function crearRutasActivos(controlador: ResumenControlador): Router {
  const rutas = Router();
  rutas.get("/:instrumentoId", controlador.activo);
  return rutas;
}
```

`backend/src/modulos/resumen/index.ts`:
```ts
import type { Router } from "express";
import { ResumenControlador } from "./resumen.controlador";
import { crearRutasActivos, crearRutasResumen } from "./resumen.rutas";
import { ResumenServicio, type DependenciasResumen } from "./resumen.servicio";

export type { ResumenServicio } from "./resumen.servicio";

export interface ModuloResumen {
  servicio: ResumenServicio;
  rutasResumen: Router;
  rutasActivos: Router;
}

export function crearModuloResumen(dependencias: DependenciasResumen): ModuloResumen {
  const servicio = new ResumenServicio(dependencias);
  const controlador = new ResumenControlador(servicio);
  return {
    servicio,
    rutasResumen: crearRutasResumen(controlador),
    rutasActivos: crearRutasActivos(controlador),
  };
}
```

- [ ] **Step 11: Conectar el módulo**

En `backend/src/contenedor.ts`:
- Agregar el import: `import { crearModuloResumen, type ModuloResumen } from "./modulos/resumen";`
- En la interfaz `Contenedor`, agregar debajo de `operaciones: ModuloOperaciones;`: `resumen: ModuloResumen;`
- En `crearContenedor`, inmediatamente antes del `return {` final, agregar:
```ts
  const resumen = crearModuloResumen({
    carteras: carteras.servicio,
    operaciones: operaciones.servicio,
    instrumentos: instrumentos.servicio,
    mercado: mercado.servicio,
    usuarios: autenticacion.servicio,
    ahora,
  });
```
- En el objeto devuelto, agregar debajo de `operaciones,`: `resumen,`

En `backend/src/app.ts`, debajo de `privadas.use("/operaciones", contenedor.operaciones.rutas);` agregar:
```ts
  privadas.use("/resumen", contenedor.resumen.rutasResumen);
  privadas.use("/activos", contenedor.resumen.rutasActivos);
```

- [ ] **Step 12: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint`
Expected: todo PASS.

- [ ] **Step 13: Mostrar el estado**

Run: `git status --short`

---

### Task 13: Ficha del activo (tenencia, operaciones e historial con compras y ventas marcadas)

**Files:**
- Modify: `backend/src/modulos/resumen/resumen.servicio.ts` (implementar `activo`)
- Test: `backend/test/modulos/resumen/activo.api.test.ts`

**Interfaces:**
- Consumes: `ResumenServicio.calcular` y `aTenenciaDto` (T12); `OperacionesServicio.deActivo` (T11); `MercadoServicio.historico` (T10); `InstrumentosServicio.obtener`, `catalogado` (T6).
- Produces: `GET /api/activos/:instrumentoId?carteraId=&moneda=` → `ActivoDto`; `MAXIMO_PUNTOS_HISTORICO = 750` (unos 3 años de ruedas).

- [ ] **Step 1: Escribir el test que falla**

`backend/test/modulos/resumen/activo.api.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { ActivoDto, CarteraDto, InstrumentoDto, Pagina } from "@cartera/contratos";
import { crearAppPrueba, registrarUsuario, type AppPrueba, type UsuarioLogueado } from "../../utilidades/app-prueba";

describe("API de ficha del activo", () => {
  let prueba: AppPrueba;
  let ana: UsuarioLogueado;
  let amzn: string;
  let ym39: string;
  const auth = (u: UsuarioLogueado) => ({ Authorization: `Bearer ${u.token}` });

  async function id(q: string) {
    const r = await request(prueba.app).get(`/api/instrumentos/buscar?q=${q}`).set(auth(ana)).expect(200);
    return ((r.body as InstrumentoDto[])[0] as InstrumentoDto).id;
  }

  async function ficha(instrumentoId: string): Promise<ActivoDto> {
    const r = await request(prueba.app).get(`/api/activos/${instrumentoId}?moneda=USD`).set(auth(ana));
    expect(r.status).toBe(200);
    return r.body as ActivoDto;
  }

  beforeAll(async () => {
    prueba = await crearAppPrueba();
    ana = await registrarUsuario(prueba.app);
    const carteras = await request(prueba.app).get("/api/carteras").set(auth(ana));
    const cartera = ((carteras.body as Pagina<CarteraDto>).items[0] as CarteraDto).id;
    amzn = await id("AMZN");
    ym39 = await id("YM39O");
    const operar = (cuerpo: object) =>
      request(prueba.app).post("/api/operaciones").set(auth(ana)).send({ carteraId: cartera, moneda: "USD_MEP", ...cuerpo }).expect(201);
    await operar({ tipo: "TENENCIA_INICIAL", instrumentoId: amzn, fecha: "2026-09-15", cantidad: 72, precio: 1.5 });
    await operar({ tipo: "COMPRA", instrumentoId: amzn, fecha: "2026-09-22", cantidad: 28, precio: 1.8 });
    await operar({ tipo: "DIVIDENDO", instrumentoId: amzn, fecha: "2026-09-24", monto: 2 });
    await operar({ tipo: "TENENCIA_INICIAL", instrumentoId: ym39, fecha: "2026-09-16", cantidad: 344, precio: 109.3 });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it("muestra la tenencia, las operaciones (la más nueva primero) y el historial en la moneda del activo", async () => {
    const f = await ficha(amzn);
    expect(f.instrumento).toMatchObject({ ticker: "AMZN", tipoTexto: "CEDEAR" });
    expect(f.tenencia).toMatchObject({ cantidad: 100, monedaPrecio: "USD_MEP", precioPromedio: 1.584, cobros: 2 });
    expect(f.operaciones.map((o) => o.tipo)).toEqual(["DIVIDENDO", "COMPRA", "TENENCIA_INICIAL"]);
    expect(f.historico).toMatchObject({ disponible: true, mensaje: null, moneda: "USD_MEP" });
    expect(f.historico.puntos.at(-1)).toEqual({ fecha: "2026-09-25", cierre: 1.824534 });
  });

  it("marca en el historial solo las compras, ventas y tenencias iniciales", async () => {
    const f = await ficha(amzn);
    expect(f.historico.marcas).toEqual([
      { fecha: "2026-09-15", tipo: "TENENCIA_INICIAL", tipoTexto: "Tenencia inicial", cantidad: 72, precio: 1.5 },
      { fecha: "2026-09-22", tipo: "COMPRA", tipoTexto: "Compra", cantidad: 28, precio: 1.8 },
    ]);
  });

  it("si no hay historial lo explica en lenguaje llano", async () => {
    const f = await ficha(ym39);
    expect(f.historico).toMatchObject({
      disponible: false,
      mensaje: "Todavía no tenemos el historial de precios de este activo.",
      puntos: [],
    });
    expect(f.tenencia?.cantidad).toBe(344);
  });

  it("un activo que no se tiene muestra su ficha sin tenencia", async () => {
    const f = await ficha(await id("GGAL"));
    expect(f.tenencia).toBeNull();
    expect(f.operaciones).toEqual([]);
  });

  it("un activo inexistente da 404 en castellano", async () => {
    const r = await request(prueba.app).get("/api/activos/no-existe").set(auth(ana));
    expect(r.status).toBe(404);
    expect(r.body.error.mensaje).toBe("No se encontró el activo.");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npm test -w @cartera/backend -- test/modulos/resumen/activo`
Expected: FAIL — el endpoint responde 500 ("Pendiente de la Tarea 13", en la consola) porque `activo` todavía no está implementado.

- [ ] **Step 3: Implementar la ficha**

En `backend/src/modulos/resumen/resumen.servicio.ts`:

Agregar la constante debajo de `const DECIMALES_CANTIDAD = 6;`:
```ts
/** Unos tres años de ruedas: suficiente para el gráfico sin mandar miles de puntos. */
const MAXIMO_PUNTOS_HISTORICO = 750;
const TIPOS_CON_MARCA: ReadonlySet<string> = new Set(["TENENCIA_INICIAL", "COMPRA", "VENTA"]);
```

Reemplazar el método `activo` completo (el que lanza "Pendiente de la Tarea 13") por:
```ts
  async activo(usuarioId: string, instrumentoId: string, consulta: ConsultaResumen): Promise<ActivoDto> {
    const { instrumentos, operaciones, mercado } = this.dependencias;
    const instrumento = await instrumentos.obtener(usuarioId, instrumentoId);
    const calculo = await this.calcular(usuarioId, consulta);
    const grupo = calculo.tenencias.find((g) => g.instrumento.id === instrumentoId);
    const movimientos = await operaciones.deActivo(calculo.carteraIds, instrumentoId);
    const moneda = grupo?.monedaPrecio ?? movimientos[0]?.moneda ?? "ARS";
    const historico = await mercado.historico(
      await instrumentos.catalogado(instrumentoId),
      moneda,
      calculo.preferencias.dolarReferencia,
    );
    return {
      instrumento,
      tenencia: grupo
        ? this.aTenenciaDto(grupo, calculo.vista, enMoneda(calculo.totales.valorPosiciones, calculo.vista))
        : null,
      operaciones: movimientos,
      historico: {
        disponible: historico.disponible,
        mensaje: historico.disponible ? null : "Todavía no tenemos el historial de precios de este activo.",
        moneda: historico.moneda,
        puntos: historico.puntos
          .slice(-MAXIMO_PUNTOS_HISTORICO)
          .map((punto) => ({ fecha: punto.fecha, cierre: aNumero(punto.cierre, DECIMALES_PRECIO) })),
        marcas: movimientos
          .filter((o) => TIPOS_CON_MARCA.has(o.tipo))
          .map((o) => ({ fecha: o.fecha, tipo: o.tipo, tipoTexto: o.tipoTexto, cantidad: o.cantidad, precio: o.precio }))
          .reverse(),
      },
    };
  }
```

- [ ] **Step 4: Correr tests, tipos y lint**

Run: `npm test && npm run tipos && npm run lint && npm run formato && npm run formato:verificar`
Expected: todo PASS.

- [ ] **Step 5: Mostrar el estado**

Run: `git status --short`

---

### Task 14: Verificación de punta a punta con fuentes reales

**Files:** ninguno nuevo (solo verificación).

**Interfaces:** consume toda la API.

- [ ] **Step 1: Suite completa y chequeos estáticos**

Run: `npm test && npm run tipos && npm run lint && npm run formato:verificar`
Expected: todo PASS.

- [ ] **Step 2: Levantar el backend real (con red) y cargar la cartera del borrador 1**

```bash
cd backend && (npx tsx src/server.ts > /tmp/cartera-e2e.log 2>&1 &) ; cd ..
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:3000/api/salud && break; sleep 1; done
API=http://localhost:3000/api
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@cartera.local\",\"password\":\"$(grep ^ADMIN_PASSWORD backend/.env | cut -d= -f2)\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).tokenAcceso')
H="Authorization: Bearer $TOKEN"
CARTERA=$(curl -s "$API/carteras" -H "$H" | node -pe 'JSON.parse(require("fs").readFileSync(0)).items[0].id')
id() { curl -s "$API/instrumentos/buscar?q=$1" -H "$H" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id'; }
cargar() { curl -s -o /dev/null -w "%{http_code} $1\n" -X POST "$API/operaciones" -H "$H" -H 'Content-Type: application/json' \
  -d "{\"carteraId\":\"$CARTERA\",\"tipo\":\"TENENCIA_INICIAL\",\"instrumentoId\":\"$(id $1)\",\"fecha\":\"2026-09-01\",\"cantidad\":$2,\"precio\":$3,\"moneda\":\"USD_MEP\"}"; }
cargar AMZN 72 1.50; cargar MELI 20 16.35; cargar SPY 62 11.81; cargar YM39O 344 109.30; cargar YPFD 50 3.89; cargar AE38 4 73.93
curl -s "$API/resumen?moneda=USD" -H "$H" | node -pe 'const r=JSON.parse(require("fs").readFileSync(0)); [r.frase, r.mercado.mensaje, ...r.avisos, ...r.tenencias.map(t=>`${t.ticker}: ${t.cantidad} × ${t.precioActual} = US$ ${t.valor} (${t.resultadoPct}%)`)].join("\n")'
curl -s "$API/activos/$(id AMZN)?moneda=USD" -H "$H" | node -pe 'const a=JSON.parse(require("fs").readFileSync(0)); `${a.instrumento.ticker}: ${a.historico.puntos.length} puntos, disponible=${a.historico.disponible}`'
pkill -f "tsx src/server.ts" || true
cat /tmp/cartera-e2e.log
```
Expected:
- Cada `cargar` imprime `201 <ticker>` (el backend completa solo el dólar MEP del 01/09/2026 con argentinadatos).
- El resumen imprime una frase del tipo "Tu cartera vale US$ … (≈ $ …). Desde que empezaste ganaste/perdiste … Hoy …", el mensaje del mercado y una línea por activo con precio actual real.
- La ficha de AMZN muestra cientos de puntos de historial.
- El log del servidor no tiene errores (solo "Backend escuchando…" y el cierre). Si una fuente real falla, la respuesta tiene que traer un aviso en castellano y el detalle técnico tiene que aparecer **solo** en el log, con su referencia.

> Si el día de la prueba no es hábil o el mercado está cerrado, el mensaje dice "El mercado está cerrado…" y la frase usa "En la última rueda"; es el comportamiento esperado.

- [ ] **Step 3: Mostrar el estado final**

Run: `git status --short`
Expected: solo archivos del plan, sin `.env`, `*.db` ni `src/generado/`.
