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
