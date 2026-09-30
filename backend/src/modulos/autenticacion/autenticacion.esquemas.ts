import { z } from "zod";
import type { CambioPasswordEntrada, LoginEntrada, RegistroEntrada } from "@cartera/contratos";
import { normalizarEmail } from "../../compartido/email";
import { LARGO_MAXIMO_PASSWORD, LARGO_MINIMO_PASSWORD } from "./contrasenas";

const LARGO_MAXIMO_NOMBRE = 80;
const LARGO_MAXIMO_EMAIL = 254;

const passwordNueva = z
  .string({ message: "Poné una contraseña." })
  .min(
    LARGO_MINIMO_PASSWORD,
    `La contraseña necesita al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
  )
  .max(
    LARGO_MAXIMO_PASSWORD,
    `La contraseña puede tener hasta ${LARGO_MAXIMO_PASSWORD} caracteres.`,
  );

export const esquemaRegistro = z.object({
  nombre: z
    .string({ message: "Poné tu nombre." })
    .trim()
    .min(1, "Poné tu nombre.")
    .max(LARGO_MAXIMO_NOMBRE, `El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`),
  email: z
    .string({ message: "Poné tu email." })
    .max(LARGO_MAXIMO_EMAIL)
    .transform(normalizarEmail)
    .pipe(z.email("El email no es válido. Ejemplo: nombre@gmail.com")),
  password: passwordNueva,
}) satisfies z.ZodType<RegistroEntrada>;

export const esquemaLogin = z.object({
  email: z.string({ message: "Poné tu email." }).trim().min(1, "Poné tu email."),
  password: z.string({ message: "Poné tu contraseña." }).min(1, "Poné tu contraseña."),
}) satisfies z.ZodType<LoginEntrada>;

export const esquemaCambioPassword = z.object({
  passwordActual: z
    .string({ message: "Poné tu contraseña actual." })
    .min(1, "Poné tu contraseña actual."),
  passwordNueva,
}) satisfies z.ZodType<CambioPasswordEntrada>;
