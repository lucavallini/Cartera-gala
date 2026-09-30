import { z } from "zod";
import { describirProblemas, noEsValorDeEjemplo } from "../compartido/configuracion";

const booleano = z
  .enum(["true", "false"], { message: 'Tiene que ser "true" o "false".' })
  .transform((valor) => valor === "true");

const entero = z.coerce.number().int().positive();

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: entero.default(3000),
  DATABASE_URL: z.string({ message: "Falta la ruta de la base de datos." }).min(1),
  CORS_ORIGEN: z.url().default("http://localhost:4200"),
  JWT_SECRETO: z
    .string({ message: "Falta el secreto para firmar los tokens." })
    .min(32, "Tiene que tener al menos 32 caracteres.")
    .refine(
      noEsValorDeEjemplo,
      "Cambiá JWT_SECRETO por uno aleatorio. Generalo con: " +
        "node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    ),
  JWT_ACCESO_MINUTOS: entero.default(15),
  REFRESH_DIAS: entero.default(30),
  REGISTRO_HABILITADO: booleano.default(true),
  LOGIN_INTENTOS_MAX: entero.default(10),
  LOGIN_VENTANA_MINUTOS: entero.default(15),
  /** true solo si el backend corre detrás de un proxy (hosting online): así se ve la IP real. */
  TRUST_PROXY: booleano.default(false),
  ZONA_HORARIA: z.string().default("America/Argentina/Buenos_Aires"),
  /** Segundos que se reutilizan los precios del mercado antes de volver a pedirlos. */
  CACHE_COTIZACIONES_SEGUNDOS: entero.default(60),
});

export type Entorno = z.output<typeof esquemaEntorno>;

export function cargarEntorno(fuente: Record<string, string | undefined> = process.env): Entorno {
  const resultado = esquemaEntorno.safeParse(fuente);
  if (!resultado.success) {
    throw new Error(
      `La configuración del .env no es válida:\n  ${describirProblemas(resultado.error)}`,
    );
  }
  return resultado.data;
}
