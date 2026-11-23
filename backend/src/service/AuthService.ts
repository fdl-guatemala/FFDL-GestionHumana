import { UsuarioRepository } from "../repositories/UsuarioRepository.ts";

export interface RegistroUsuarioInput {
  codigo_empleado: string | number;
  contrasena: string;
  [key: string]: unknown;
}

export class AuthService {
  private repo = new UsuarioRepository();

  async login(codigo_empleado: string | number, contrasena: string) {
    const usuario = await this.repo.buscarPorCodigo(codigo_empleado);

    if (!usuario) {
      return { exito: false, mensaje: "Usuario no encontrado" };
    }

    const passwordGuardada = usuario.contrasena ?? usuario.password_hash;
    if (passwordGuardada !== contrasena) {
      return { exito: false, mensaje: "Contraseña incorrecta" };
    }

    const estadoNormalizado = String(usuario.estado_cuenta ?? "")
      .trim()
      .toLowerCase();

    if (estadoNormalizado !== "activo") {
      return { exito: false, mensaje: "Cuenta no activa" };
    }

    const { contrasena: _, password_hash: __, ...usuarioSinPassword } = usuario;

    return {
      exito: true,
      usuario: {
        ...usuarioSinPassword,
        activo: true,
      },
    };
  }

  async registro(datos: RegistroUsuarioInput) {
    const usuarioExistente = await this.repo.buscarPorCodigo(datos.codigo_empleado);

    if (usuarioExistente) {
      return { exito: false, mensaje: "El código de empleado ya está registrado" };
    }

    try {
      const creado = await this.repo.crear(datos);
      return {
        exito: true,
        mensaje: "Usuario registrado exitosamente",
        empleado_id: creado.id,
      };
    } catch (error) {
      console.error("Error en el servicio de registro:", error);
      return {
        exito: false,
        mensaje: "Error al registrar el usuario en la base de datos",
      };
    }
  }
}