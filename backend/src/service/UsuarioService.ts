import crypto from "node:crypto";
import { UsuarioRepository } from "../repositories/UsuarioRepository.ts";

interface RegistroUsuario {
  id?: number | string;
  codigo_empleado?: string | number | null;
  password_hash?: string | null;
  contrasena?: string | null;
  password?: string | null;
  clave?: string | null;
  pin?: string | null;
  estado_cuenta?: string | null;
  [key: string]: unknown;
}

export class UsuarioService {
  private readonly repo: UsuarioRepository;

  constructor(repo = new UsuarioRepository()) {
    this.repo = repo;
  }

  private async verificarClave(
    claveIngresada: string,
    claveGuardada: string
  ): Promise<boolean> {
    if (!claveGuardada || !claveIngresada) return false;

    if (/^\$2[aby]\$\d{2}\$/.test(claveGuardada)) {
      try {
        const modName = "bcryptjs";
        const bcryptjs = await import(/* @vite-ignore */ modName).catch(() => null);
        if (bcryptjs?.compare) {
          return await bcryptjs.compare(claveIngresada, claveGuardada);
        }
      } catch {
        // Continúa si no está bcryptjs
      }

      try {
        const modName = "bcrypt";
        const bcrypt = await import(/* @vite-ignore */ modName).catch(() => null);
        if (bcrypt?.compare) {
          return await bcrypt.compare(claveIngresada, claveGuardada);
        }
      } catch {
        // Continúa si no está bcrypt
      }
    }

    // Verifica formato `${salt}:${derivedKeyHex}` generado con scryptSync
    const partes = claveGuardada.split(":");
    if (partes.length === 2 && partes[0] && partes[1] && /^[0-9a-fA-F]+$/.test(partes[1])) {
      const [salt, keyHex] = partes;
      const keyBuffer = Buffer.from(keyHex, "hex");
      const derivedBuffer = crypto.scryptSync(claveIngresada, salt, keyBuffer.length);
      if (keyBuffer.length === derivedBuffer.length) {
        return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
      }
    }

    return claveGuardada.trim() === claveIngresada.trim() || claveGuardada === claveIngresada;
  }

  private limpiarDatosSensibles(usuario: RegistroUsuario) {
    const {
      password_hash: _p,
      contrasena: _c,
      password: _pw,
      clave: _cl,
      pin: _pn,
      ...usuarioSeguro
    } = usuario;
    return usuarioSeguro;
  }

  async login(codigo_empleado: string, clave: string) {
    const codigoLimpio = String(codigo_empleado ?? "").trim();
    const claveLimpia = String(clave ?? "");

    if (!codigoLimpio || !claveLimpia) {
      throw new Error("Credenciales inválidas");
    }

    const rawUsuario = (await this.repo.buscarPorCodigo(codigoLimpio)) as
      | RegistroUsuario
      | RegistroUsuario[]
      | null
      | undefined;

    const usuario = Array.isArray(rawUsuario) ? rawUsuario[0] : rawUsuario;

    if (!usuario || typeof usuario !== "object") {
      console.warn(`[UsuarioService.login] No se encontró usuario con código: "${codigoLimpio}"`);
      throw new Error("Credenciales inválidas");
    }

    const passwordGuardada = String(
      usuario.password_hash ??
        usuario.contrasena ??
        usuario.password ??
        usuario.clave ??
        usuario.pin ??
        ""
    );

    const claveValida = await this.verificarClave(claveLimpia, passwordGuardada);
    if (!claveValida) {
      console.warn(
        `[UsuarioService.login] Contraseña no coincide para código: "${codigoLimpio}" (tiene clave guardada: ${Boolean(passwordGuardada)})`
      );
      throw new Error("Credenciales inválidas");
    }

    const estadoNormalizado = String(usuario.estado_cuenta ?? "activo")
      .trim()
      .toLowerCase();

    if (
      estadoNormalizado &&
      estadoNormalizado !== "activo" &&
      estadoNormalizado !== "1" &&
      estadoNormalizado !== "true"
    ) {
      throw new Error("El usuario se encuentra inactivo");
    }

    return {
      exito: true,
      mensaje: "Inicio de sesión exitoso",
      usuario: this.limpiarDatosSensibles(usuario),
    };
  }

  async listarUsuarios() {
    const rows = await this.repo.listar();
    if (!Array.isArray(rows)) return rows;
    return rows.map((item) =>
      item && typeof item === "object"
        ? this.limpiarDatosSensibles(item as RegistroUsuario)
        : item
    );
  }

  async obtenerUsuario(id: number) {
    const rawUsuario = (await this.repo.buscarPorId(id)) as
      | RegistroUsuario
      | RegistroUsuario[]
      | null
      | undefined;
    const usuario = Array.isArray(rawUsuario) ? rawUsuario[0] : rawUsuario;

    if (!usuario || typeof usuario !== "object") {
      throw new Error("Usuario no encontrado");
    }

    return this.limpiarDatosSensibles(usuario);
  }

  async crearUsuario(datos: unknown) {
    const payload = (datos ?? {}) as Record<string, unknown>;
    const codigo_empleado = String(
      payload.codigo_empleado ?? payload.codigoEmpleado ?? ""
    ).trim();
    const clave = String(
      payload.password ?? payload.password_hash ?? payload.contrasena ?? payload.clave ?? ""
    );

    if (!codigo_empleado || !clave) {
      throw new Error("Faltan campos obligatorios: codigo_empleado y password");
    }

    const existente = await this.repo.buscarPorCodigo(codigo_empleado);
    if (existente) {
      throw new Error("Ya existe un usuario con ese código de empleado");
    }

    return await this.repo.crear({
      ...payload,
      codigo_empleado,
      contrasena: clave,
      password_hash: clave,
    });
  }

  async actualizarUsuario(id: number, datos: unknown) {
    const existente = await this.repo.buscarPorId(id);
    if (!existente) {
      throw new Error("Usuario no encontrado");
    }

    const payload = (datos ?? {}) as Record<string, unknown>;
    if (payload.codigo_empleado !== undefined) {
      const nuevoCodigo = String(payload.codigo_empleado).trim();
      if (nuevoCodigo) {
        const rawOtro = (await this.repo.buscarPorCodigo(nuevoCodigo)) as
          | RegistroUsuario
          | RegistroUsuario[]
          | null
          | undefined;
        const otroConCodigo = Array.isArray(rawOtro) ? rawOtro[0] : rawOtro;
        if (otroConCodigo && Number(otroConCodigo.id) !== id) {
          throw new Error("El código de empleado ya está en uso");
        }
      }
    }

    return await this.repo.actualizar(id, payload);
  }

  async eliminarUsuario(id: number) {
    const existente = await this.repo.buscarPorId(id);
    if (!existente) {
      throw new Error("Usuario no encontrado");
    }

    await this.repo.eliminar(id);
    return { mensaje: "Usuario eliminado correctamente" };
  }
}