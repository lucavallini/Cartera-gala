import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, Usuario } from "../../src/generado/prisma/client";

export function crearUsuarioPrueba(
  bd: PrismaClient,
  datos: Partial<Prisma.UsuarioCreateInput> = {},
): Promise<Usuario> {
  return bd.usuario.create({
    data: {
      nombre: "Usuario de prueba",
      email: `fabrica-${randomUUID()}@prueba.com`,
      hashPassword: "hash-que-no-se-usa",
      ...datos,
    },
  });
}
