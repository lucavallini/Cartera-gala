import type { PrismaClient } from "./generado/prisma/client";
import type { Entorno } from "./config/entorno";
import { crearClienteBD } from "./compartido/base-datos/cliente";
import { AuditoriaRepositorio } from "./compartido/auditoria/auditoria.repositorio";
import { crearModuloAutenticacion, type ModuloAutenticacion } from "./modulos/autenticacion";
import { crearModuloCarteras, type ModuloCarteras } from "./modulos/carteras";
import { crearModuloCuentas, type ModuloCuentas } from "./modulos/cuentas";
import { crearModuloInstrumentos, type ModuloInstrumentos } from "./modulos/instrumentos";
import { crearModuloMercado, type ModuloMercado } from "./modulos/mercado";
import { crearModuloOperaciones, type ModuloOperaciones } from "./modulos/operaciones";
import { crearModuloResumen, type ModuloResumen } from "./modulos/resumen";
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
  mercado: ModuloMercado;
  operaciones: ModuloOperaciones;
  resumen: ModuloResumen;
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
  const instrumentos = crearModuloInstrumentos(bd, proveedores.cotizaciones, ahora);
  const mercado = crearModuloMercado({
    ...proveedores,
    manuales: instrumentos.servicio,
    zonaHoraria: entorno.ZONA_HORARIA,
    ahora,
  });
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
  const resumen = crearModuloResumen({
    carteras: carteras.servicio,
    operaciones: operaciones.servicio,
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
    resumen,
  };
}
