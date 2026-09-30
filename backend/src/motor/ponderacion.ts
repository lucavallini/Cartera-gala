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
    porClave.set(
      entrada.clave,
      actual ? { ...actual, valor: actual.valor.plus(entrada.valor) } : { ...entrada },
    );
  }
  const positivas = [...porClave.values()].filter((entrada) => entrada.valor.gt(0));
  const total = positivas.reduce((suma, entrada) => suma.plus(entrada.valor), CERO);
  return positivas
    .sort((a, b) => b.valor.comparedTo(a.valor) || a.etiqueta.localeCompare(b.etiqueta, "es"))
    .map((entrada) => ({ ...entrada, porcentaje: entrada.valor.div(total).mul(CIEN) }));
}
