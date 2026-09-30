import type { Cuenta, Prisma } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";
import { RepositorioDelUsuario } from "../../compartido/repositorios/repositorio-del-usuario";

export type NuevaCuenta = Omit<Prisma.CuentaUncheckedCreateInput, "usuarioId">;
export type EdicionCuenta = Pick<
  Prisma.CuentaUncheckedUpdateInput,
  "broker" | "numeroComitente" | "alias"
>;

export class CuentasRepositorio extends RepositorioDelUsuario<
  Cuenta,
  NuevaCuenta,
  Prisma.CuentaUncheckedCreateInput,
  EdicionCuenta
> {
  protected readonly entidad = "la cuenta";
  protected readonly camposOrdenables = ["broker", "alias", "creadoEn"] as const;
  protected readonly ordenPorDefecto = "broker";
  protected override readonly nombresOrden = {
    broker: "bróker",
    alias: "alias",
    creadoEn: "fecha de carga",
  };

  protected delegado(bd: ClienteBD) {
    return bd.cuenta;
  }

  protected conDueno(usuarioId: string, datos: NuevaCuenta) {
    return { ...datos, usuarioId };
  }
}
