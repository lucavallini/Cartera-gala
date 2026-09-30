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
