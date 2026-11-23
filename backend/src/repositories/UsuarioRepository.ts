import { pool } from "../config/database.ts";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export class UsuarioRepository {
  async buscarPorCodigo(codigo_empleado: string | number) {
    const codigoLimpio = String(codigo_empleado).trim();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         e.nombre_completo,
         e.puesto,
         e.lugar,
         e.lugar AS sucursal
       FROM usuarios u
       LEFT JOIN empleados e
         ON e.id = u.empleado_id OR TRIM(CAST(e.codigo_empleado AS CHAR)) = TRIM(CAST(u.codigo_empleado AS CHAR))
       WHERE TRIM(CAST(u.codigo_empleado AS CHAR)) = ?
          OR TRIM(CAST(e.codigo_empleado AS CHAR)) = ?
       LIMIT 1`,
      [codigoLimpio, codigoLimpio]
    );
    return rows[0] ?? null;
  }

  async buscarPorId(id: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         e.nombre_completo,
         e.puesto,
         e.lugar,
         e.lugar AS sucursal
       FROM usuarios u
       LEFT JOIN empleados e
         ON e.id = u.empleado_id OR e.codigo_empleado = u.codigo_empleado
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async listar() {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.*,
         e.nombre_completo,
         e.puesto,
         e.lugar,
         e.lugar AS sucursal
       FROM usuarios u
       LEFT JOIN empleados e
         ON e.id = u.empleado_id OR e.codigo_empleado = u.codigo_empleado`
    );
    return rows;
  }

  async crear(datos: Record<string, unknown>) {
    const codigo = String(datos.codigo_empleado ?? "").trim();
    const clave = String(datos.password_hash ?? datos.contrasena ?? "");
    const estado = String(datos.estado_cuenta ?? "activo");

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO usuarios (codigo_empleado, contrasena, estado_cuenta) VALUES (?, ?, ?)",
      [codigo, clave, estado]
    );
    return { id: result.insertId, codigo_empleado: codigo, estado_cuenta: estado };
  }

  async actualizar(id: number, datos: Record<string, unknown>) {
    const actual = await this.buscarPorId(id);
    if (!actual) return null;

    const codigo =
      datos.codigo_empleado !== undefined
        ? String(datos.codigo_empleado).trim()
        : actual.codigo_empleado;
    const clave =
      datos.password !== undefined ||
      datos.password_hash !== undefined ||
      datos.contrasena !== undefined
        ? String(datos.password ?? datos.password_hash ?? datos.contrasena)
        : (actual.contrasena ?? actual.password_hash);
    const estado =
      datos.estado_cuenta !== undefined
        ? String(datos.estado_cuenta)
        : actual.estado_cuenta;

    await pool.query<ResultSetHeader>(
      "UPDATE usuarios SET codigo_empleado = ?, contrasena = ?, estado_cuenta = ? WHERE id = ?",
      [codigo, clave, estado, id]
    );

    return await this.buscarPorId(id);
  }

  async eliminar(id: number) {
    await pool.query<ResultSetHeader>("DELETE FROM usuarios WHERE id = ?", [id]);
  }
}