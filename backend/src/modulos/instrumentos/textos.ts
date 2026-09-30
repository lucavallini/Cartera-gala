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
