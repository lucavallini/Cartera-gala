import argon2 from "argon2";

export const LARGO_MINIMO_PASSWORD = 10;
/** Tope para que nadie mande textos enormes que hagan lento el hash. */
export const LARGO_MAXIMO_PASSWORD = 200;

export class ServicioContrasenas {
  hashear(plano: string): Promise<string> {
    return argon2.hash(plano, { type: argon2.argon2id });
  }

  async verificar(hash: string, plano: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plano);
    } catch {
      return false;
    }
  }
}
