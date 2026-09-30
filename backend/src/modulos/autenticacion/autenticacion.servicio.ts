import type {
  CambioPasswordEntrada,
  LoginEntrada,
  RegistroEntrada,
  RolUsuario,
  SesionRespuesta,
  UsuarioDto,
} from "@cartera/contratos";
import type { PrismaClient, Usuario } from "../../generado/prisma/client";
import {
  ErrorConflicto,
  ErrorNoAutorizado,
  ErrorProhibido,
  ErrorRefreshYaRotado,
  ErrorValidacion,
} from "../../compartido/errores";
import { normalizarEmail } from "../../compartido/email";
import type { ServicioContrasenas } from "./contrasenas";
import type { SesionesRepositorio } from "./sesiones.repositorio";
import type { RefreshEmitido, ServicioTokens } from "./tokens";
import type { UsuariosRepositorio } from "./usuarios.repositorio";

export const CARTERA_INICIAL = "Principal";
/** Ventana en la que reusar un refresh recién rotado no se considera robo (dos pestañas). */
export const GRACIA_REUSO_REFRESH_MS = 10_000;

const MENSAJE_CREDENCIALES = "Email o contraseña incorrectos.";
const MENSAJE_SESION_TERMINADA = "Tu sesión terminó. Iniciá sesión de nuevo.";
const MENSAJE_SESION_VENCIDA = "Tu sesión venció. Iniciá sesión de nuevo.";
const PASSWORD_FICTICIA = "contrasena-ficticia-para-igualar-tiempos";

export interface ContextoCliente {
  userAgent?: string;
  ip?: string;
}

export interface ResultadoSesion {
  respuesta: SesionRespuesta;
  refresh: { token: string; expiraEn: Date };
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
}

export interface OpcionesAutenticacion {
  registroHabilitado: boolean;
}

export function aUsuarioDto(usuario: Usuario): UsuarioDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    monedaBase: usuario.monedaBase,
    dolarReferencia: usuario.dolarReferencia,
    metodoCosto: usuario.metodoCosto,
  };
}

export class AutenticacionServicio {
  /** Se calcula al crear el servicio para que ningún login inexistente tarde distinto. */
  private readonly hashFicticio: Promise<string>;

  constructor(
    private readonly bd: PrismaClient,
    private readonly usuarios: UsuariosRepositorio,
    private readonly sesiones: SesionesRepositorio,
    private readonly contrasenas: ServicioContrasenas,
    private readonly tokens: ServicioTokens,
    private readonly opciones: OpcionesAutenticacion,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    this.hashFicticio = this.contrasenas.hashear(PASSWORD_FICTICIA);
    // Si fallara, el error aparece al usarlo; acá solo se evita el aviso de promesa sin manejar.
    this.hashFicticio.catch(() => undefined);
  }

  async registrar(entrada: RegistroEntrada, contexto: ContextoCliente): Promise<ResultadoSesion> {
    if (!this.opciones.registroHabilitado) {
      throw new ErrorProhibido(
        "El registro de cuentas nuevas está deshabilitado. Pedile acceso al administrador.",
      );
    }
    const usuario = await this.crearUsuario({ ...entrada, rol: "USUARIO" });
    return this.iniciarSesion(usuario, contexto);
  }

  /** Alta de usuario con su cartera inicial. La usan el registro y el seed del administrador. */
  async crearUsuario(nuevo: NuevoUsuario): Promise<Usuario> {
    const email = normalizarEmail(nuevo.email);
    if (await this.usuarios.buscarPorEmail(email)) {
      throw new ErrorConflicto("Ya existe una cuenta con ese email.");
    }
    const hashPassword = await this.contrasenas.hashear(nuevo.password);
    return this.usuarios.crearConCarteraInicial(
      { nombre: nuevo.nombre.trim(), email, hashPassword, rol: nuevo.rol },
      CARTERA_INICIAL,
    );
  }

  async login(entrada: LoginEntrada, contexto: ContextoCliente): Promise<ResultadoSesion> {
    const usuario = await this.usuarios.buscarPorEmail(normalizarEmail(entrada.email));
    const valida = usuario
      ? await this.contrasenas.verificar(usuario.hashPassword, entrada.password)
      : await this.verificarContraFicticia(entrada.password);
    if (!usuario || !valida) throw new ErrorNoAutorizado(MENSAJE_CREDENCIALES);
    return this.iniciarSesion(usuario, contexto);
  }

  async refrescar(
    tokenRefresh: string | undefined,
    contexto: ContextoCliente,
  ): Promise<ResultadoSesion> {
    if (!tokenRefresh) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    const sesion = await this.sesiones.buscarPorHash(this.tokens.hashearRefresh(tokenRefresh));
    if (!sesion) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    const ahora = this.ahora();

    if (sesion.revocadaEn) {
      const reusoInmediato =
        sesion.reemplazadaPorId !== null &&
        ahora.getTime() - sesion.revocadaEn.getTime() < GRACIA_REUSO_REFRESH_MS;
      if (reusoInmediato) throw new ErrorRefreshYaRotado();
      await this.sesiones.revocarCadenaDesde(sesion.id, ahora);
      throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    }
    if (sesion.expiraEn <= ahora) {
      await this.sesiones.revocar(sesion.id, ahora);
      throw new ErrorNoAutorizado(MENSAJE_SESION_VENCIDA);
    }
    const usuario = await this.usuarios.buscarPorId(sesion.usuarioId);
    if (!usuario) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);

    const refresh = this.tokens.generarRefresh();
    await this.bd.$transaction(async (tx) => {
      const nueva = await this.sesiones.crear(this.datosSesion(usuario.id, refresh, contexto), tx);
      const rotada = await this.sesiones.marcarReemplazada(sesion.id, nueva.id, ahora, tx);
      // Otro pedido la rotó entre la lectura y esta escritura: se deshace la sesión nueva.
      if (!rotada) throw new ErrorRefreshYaRotado();
    });
    return this.armarResultado(usuario, refresh);
  }

  async logout(tokenRefresh: string | undefined): Promise<void> {
    if (!tokenRefresh) return;
    const sesion = await this.sesiones.buscarPorHash(this.tokens.hashearRefresh(tokenRefresh));
    if (sesion) await this.sesiones.revocar(sesion.id, this.ahora());
  }

  /** Rol de la cuenta con ese email, o null si no existe. Lo usa el seed del administrador. */
  async rolPorEmail(email: string): Promise<RolUsuario | null> {
    const usuario = await this.usuarios.buscarPorEmail(normalizarEmail(email));
    return usuario?.rol ?? null;
  }

  async yo(usuarioId: string): Promise<UsuarioDto> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    return aUsuarioDto(usuario);
  }

  async cambiarPassword(
    usuarioId: string,
    entrada: CambioPasswordEntrada,
    tokenRefreshActual?: string,
  ): Promise<void> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorNoAutorizado(MENSAJE_SESION_TERMINADA);
    if (!(await this.contrasenas.verificar(usuario.hashPassword, entrada.passwordActual))) {
      throw new ErrorValidacion("La contraseña actual no es correcta.", [
        { campo: "passwordActual", mensaje: "La contraseña actual no es correcta." },
      ]);
    }
    if (entrada.passwordActual === entrada.passwordNueva) {
      throw new ErrorValidacion("La contraseña nueva tiene que ser distinta de la actual.", [
        { campo: "passwordNueva", mensaje: "Tiene que ser distinta de la actual." },
      ]);
    }
    const hash = await this.contrasenas.hashear(entrada.passwordNueva);
    const sesionActual = tokenRefreshActual
      ? await this.sesiones.buscarPorHash(this.tokens.hashearRefresh(tokenRefreshActual))
      : null;
    await this.bd.$transaction(async (tx) => {
      await this.usuarios.actualizarHash(usuarioId, hash, tx);
      await this.sesiones.revocarOtrasDelUsuario(
        usuarioId,
        sesionActual?.id ?? null,
        this.ahora(),
        tx,
      );
    });
  }

  private async iniciarSesion(
    usuario: Usuario,
    contexto: ContextoCliente,
  ): Promise<ResultadoSesion> {
    const refresh = this.tokens.generarRefresh();
    await this.sesiones.crear(this.datosSesion(usuario.id, refresh, contexto));
    return this.armarResultado(usuario, refresh);
  }

  private datosSesion(usuarioId: string, refresh: RefreshEmitido, contexto: ContextoCliente) {
    return {
      usuarioId,
      tokenHash: refresh.hash,
      expiraEn: refresh.expiraEn,
      userAgent: contexto.userAgent ?? null,
      ip: contexto.ip ?? null,
    };
  }

  private async armarResultado(
    usuario: Usuario,
    refresh: RefreshEmitido,
  ): Promise<ResultadoSesion> {
    const acceso = await this.tokens.firmarAcceso({ usuarioId: usuario.id, rol: usuario.rol });
    return {
      respuesta: {
        tokenAcceso: acceso.token,
        expiraEn: acceso.expiraEn.toISOString(),
        usuario: aUsuarioDto(usuario),
      },
      refresh: { token: refresh.token, expiraEn: refresh.expiraEn },
    };
  }

  /** Verifica contra un hash ficticio para que un email inexistente tarde lo mismo. */
  private async verificarContraFicticia(password: string): Promise<false> {
    await this.contrasenas.verificar(await this.hashFicticio, password);
    return false;
  }
}
