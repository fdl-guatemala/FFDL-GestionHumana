import type { Request, Response } from "express";
import { UsuarioService } from "../service/UsuarioService.ts";

export class UsuarioController {
  private readonly usuarioService: UsuarioService;

  constructor(usuarioService = new UsuarioService()) {
    this.usuarioService = usuarioService;
  }

  private extraerCredenciales(body: Record<string, unknown>): {
    codigo: string;
    clave: string;
  } {
    const origen =
      body.datos && typeof body.datos === "object"
        ? (body.datos as Record<string, unknown>)
        : body.usuario && typeof body.usuario === "object"
          ? (body.usuario as Record<string, unknown>)
          : body;

    const rawCodigo =
      origen.codigo_empleado ??
      origen.codigoEmpleado ??
      origen.codigo ??
      origen.usuario ??
      origen.correo ??
      body.codigo_empleado ??
      body.codigoEmpleado ??
      body.codigo ??
      "";

    const rawClave =
      origen.password ??
      origen.password_hash ??
      origen.passwordHash ??
      origen.contrasena ??
      origen.contraseña ??
      origen.clave ??
      body.password ??
      body.password_hash ??
      body.contrasena ??
      body.clave ??
      "";

    const codigo =
      typeof rawCodigo === "string" || typeof rawCodigo === "number"
        ? String(rawCodigo).trim()
        : "";
    const clave =
      typeof rawClave === "string" || typeof rawClave === "number"
        ? String(rawClave)
        : "";

    return { codigo, clave };
  }

  private resolverStatusLogin(mensaje: string): number {
    const normalizado = mensaje.toLowerCase();
    if (
      normalizado.includes("credenciales inválidas") ||
      normalizado.includes("credenciales invalidas") ||
      normalizado.includes("contraseña incorrecta") ||
      normalizado.includes("contrasena incorrecta") ||
      normalizado.includes("usuario no encontrado") ||
      normalizado.includes("inactivo") ||
      normalizado.includes("bloqueado")
    ) {
      return 401;
    }
    return 500;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { codigo, clave } = this.extraerCredenciales(body);

      if (!codigo || !clave) {
        res.status(400).json({
          message: "Debes enviar codigo_empleado y password",
        });
        return;
      }

      const resultado = await this.usuarioService.login(codigo, clave);
      res.status(200).json(resultado);
    } catch (error) {
      console.error("[UsuarioController.login]", error);
      const mensaje =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Error al iniciar sesión";
      const status = this.resolverStatusLogin(mensaje);
      res.status(status).json({ message: mensaje });
    }
  };

  listar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const usuarios = await this.usuarioService.listarUsuarios();
      res.status(200).json(usuarios);
    } catch (error) {
      console.error("[UsuarioController.listar]", error);
      const mensaje =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Error al obtener usuarios";
      res.status(500).json({ message: mensaje });
    }
  };

  obtenerPorId = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de usuario inválido" });
        return;
      }

      const usuario = await this.usuarioService.obtenerUsuario(id);
      res.status(200).json(usuario);
    } catch (error) {
      console.error("[UsuarioController.obtenerPorId]", error);
      const mensaje =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Error al buscar usuario";
      const status = mensaje === "Usuario no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  crear = async (req: Request, res: Response): Promise<void> => {
    try {
      const creado = await this.usuarioService.crearUsuario(req.body);
      res.status(201).json(creado);
    } catch (error) {
      console.error("[UsuarioController.crear]", error);
      const mensaje =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Error al crear usuario";
      const normalizado = mensaje.toLowerCase();
      const status =
        normalizado.includes("faltan campos") ||
        normalizado.includes("ya existe") ||
        normalizado.includes("inválido") ||
        normalizado.includes("invalido")
          ? 400
          : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  actualizar = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de usuario inválido" });
        return;
      }

      const actualizado = await this.usuarioService.actualizarUsuario(
        id,
        req.body
      );
      res.status(200).json(actualizado);
    } catch (error) {
      console.error("[UsuarioController.actualizar]", error);
      const mensaje =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Error al actualizar usuario";
      const normalizado = mensaje.toLowerCase();
      let status = 500;
      if (mensaje === "Usuario no encontrado") status = 404;
      else if (
        normalizado.includes("ya está en uso") ||
        normalizado.includes("ya esta en uso") ||
        normalizado.includes("inválido") ||
        normalizado.includes("invalido")
      ) {
        status = 400;
      }
      res.status(status).json({ message: mensaje });
    }
  };

  eliminar = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de usuario inválido" });
        return;
      }

      const resultado = await this.usuarioService.eliminarUsuario(id);
      res.status(200).json(resultado);
    } catch (error) {
      console.error("[UsuarioController.eliminar]", error);
      const mensaje =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Error al eliminar usuario";
      const status = mensaje === "Usuario no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };
}