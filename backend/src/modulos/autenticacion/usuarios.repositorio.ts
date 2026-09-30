import type { Prisma, Usuario } from "../../generado/prisma/client";
import type { ClienteBD } from "../../compartido/base-datos/cliente";

export class UsuariosRepositorio {
  constructor(private readonly bd: ClienteBD) {}

  buscarPorEmail(email: string, bd: ClienteBD = this.bd): Promise<Usuario | null> {
    return bd.usuario.findFirst({ where: { email, eliminadoEn: null } });
  }

  buscarPorId(id: string, bd: ClienteBD = this.bd): Promise<Usuario | null> {
    return bd.usuario.findFirst({ where: { id, eliminadoEn: null } });
  }

  /** Crea el usuario y su cartera inicial en una sola escritura atómica. */
  crearConCarteraInicial(
    datos: Pick<Prisma.UsuarioCreateInput, "nombre" | "email" | "hashPassword" | "rol">,
    nombreCartera: string,
    bd: ClienteBD = this.bd,
  ): Promise<Usuario> {
    return bd.usuario.create({
      data: { ...datos, carteras: { create: { nombre: nombreCartera, esPrincipal: true } } },
    });
  }

  async actualizarHash(id: string, hashPassword: string, bd: ClienteBD = this.bd): Promise<void> {
    await bd.usuario.update({ where: { id }, data: { hashPassword } });
  }
}
