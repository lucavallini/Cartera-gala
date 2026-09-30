import type { RequestHandler } from "express";
import type { Pagina } from "@cartera/contratos";
import type { z } from "zod";
import { validar } from "../validacion";
import { parametro } from "./parametros";
import { usuarioDe } from "./usuario-de";

export interface ServicioCrud<TDto, TCrear, TEditar, TConsulta> {
  listar(usuarioId: string, consulta: TConsulta): Promise<Pagina<TDto>>;
  obtener(usuarioId: string, id: string): Promise<TDto>;
  crear(usuarioId: string, entrada: TCrear): Promise<TDto>;
  editar(usuarioId: string, id: string, entrada: TEditar): Promise<TDto>;
  borrar(usuarioId: string, id: string): Promise<void>;
}

export interface EsquemasCrud<TCrear, TEditar, TConsulta> {
  crear: z.ZodType<TCrear>;
  editar: z.ZodType<TEditar>;
  consulta: z.ZodType<TConsulta>;
}

export interface ManejadoresCrud {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
  editar: RequestHandler;
  borrar: RequestHandler;
}

/** Controlador genérico para recursos del usuario: valida, delega en el servicio y responde. */
export class ControladorCrud<TDto, TCrear, TEditar, TConsulta> implements ManejadoresCrud {
  constructor(
    private readonly servicio: ServicioCrud<TDto, TCrear, TEditar, TConsulta>,
    private readonly esquemas: EsquemasCrud<TCrear, TEditar, TConsulta>,
  ) {}

  readonly listar: RequestHandler = async (req, res) => {
    const consulta = validar(this.esquemas.consulta, req.query);
    res.json(await this.servicio.listar(usuarioDe(req).id, consulta));
  };

  readonly obtener: RequestHandler = async (req, res) => {
    res.json(await this.servicio.obtener(usuarioDe(req).id, parametro(req, "id")));
  };

  readonly crear: RequestHandler = async (req, res) => {
    const entrada = validar(this.esquemas.crear, req.body);
    res.status(201).json(await this.servicio.crear(usuarioDe(req).id, entrada));
  };

  readonly editar: RequestHandler = async (req, res) => {
    const entrada = validar(this.esquemas.editar, req.body);
    res.json(await this.servicio.editar(usuarioDe(req).id, parametro(req, "id"), entrada));
  };

  readonly borrar: RequestHandler = async (req, res) => {
    await this.servicio.borrar(usuarioDe(req).id, parametro(req, "id"));
    res.status(204).end();
  };
}
