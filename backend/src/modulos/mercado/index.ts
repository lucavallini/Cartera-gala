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
