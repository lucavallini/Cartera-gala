import { z } from "zod";
import { describirProblemas, noEsValorDeEjemplo } from "../compartido/configuracion";
import { normalizarEmail } from "../compartido/email";
import { ErrorConflicto } from "../compartido/errores";
import { LARGO_MINIMO_PASSWORD, type AutenticacionServicio } from "../modulos/autenticacion";

const esquemaDatosAdministrador = z.object({
  ADMIN_EMAIL: z
    .string({ message: "Falta ADMIN_EMAIL en el .env." })
    .transform(normalizarEmail)
    .pipe(z.email("ADMIN_EMAIL no es un email válido.")),
  ADMIN_PASSWORD: z
    .string({ message: "Falta ADMIN_PASSWORD en el .env." })
    .min(
      LARGO_MINIMO_PASSWORD,
      `ADMIN_PASSWORD necesita al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    )
    .refine(noEsValorDeEjemplo, "Cambiá ADMIN_PASSWORD por una contraseña propia."),
  ADMIN_NOMBRE: z.string().trim().min(1).default("Administrador"),
});

export type ResultadoSemilla = "CREADO" | "YA_EXISTIA";

export async function sembrarAdministrador(
  autenticacion: AutenticacionServicio,
  fuente: Record<string, string | undefined>,
): Promise<ResultadoSemilla> {
  const resultado = esquemaDatosAdministrador.safeParse(fuente);
  if (!resultado.success) {
    throw new Error(
      `No se puede crear el administrador:\n  ${describirProblemas(resultado.error)}`,
    );
  }
  const datos = resultado.data;
  try {
    await autenticacion.crearUsuario({
      nombre: datos.ADMIN_NOMBRE,
      email: datos.ADMIN_EMAIL,
      password: datos.ADMIN_PASSWORD,
      rol: "ADMIN",
    });
    return "CREADO";
  } catch (error) {
    if (!(error instanceof ErrorConflicto)) throw error;
    if ((await autenticacion.rolPorEmail(datos.ADMIN_EMAIL)) === "ADMIN") return "YA_EXISTIA";
    throw new Error(
      `No se puede crear el administrador: ${datos.ADMIN_EMAIL} ya existe como usuario común, ` +
        "así que todavía no hay ningún administrador. Poné otro ADMIN_EMAIL en el .env.",
    );
  }
}
