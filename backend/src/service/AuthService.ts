import { UsuarioRepository } from "../repositories/UsuarioRepository.ts";

export interface RegistroUsuarioInput {
  codigo_empleado: number;
  contrasena: string;
  [key: string]: unknown;
}

export class AuthService {
  private repo = new UsuarioRepository();

  async login(codigo_empleado: number, contrasena: string) {
    const usuario = await this.repo.BuscarPorCodigo(codigo_empleado);

    if (!usuario) {
      return { exito: false, mensaje: "Usuario no encontrado" };
    }

    // Si más adelante usas bcrypt, cambia esta línea por: await bcrypt.compare(contrasena, usuario.contrasena)
    if (usuario.contrasena !== contrasena) {
      return { exito: false, mensaje: "Contraseña incorrecta" };
    }

    if (usuario.estado_cuenta !== "activo") {
      return { exito: false, mensaje: "Cuenta no activa" };
    }

    const { contrasena: _, ...usuarioSinPassword } = usuario;
    return { exito: true, usuario: usuarioSinPassword };
  }

  async registro(datos: RegistroUsuarioInput) {
    // 1. Verificar si el código de empleado ya está registrado
    const usuarioExistente = await this.repo.BuscarPorCodigo(datos.codigo_empleado);

    if (usuarioExistente) {
      return { exito: false, mensaje: "El código de empleado ya está registrado" };
    }

    // 2. Crear el nuevo usuario
    try {
      const idUsuario = await this.repo.crear(datos);
      return {
        exito: true,
        mensaje: "Usuario registrado exitosamente",
        empleado_id: idUsuario,
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