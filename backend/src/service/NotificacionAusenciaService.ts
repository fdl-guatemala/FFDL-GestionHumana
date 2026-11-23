import { pool } from "../config/database.ts";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type RolNotificacion = "jefe_inmediato" | "gestion_humana" | "gerente_general";

export interface CrearNotificacionesSolicitudInput {
  solicitud_id?: number | null;
  codigo_solicitante: string;
  nombre_solicitante: string;
  sucursal?: string;
  cargo?: string;
  nombre_jefe_inmediato?: string;
  codigo_jefe_inmediato?: string;
  nombre_gerente_general?: string;
  codigo_gerente_general?: string;
  detalle_resumen?: string;
}

export class NotificacionAusenciaService {
  async crearNotificacionesParaSolicitud(input: CrearNotificacionesSolicitudInput) {
    const sucursal = String(input.sucursal ?? "").trim();
    const cargo = String(input.cargo ?? "").trim();
    const resumen = input.detalle_resumen ? ` (${input.detalle_resumen})` : "";

    const titulo = `Nueva solicitud de ausencia - ${input.nombre_solicitante}`;
    const mensajeBase = `${input.nombre_solicitante} (${input.codigo_solicitante})${
      cargo ? ` - ${cargo}` : ""
    }${sucursal ? ` en ${sucursal}` : ""}${resumen} ha enviado una solicitud de ausencia pendiente de aprobación.`;

    const destinatarios: Array<{
      tipo: RolNotificacion;
      nombre: string | null;
      codigo: string | null;
    }> = [
      {
        tipo: "jefe_inmediato",
        nombre: String(input.nombre_jefe_inmediato ?? "").trim() || "Jefe Inmediato",
        codigo: String(input.codigo_jefe_inmediato ?? "").trim() || null,
      },
      {
        tipo: "gestion_humana",
        nombre: "Gestión Humana",
        codigo: null,
      },
      {
        tipo: "gerente_general",
        nombre: String(input.nombre_gerente_general ?? "").trim() || "Gerente General",
        codigo: String(input.codigo_gerente_general ?? "").trim() || null,
      },
    ];

    const insertadas: number[] = [];

    for (const dest of destinatarios) {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO notificaciones_ausencias (
          solicitud_id,
          codigo_solicitante,
          nombre_solicitante,
          sucursal,
          cargo,
          destinatario_tipo,
          destinatario_nombre,
          destinatario_codigo,
          titulo,
          mensaje,
          estado_aprobacion,
          leida
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 0)`,
        [
          input.solicitud_id ?? null,
          input.codigo_solicitante,
          input.nombre_solicitante,
          sucursal || null,
          cargo || null,
          dest.tipo,
          dest.nombre,
          dest.codigo,
          titulo,
          mensajeBase,
        ]
      );
      insertadas.push(result.insertId);
    }

    return insertadas;
  }

  async listarNotificaciones(filtros?: {
    destinatario_tipo?: string;
    destinatario_codigo?: string;
    solo_pendientes?: boolean;
  }) {
    const condiciones: string[] = [];
    const params: unknown[] = [];

    if (filtros?.destinatario_tipo) {
      condiciones.push("destinatario_tipo = ?");
      params.push(filtros.destinatario_tipo);
    }

    if (filtros?.destinatario_codigo) {
      condiciones.push("destinatario_codigo = ?");
      params.push(filtros.destinatario_codigo);
    }

    if (filtros?.solo_pendientes) {
      condiciones.push("estado_aprobacion = 'pendiente'");
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM notificaciones_ausencias
       ${where}
       ORDER BY created_at DESC, id DESC`,
      params
    );

    return rows;
  }

  async resolverNotificacion(
    id: number,
    accion: "aprobado" | "rechazado"
  ) {
    await pool.query<ResultSetHeader>(
      `UPDATE notificaciones_ausencias
       SET estado_aprobacion = ?, leida = 1, fecha_resolucion = NOW()
       WHERE id = ?`,
      [accion, id]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM notificaciones_ausencias WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ?? null;
  }
}