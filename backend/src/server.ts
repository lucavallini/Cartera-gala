import "dotenv/config";
import { crearApp } from "./app";
import { cargarEntorno } from "./config/entorno";
import { crearContenedor } from "./contenedor";

function arrancar(): void {
  const entorno = cargarEntorno();
  const contenedor = crearContenedor(entorno);
  const servidor = crearApp(contenedor).listen(entorno.PORT, () => {
    console.log(`Backend escuchando en http://localhost:${entorno.PORT}`);
  });

  const apagar = async (senal: string) => {
    console.log(`Recibí ${senal}. Cerrando…`);
    servidor.close();
    await contenedor.bd.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void apagar("SIGINT"));
  process.on("SIGTERM", () => void apagar("SIGTERM"));
}

try {
  arrancar();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
