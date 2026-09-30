import type { RequestHandler } from "express";
import { ErrorRutaNoEncontrada } from "../errores";

export const rutaNoEncontrada: RequestHandler = () => {
  throw new ErrorRutaNoEncontrada();
};
