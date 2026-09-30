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
import { DECIMALES_CANTIDAD, DECIMALES_MONTO, DECIMALES_PRECIO } from "../../compartido/formato";
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
      const existentes = await this.historia(usuarioId, entrada.carteraId, tx);
      this.validarHistoria(
        aplicarCambio(existentes, { accion: "crear", operacion: preparada.motor }),
        preparada.preferencias,
      );
      const nueva: NuevaOperacion = {
        ...preparada.datos,
        carteraId: entrada.carteraId,
        origen: "MANUAL",
      };
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
      const existentes = await this.historia(usuarioId, actual.carteraId, tx);
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
      const existentes = await this.historia(usuarioId, actual.carteraId, tx);
      try {
        this.validarHistoria(aplicarCambio(existentes, { accion: "borrar", id }), preferencias);
      } catch (error) {
        if (error instanceof ErrorValidacion) {
          throw new ErrorConflicto(
            `No se puede borrar esta operación: ${minusculaInicial(error.message)}`,
          );
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
      await this.historia(usuarioId, carteraId, this.bd),
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
  async paraCalculo(usuarioId: string, carteraIds: readonly string[]): Promise<OperacionMotor[]> {
    return (await this.operaciones.deCarteras(carteraIds, usuarioId)).map(aOperacionMotor);
  }

  async deActivo(
    usuarioId: string,
    carteraIds: readonly string[],
    instrumentoId: string,
  ): Promise<OperacionDto[]> {
    const operaciones = await this.operaciones.deCarteras(
      carteraIds,
      usuarioId,
      undefined,
      instrumentoId,
    );
    const instrumentos = await this.instrumentosDe(operaciones);
    return operaciones.reverse().map((operacion) => this.aDto(operacion, instrumentos));
  }

  private async preparar(
    usuarioId: string,
    datos: DatosOperacion,
    carteraId: string,
    identidad: { id: string; secuencia: number },
  ): Promise<Preparada> {
    const { carteras, cuentas, instrumentos, mercado, usuarios, zonaHoraria, ahora } =
      this.dependencias;
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
    const tipoCambio =
      datos.tipoCambio ?? (await mercado.dolarEnFecha(preferencias.dolarReferencia, datos.fecha));
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
      gastos: gastosDe(campos),
      monto: campos.monto,
      factorPrecio: instrumento?.factorPrecio ?? aDecimal(1),
    };
    return { datos: guardables, motor, preferencias };
  }

  private async historia(
    usuarioId: string,
    carteraId: string,
    bd: ClienteBD,
  ): Promise<OperacionMotor[]> {
    return (await this.operaciones.deCarteras([carteraId], usuarioId, bd)).map(aOperacionMotor);
  }

  /** Recalcula toda la historia: si algo queda inválido, el motor explica qué y cuándo. */
  private validarHistoria(operaciones: readonly OperacionMotor[], preferencias: UsuarioDto): void {
    reconstruir(operaciones, estrategiaDeCosto(preferencias.metodoCosto), this.registro);
  }

  private async instrumentosDe(
    operaciones: readonly Operacion[],
  ): Promise<Map<string, InstrumentoCatalogado>> {
    const ids = [
      ...new Set(operaciones.flatMap((o) => (o.instrumentoId ? [o.instrumentoId] : []))),
    ];
    return this.dependencias.instrumentos.catalogados(ids);
  }

  private aDto(
    operacion: Operacion,
    instrumentos: ReadonlyMap<string, InstrumentoCatalogado>,
  ): OperacionDto {
    const instrumento = operacion.instrumentoId
      ? instrumentos.get(operacion.instrumentoId)
      : undefined;
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
