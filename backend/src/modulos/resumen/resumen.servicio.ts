import type {
  ActivoDto,
  ClaveTarjeta,
  MonedaVista,
  PesoDto,
  ResultadoActivoDto,
  ResumenDto,
  TarjetaDto,
  TenenciaDto,
  TipoDolar,
  Tono,
  UsuarioDto,
} from "@cartera/contratos";
import { CERO, CIEN, aNumero, type Decimal } from "../../compartido/decimal";
import { ErrorProveedorExterno } from "../../compartido/errores";
import { fechaCortaEn, formatoFechaCorta } from "../../compartido/fechas";
import {
  DECIMALES_CANTIDAD,
  DECIMALES_MONTO,
  DECIMALES_PORCENTAJE,
  DECIMALES_PRECIO,
  formatearMoneda,
  textoMoneda,
} from "../../compartido/formato";
import type { FuentePreferencias } from "../../compartido/preferencias";
import { estrategiaDeCosto } from "../../motor/costo/estrategia-costo";
import { enMoneda, sumarTodos } from "../../motor/importe";
import { crearRegistroManejadores } from "../../motor/operaciones/registro-manejadores";
import { ponderar, type Peso } from "../../motor/ponderacion";
import { cantidadDe, precioPromedio } from "../../motor/posicion";
import { reconstruir } from "../../motor/tenencia";
import { totalizar, type PosicionValuada, type TotalesCartera } from "../../motor/totales";
import type { EstadoCartera, OperacionMotor } from "../../motor/tipos";
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

/** Unos tres años de ruedas: suficiente para el gráfico sin mandar miles de puntos. */
const MAXIMO_PUNTOS_HISTORICO = 750;
const TIPOS_CON_MARCA: ReadonlySet<string> = new Set(["TENENCIA_INICIAL", "COMPRA", "VENTA"]);

export interface DependenciasResumen {
  carteras: CarterasServicio;
  operaciones: OperacionesServicio;
  instrumentos: InstrumentosServicio;
  mercado: MercadoServicio;
  usuarios: FuentePreferencias;
  zonaHoraria: string;
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
  /** null solo si no hay operaciones y el dólar no está disponible: no hay nada que convertir. */
  dolar: DolarVigente | null;
  /** Aviso cuando el dólar salió del tipo de cambio de la última operación. */
  avisoDolar: string | null;
  tenencias: TenenciaAgrupada[];
}

interface DolarDelCalculo {
  dolar: DolarVigente | null;
  aviso: string | null;
}

interface DefinicionTarjeta {
  clave: ClaveTarjeta;
  titulo: string;
  explicacion: string;
}

const TARJETAS: Record<ClaveTarjeta, DefinicionTarjeta> = {
  valorActual: {
    clave: "valorActual",
    titulo: "Valor actual",
    explicacion: "Lo que vale hoy todo lo que tenés.",
  },
  invertido: {
    clave: "invertido",
    titulo: "Invertido",
    explicacion: "Lo que pagaste por lo que tenés hoy.",
  },
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
  cobros: {
    clave: "cobros",
    titulo: "Cobros",
    explicacion: "Dividendos y rentas (cupones) que cobraste.",
  },
  rendimiento: {
    clave: "rendimiento",
    titulo: "Rendimiento total",
    explicacion: "Cuánto ganaste en total sobre todo lo que invertiste.",
  },
  variacionDiaria: {
    clave: "variacionDiaria",
    titulo: "Variación de hoy",
    explicacion:
      "Cuánto cambió hoy el valor de tu cartera. La variación es la del activo en pesos.",
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
    const vacio = estado.posiciones.size === 0 && !estado.registraEfectivo;
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
          calculo.tenencias.map((g) => ({
            clave: g.instrumento.id,
            etiqueta: g.instrumento.ticker,
            valor: enMoneda(g.valor, vista),
          })),
        ).map(aPesoDto),
        porTipo: ponderar(
          calculo.tenencias.map((g) => ({
            clave: g.instrumento.tipo,
            etiqueta: TEXTO_TIPO_INSTRUMENTO[g.instrumento.tipo],
            valor: enMoneda(g.valor, vista),
          })),
        ).map(aPesoDto),
      },
      efectivo: totales.efectivo
        ? {
            valor: aNumero(enMoneda(totales.efectivo, vista), DECIMALES_MONTO),
            detalle: [...estado.efectivo].map(([moneda, monto]) => ({
              moneda,
              monedaTexto: textoMoneda(moneda),
              monto: aNumero(monto, DECIMALES_MONTO),
            })),
          }
        : null,
      dolar: dolar
        ? {
            tipo: dolar.tipo,
            valor: aNumero(dolar.valor, DECIMALES_MONTO),
            actualizadoEn: dolar.actualizadoEn.toISOString(),
            desactualizado: dolar.desactualizado,
          }
        : null,
      mercado,
      avisos: this.avisos(calculo, mercado.desactualizado ? mercado.mensaje : null),
    };
  }

  async activo(
    usuarioId: string,
    instrumentoId: string,
    consulta: ConsultaResumen,
  ): Promise<ActivoDto> {
    const { instrumentos, operaciones, mercado } = this.dependencias;
    const calculo = await this.calcular(usuarioId, consulta);
    // Una sola lectura del instrumento: la del catálogo del cálculo si ya lo trae, si no se pide.
    const catalogado =
      calculo.catalogo.get(instrumentoId) ?? (await instrumentos.catalogado(instrumentoId));
    const instrumento = await instrumentos.aDtoDeCatalogado(usuarioId, catalogado);
    const grupo = calculo.tenencias.find((g) => g.instrumento.id === instrumentoId);
    const movimientos = await operaciones.deActivo(usuarioId, calculo.carteraIds, instrumentoId);
    const moneda = grupo?.monedaPrecio ?? movimientos[0]?.moneda ?? "ARS";
    const historico = await mercado.historico(
      catalogado,
      moneda,
      calculo.preferencias.dolarReferencia,
    );
    return {
      instrumento,
      tenencia: grupo
        ? this.aTenenciaDto(
            grupo,
            calculo.vista,
            enMoneda(calculo.totales.valorPosiciones, calculo.vista),
          )
        : null,
      resultado: this.resultadoDeActivo(calculo, instrumentoId),
      operaciones: movimientos,
      historico: {
        disponible: historico.disponible,
        mensaje: historico.disponible
          ? null
          : "Todavía no tenemos el historial de precios de este activo.",
        moneda: historico.moneda,
        monedaTexto: textoMoneda(historico.moneda),
        puntos: historico.puntos.slice(-MAXIMO_PUNTOS_HISTORICO).map((punto) => ({
          fecha: punto.fecha,
          cierre: aNumero(punto.cierre, DECIMALES_PRECIO),
        })),
        marcas: movimientos
          .filter((o) => TIPOS_CON_MARCA.has(o.tipo))
          .map((o) => ({
            fecha: o.fecha,
            tipo: o.tipo,
            tipoTexto: o.tipoTexto,
            cantidad: o.cantidad,
            precio: o.precio,
          }))
          .reverse(),
      },
    };
  }

  protected async calcular(usuarioId: string, consulta: ConsultaResumen): Promise<Calculo> {
    const { carteras, operaciones, instrumentos, mercado, usuarios, ahora } = this.dependencias;
    const preferencias = await usuarios.yo(usuarioId);
    const vista: MonedaVista =
      consulta.moneda ?? (preferencias.monedaBase === "ARS" ? "ARS" : "USD");
    const carteraIds = consulta.carteraId
      ? [(await carteras.obtener(usuarioId, consulta.carteraId)).id]
      : await carteras.idsActivas(usuarioId);
    const operacionesDelCalculo = await operaciones.paraCalculo(usuarioId, carteraIds);
    const estado = reconstruir(
      operacionesDelCalculo,
      estrategiaDeCosto(preferencias.metodoCosto),
      this.registro,
    );
    const posiciones = [...estado.posiciones.values()];
    const catalogo = await instrumentos.catalogados([
      ...new Set(posiciones.map((p) => p.instrumentoId)),
    ]);
    const vivos = posiciones
      .filter((p) => cantidadDe(p).gt(0))
      .flatMap((p) => {
        const instrumento = catalogo.get(p.instrumentoId);
        return instrumento ? [instrumento] : [];
      });
    const [precios, { dolar, aviso: avisoDolar }] = await Promise.all([
      mercado.precios(usuarioId, [...new Map(vivos.map((i) => [i.id, i])).values()]),
      this.dolarDelCalculo(preferencias.dolarReferencia, operacionesDelCalculo),
    ]);
    // Sin dólar no hay operaciones: no hay posiciones ni efectivo que convertir.
    const valorDolar = dolar?.valor ?? CERO;
    const valuadas = posiciones.flatMap((posicion) => {
      const instrumento = catalogo.get(posicion.instrumentoId);
      if (!instrumento) return [];
      const valuacion = valuadorPara(instrumento.tipo).valuar(
        posicion,
        precios.precios.get(instrumento.id),
        {
          dolar: valorDolar,
          ahora: ahora(),
          tasaAnual: instrumento.tasaAnual,
        },
      );
      return [{ posicion, valuacion }];
    });
    return {
      preferencias,
      vista,
      carteraIds,
      estado,
      valuadas,
      totales: totalizar(valuadas, estado, valorDolar),
      catalogo,
      precios,
      dolar,
      avisoDolar,
      tenencias: agruparPorInstrumento(valuadas, catalogo),
    };
  }

  /**
   * El dólar vigente; si los proveedores fallan, el tipo de cambio de la operación más reciente
   * (todas lo guardan). Sin operaciones no hace falta: la cartera vacía se muestra igual.
   */
  private async dolarDelCalculo(
    tipo: TipoDolar,
    operaciones: readonly OperacionMotor[],
  ): Promise<DolarDelCalculo> {
    try {
      return { dolar: await this.dependencias.mercado.dolarVigente(tipo), aviso: null };
    } catch (error) {
      if (!(error instanceof ErrorProveedorExterno)) throw error;
    }
    const ultima = operaciones.reduce<OperacionMotor | null>(
      (masNueva, operacion) =>
        !masNueva ||
        operacion.fecha > masNueva.fecha ||
        (operacion.fecha.getTime() === masNueva.fecha.getTime() &&
          operacion.secuencia > masNueva.secuencia)
          ? operacion
          : masNueva,
      null,
    );
    if (!ultima) return { dolar: null, aviso: null };
    return {
      dolar: {
        tipo,
        valor: ultima.tipoCambio,
        actualizadoEn: ultima.fecha,
        desactualizado: true,
      },
      aviso:
        "No pudimos obtener el dólar: usamos el último tipo de cambio de tus operaciones " +
        `(${formatearMoneda(ultima.tipoCambio, "ARS")} del ${formatoFechaCorta(ultima.fecha)}).`,
    };
  }

  /**
   * Lo realizado y cobrado con este activo en todas sus posiciones (aunque ya no se tenga),
   * en la moneda de la vista.
   */
  private resultadoDeActivo(calculo: Calculo, instrumentoId: string): ResultadoActivoDto {
    const posiciones = [...calculo.estado.posiciones.values()].filter(
      (p) => p.instrumentoId === instrumentoId,
    );
    const realizado = enMoneda(sumarTodos(posiciones.map((p) => p.realizado)), calculo.vista);
    const cobros = enMoneda(sumarTodos(posiciones.map((p) => p.cobros)), calculo.vista);
    return {
      realizado: aNumero(realizado, DECIMALES_MONTO),
      cobros: aNumero(cobros, DECIMALES_MONTO),
      explicacion: this.explicacionResultado(realizado, cobros, calculo.vista),
    };
  }

  private explicacionResultado(realizado: Decimal, cobros: Decimal, vista: MonedaVista): string {
    if (realizado.isZero() && cobros.isZero()) {
      return "Todavía no vendiste nada ni cobraste dividendos o rentas de este activo.";
    }
    const parteVenta = realizado.isZero()
      ? null
      : `${realizado.gte(0) ? "ganaste" : "perdiste"} ${formatearMoneda(realizado.abs(), vista)}`;
    const parteCobro = cobros.isZero()
      ? null
      : `cobraste ${formatearMoneda(cobros, vista)} en dividendos y rentas`;
    if (parteVenta && parteCobro) return `Con las ventas ${parteVenta} y ${parteCobro}.`;
    if (parteVenta) return `Con las ventas ${parteVenta}.`;
    return `Con este activo ${parteCobro}.`;
  }

  protected aTenenciaDto(
    grupo: TenenciaAgrupada,
    vista: MonedaVista,
    valorPosiciones: Decimal,
  ): TenenciaDto {
    const valor = enMoneda(grupo.valor, vista);
    const invertido = enMoneda(grupo.costo, vista);
    const resultado = valor.minus(invertido);
    // grupo.cantidad siempre es > 0 (así se arman las tenencias): nunca da null.
    const promedio = precioPromedio(grupo) ?? CERO;
    const { valuacion, instrumento } = grupo;
    return {
      instrumentoId: instrumento.id,
      ticker: instrumento.ticker,
      nombre: instrumento.nombre,
      tipo: instrumento.tipo,
      tipoTexto: TEXTO_TIPO_INSTRUMENTO[instrumento.tipo],
      cantidad: aNumero(grupo.cantidad, DECIMALES_CANTIDAD),
      monedaPrecio: grupo.monedaPrecio,
      monedaPrecioTexto: textoMoneda(grupo.monedaPrecio),
      precioPromedio: aNumero(promedio, DECIMALES_PRECIO),
      precioActual: numeroONulo(valuacion.precio, DECIMALES_PRECIO),
      variacionDiariaPct: numeroONulo(valuacion.variacionPct, DECIMALES_PORCENTAJE),
      valor: aNumero(valor, DECIMALES_MONTO),
      invertido: aNumero(invertido, DECIMALES_MONTO),
      resultado: aNumero(resultado, DECIMALES_MONTO),
      resultadoPct: invertido.isZero()
        ? null
        : aNumero(resultado.div(invertido).mul(CIEN), DECIMALES_PORCENTAJE),
      realizado: aNumero(enMoneda(grupo.realizado, vista), DECIMALES_MONTO),
      cobros: aNumero(enMoneda(grupo.cobros, vista), DECIMALES_MONTO),
      peso: valorPosiciones.isZero()
        ? 0
        : aNumero(valor.div(valorPosiciones).mul(CIEN), DECIMALES_PORCENTAJE),
      sinCotizacion: valuacion.sinCotizacion,
      fuentePrecio: valuacion.fuente,
      explicacionPrecio: explicacionPrecio(instrumento.factorPrecio),
    };
  }

  private tarjetas(totales: TotalesCartera, vista: MonedaVista): TarjetaDto[] {
    const pct = (valor: { ars: Decimal | null; usd: Decimal | null }) =>
      vista === "ARS" ? valor.ars : valor.usd;
    const invertido = enMoneda(totales.invertido, vista);
    const noRealizado = enMoneda(totales.noRealizado, vista);
    const tarjeta = (
      clave: ClaveTarjeta,
      valor: Decimal,
      porcentaje: Decimal | null,
      conTono: boolean,
    ): TarjetaDto => ({
      ...TARJETAS[clave],
      valor: aNumero(valor, DECIMALES_MONTO),
      porcentaje: numeroONulo(porcentaje, DECIMALES_PORCENTAJE),
      tono: conTono ? tono(valor) : "neutro",
    });
    return [
      tarjeta("valorActual", enMoneda(totales.valor, vista), null, false),
      tarjeta("invertido", invertido, null, false),
      tarjeta(
        "noRealizado",
        noRealizado,
        invertido.isZero() ? null : noRealizado.div(invertido).mul(CIEN),
        true,
      ),
      tarjeta("realizado", enMoneda(totales.realizado, vista), null, true),
      tarjeta("cobros", enMoneda(totales.cobros, vista), null, true),
      tarjeta(
        "rendimiento",
        enMoneda(totales.resultadoTotal, vista),
        pct(totales.rendimientoPct),
        true,
      ),
      tarjeta(
        "variacionDiaria",
        enMoneda(totales.variacionDiaria, vista),
        pct(totales.variacionDiariaPct),
        true,
      ),
    ];
  }

  private avisos(calculo: Calculo, avisoMercado: string | null): string[] {
    const avisos: string[] = avisoMercado ? [avisoMercado] : [];
    const sinPrecio = calculo.tenencias
      .filter((g) => g.valuacion.sinCotizacion)
      .map((g) => g.instrumento.ticker);
    if (sinPrecio.length > 0) {
      avisos.push(
        `No encontramos precio de mercado para ${sinPrecio.join(", ")}: se muestra lo que pagaste. ` +
          "Podés cargar un precio a mano desde la ficha del activo.",
      );
    }
    for (const grupo of calculo.tenencias) {
      const precio = calculo.precios.precios.get(grupo.instrumento.id);
      if (precio?.fuente === "MANUAL") {
        avisos.push(
          `${grupo.instrumento.ticker} usa el precio que cargaste a mano el ` +
            `${fechaCortaEn(this.dependencias.zonaHoraria, precio.actualizadoEn)}.`,
        );
      }
    }
    if (calculo.avisoDolar) {
      avisos.push(calculo.avisoDolar);
    } else if (calculo.dolar?.desactualizado) {
      avisos.push(
        `No pudimos actualizar el dólar: se usa el último valor conocido ` +
          `(${formatearMoneda(calculo.dolar.valor, "ARS")}).`,
      );
    }
    for (const [moneda, monto] of calculo.estado.efectivo) {
      if (calculo.estado.registraEfectivo && monto.lt(0)) {
        const texto = textoMoneda(moneda);
        avisos.push(
          `Tu efectivo en ${texto.charAt(0).toLowerCase()}${texto.slice(1)} da negativo: ` +
            "puede faltar registrar algún depósito.",
        );
      }
    }
    // Ningún aviso se repite (por ejemplo, la misma advertencia desde dos fuentes distintas).
    return [...new Set(avisos)];
  }
}
