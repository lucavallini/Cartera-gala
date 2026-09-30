import type { Request, RequestHandler, Response } from "express";
import { usuarioDe } from "../../compartido/http/usuario-de";
import { validar } from "../../compartido/validacion";
import type {
  AutenticacionServicio,
  ContextoCliente,
  ResultadoSesion,
} from "./autenticacion.servicio";
import { esquemaCambioPassword, esquemaLogin, esquemaRegistro } from "./autenticacion.esquemas";

export const NOMBRE_COOKIE_REFRESH = "cartera_refresh";
export const RUTA_COOKIE_REFRESH = "/api/auth";

function leerCookieRefresh(req: Request): string | undefined {
  const valor: unknown = req.cookies?.[NOMBRE_COOKIE_REFRESH];
  return typeof valor === "string" ? valor : undefined;
}

function contextoDe(req: Request): ContextoCliente {
  return { userAgent: req.get("user-agent"), ip: req.ip };
}

export class AutenticacionControlador {
  constructor(
    private readonly servicio: AutenticacionServicio,
    private readonly cookieSegura: boolean,
  ) {}

  readonly registrar: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaRegistro, req.body);
    this.responderSesion(res, await this.servicio.registrar(entrada, contextoDe(req)), 201);
  };

  readonly login: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaLogin, req.body);
    this.responderSesion(res, await this.servicio.login(entrada, contextoDe(req)), 200);
  };

  readonly refrescar: RequestHandler = async (req, res) => {
    const resultado = await this.servicio.refrescar(leerCookieRefresh(req), contextoDe(req));
    this.responderSesion(res, resultado, 200);
  };

  readonly logout: RequestHandler = async (req, res) => {
    await this.servicio.logout(leerCookieRefresh(req));
    res.clearCookie(NOMBRE_COOKIE_REFRESH, { path: RUTA_COOKIE_REFRESH });
    res.status(204).end();
  };

  readonly yo: RequestHandler = async (req, res) => {
    res.json(await this.servicio.yo(usuarioDe(req).id));
  };

  readonly cambiarPassword: RequestHandler = async (req, res) => {
    const entrada = validar(esquemaCambioPassword, req.body);
    await this.servicio.cambiarPassword(usuarioDe(req).id, entrada, leerCookieRefresh(req));
    res.status(204).end();
  };

  private responderSesion(res: Response, resultado: ResultadoSesion, status: number): void {
    res.cookie(NOMBRE_COOKIE_REFRESH, resultado.refresh.token, {
      httpOnly: true,
      secure: this.cookieSegura,
      sameSite: "strict",
      path: RUTA_COOKIE_REFRESH,
      expires: resultado.refresh.expiraEn,
    });
    res.status(status).json(resultado.respuesta);
  }
}
