import "dotenv/config";
import { cargarEntorno } from "../src/config/entorno";
import { normalizarEmail } from "../src/compartido/email";
import { crearContenedor } from "../src/contenedor";
import { sembrarAdministrador } from "../src/semillas/administrador";

const contenedor = crearContenedor(cargarEntorno());
try {
  const resultado = await sembrarAdministrador(contenedor.autenticacion.servicio, process.env);
  console.log(
    resultado === "CREADO"
      ? `Administrador ${normalizarEmail(process.env["ADMIN_EMAIL"] ?? "")} creado con su cartera "Principal".`
      : "El administrador ya existía. No se cambió nada.",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await contenedor.bd.$disconnect();
}
