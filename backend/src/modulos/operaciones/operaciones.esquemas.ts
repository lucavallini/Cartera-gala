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
  return z.object({
    tipo: z.literal(tipo),
    ...comunes,
    instrumentoId,
    monto: esquemaDecimalPositivo,
  });
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
    z.object({
      accion: z.literal("editar"),
      id: id("Falta la operación."),
      operacion: esquemaDatosOperacion,
    }),
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
