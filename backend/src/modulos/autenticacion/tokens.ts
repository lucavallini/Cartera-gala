import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { RolUsuario } from "@cartera/contratos";
import { ErrorNoAutorizado } from "../../compartido/errores";

const EMISOR = "cartera-gala";
const ALGORITMO = "HS256";
const BYTES_REFRESH = 32;
const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 86_400_000;
const MENSAJE_SESION_INVALIDA = "Tu sesión venció o no es válida. Iniciá sesión de nuevo.";

export interface CargaAcceso {
  usuarioId: string;
  rol: RolUsuario;
}

export interface TokenEmitido {
  token: string;
  expiraEn: Date;
}

export interface RefreshEmitido extends TokenEmitido {
  /** Lo único que se guarda en la base: el token en claro solo viaja en la cookie. */
  hash: string;
}

function esRol(valor: unknown): valor is RolUsuario {
  return valor === "ADMIN" || valor === "USUARIO";
}

export class ServicioTokens {
  private readonly clave: Uint8Array;

  constructor(
    secreto: string,
    private readonly minutosAcceso: number,
    private readonly diasRefresh: number,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    this.clave = new TextEncoder().encode(secreto);
  }

  async firmarAcceso(carga: CargaAcceso): Promise<TokenEmitido> {
    const momento = this.ahora();
    const expiraEn = new Date(momento.getTime() + this.minutosAcceso * MS_POR_MINUTO);
    const token = await new SignJWT({ rol: carga.rol })
      .setProtectedHeader({ alg: ALGORITMO })
      .setSubject(carga.usuarioId)
      .setIssuer(EMISOR)
      .setIssuedAt(Math.floor(momento.getTime() / 1000))
      .setExpirationTime(Math.floor(expiraEn.getTime() / 1000))
      .sign(this.clave);
    return { token, expiraEn };
  }

  async verificarAcceso(token: string): Promise<CargaAcceso> {
    try {
      const { payload } = await jwtVerify(token, this.clave, {
        issuer: EMISOR,
        algorithms: [ALGORITMO],
        currentDate: this.ahora(),
      });
      if (typeof payload.sub !== "string" || !esRol(payload["rol"])) {
        throw new ErrorNoAutorizado(MENSAJE_SESION_INVALIDA);
      }
      return { usuarioId: payload.sub, rol: payload["rol"] };
    } catch {
      throw new ErrorNoAutorizado(MENSAJE_SESION_INVALIDA);
    }
  }

  generarRefresh(): RefreshEmitido {
    const token = randomBytes(BYTES_REFRESH).toString("base64url");
    return {
      token,
      hash: this.hashearRefresh(token),
      expiraEn: new Date(this.ahora().getTime() + this.diasRefresh * MS_POR_DIA),
    };
  }

  hashearRefresh(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
