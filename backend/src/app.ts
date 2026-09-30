import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router, type Express } from "express";
import helmet from "helmet";
import type { Contenedor } from "./contenedor";
import { crearManejadorErrores } from "./compartido/http/manejador-errores";
import { referenciaPedido } from "./compartido/http/referencia-pedido";
import { rutaNoEncontrada } from "./compartido/http/ruta-no-encontrada";

const LIMITE_CUERPO_JSON = "1mb";

export function crearApp(contenedor: Contenedor): Express {
  const app = express();
  app.use(referenciaPedido);
  // Detrás de un proxy, confiar en un salto para leer la IP real del cliente.
  app.set("trust proxy", contenedor.entorno.TRUST_PROXY ? 1 : false);
  app.use(helmet());
  app.use(cors({ origin: contenedor.entorno.CORS_ORIGEN, credentials: true }));
  app.use(express.json({ limit: LIMITE_CUERPO_JSON }));
  app.use(cookieParser());

  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });
  app.use("/api/auth", contenedor.autenticacion.rutas);

  const privadas = Router();
  privadas.use(contenedor.autenticacion.requiereAutenticacion);
  privadas.use("/carteras", contenedor.carteras.rutas);
  privadas.use("/cuentas", contenedor.cuentas.rutas);
  privadas.use("/instrumentos", contenedor.instrumentos.rutas);
  privadas.use("/cotizaciones", contenedor.mercado.rutas);
  privadas.use("/operaciones", contenedor.operaciones.rutas);
  privadas.use("/resumen", contenedor.resumen.rutasResumen);
  privadas.use("/activos", contenedor.resumen.rutasActivos);
  app.use("/api", privadas);

  app.use(rutaNoEncontrada);
  app.use(crearManejadorErrores());
  return app;
}
