import { pool } from "../config/database.ts";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type RolNotificacion =
  | "jefe_inmediato"
  | "gestion_humana"
  | "gerente_general"
  | "empleado";

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
  private normalizarTexto(valor: unknown): string {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  async crearNotificacionesParaSolicitud(
    input: CrearNotificacionesSolicitudInput
  ) {
    const codigoSol = String(input.codigo_solicitante ?? "").trim();
    const nombreSol = String(input.nombre_solicitante ?? "").trim();
    const sucursal = String(input.sucursal ?? "").trim();
    const cargo = String(input.cargo ?? "").trim();
    const resumen = input.detalle_resumen ? ` (${input.detalle_resumen})` : "";

    let jefeCodigo = String(input.codigo_jefe_inmediato ?? "").trim();
    let jefeNombre = String(input.nombre_jefe_inmediato ?? "").trim();

    if (!jefeCodigo || !jefeNombre) {
      const [empRows] = await pool.query<RowDataPacket[]>(
        `SELECT jefe_inmediato FROM empleados WHERE codigo_empleado = ? LIMIT 1`,
        [codigoSol]
      );
      const jefeRaw = String(empRows?.[0]?.jefe_inmediato ?? "").trim();
      if (jefeRaw) {
        const [jefeRows] = await pool.query<RowDataPacket[]>(
          `SELECT codigo_empleado, nombre_completo
           FROM empleados
           WHERE codigo_empleado = ? OR LOWER(TRIM(nombre_completo)) LIKE LOWER(?)
           LIMIT 1`,
          [jefeRaw, `%${jefeRaw.toLowerCase()}%`]
        );
        if (jefeRows?.[0]) {
          jefeCodigo =
            jefeCodigo || String(jefeRows[0].codigo_empleado ?? "").trim();
          jefeNombre =
            jefeNombre || String(jefeRows[0].nombre_completo ?? "").trim();
        } else if (!jefeCodigo) {
          jefeCodigo = jefeRaw;
        }
      }
    }

    const titulo = `Nueva solicitud de vacaciones - ${nombreSol}`;
    const mensajeBase = `${nombreSol} (${codigoSol})${
      cargo ? ` - ${cargo}` : ""
    }${sucursal ? ` en ${sucursal}` : ""}${resumen} ha enviado una solicitud pendiente de aprobación del Jefe Inmediato.`;

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
      ) VALUES (?, ?, ?, ?, ?, 'jefe_inmediato', ?, ?, ?, ?, 'pendiente', 0)`,
      [
        input.solicitud_id ?? null,
        codigoSol,
        nombreSol,
        sucursal || null,
        cargo || null,
        jefeNombre || "Jefe Inmediato",
        jefeCodigo || null,
        titulo,
        mensajeBase,
      ]
    );

    return [result.insertId];
  }

  async listarNotificaciones(filtros?: {
    destinatario_tipo?: string;
    destinatario_codigo?: string;
    destinatario_nombre?: string;
    solo_pendientes?: boolean;
  }) {
    const tipo = this.normalizarTexto(filtros?.destinatario_tipo);
    const filtroRefRaw = String(
      filtros?.destinatario_codigo ?? filtros?.destinatario_nombre ?? ""
    ).trim();
    const filtroRefNorm = this.normalizarTexto(filtroRefRaw);

    const condiciones: string[] = [];
    const params: unknown[] = [];

    if (tipo === "jefe_inmediato" || tipo === "jefe inmediato" || tipo === "jefe") {
      condiciones.push("destinatario_tipo = 'jefe_inmediato'");
    } else if (
      tipo === "gestion_humana" ||
      tipo === "gestion humana" ||
      tipo === "gh" ||
      tipo === "rrhh"
    ) {
      condiciones.push("destinatario_tipo = 'gestion_humana'");
    } else if (tipo === "empleado") {
      condiciones.push("destinatario_tipo = 'empleado'");
    } else if (tipo) {
      condiciones.push("destinatario_tipo = ?");
      params.push(tipo);
    }

    if (filtros?.solo_pendientes) {
      condiciones.push("estado_aprobacion = 'pendiente'");
    }

    const where =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM notificaciones_ausencias
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      params
    );

    if (
      (tipo === "jefe_inmediato" ||
        tipo === "jefe inmediato" ||
        tipo === "jefe" ||
        tipo === "empleado") &&
      filtroRefNorm
    ) {
      return rows.filter((row) => {
        const codNorm = this.normalizarTexto(row.destinatario_codigo);
        const nomNorm = this.normalizarTexto(row.destinatario_nombre);

        if (!codNorm && !nomNorm) {
          return tipo === "jefe_inmediato";
        }

        return (
          (codNorm && codNorm === filtroRefNorm) ||
          (nomNorm &&
            (nomNorm === filtroRefNorm ||
              nomNorm.includes(filtroRefNorm) ||
              filtroRefNorm.includes(nomNorm)))
        );
      });
    }

    return rows;
  }

  async resolverNotificacion(id: number, accion: "aprobado" | "rechazado") {
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
    const actual = rows[0] ?? null;

    if (actual?.codigo_solicitante) {
      const estadoTexto = accion === "aprobado" ? "ACEPTADA" : "RECHAZADA";
      await pool.query<ResultSetHeader>(
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
          leida,
          fecha_resolucion
        ) VALUES (?, ?, ?, ?, ?, 'empleado', ?, ?, ?, ?, ?, 0, NOW())`,
        [
          actual.solicitud_id ?? null,
          actual.codigo_solicitante,
          actual.nombre_solicitante,
          actual.sucursal ?? null,
          actual.cargo ?? null,
          actual.nombre_solicitante,
          actual.codigo_solicitante,
          `Solicitud ${estadoTexto}`,
          `Tu solicitud de ausencia/vacaciones fue ${estadoTexto.toLowerCase()}.`,
          accion,
        ]
      );
    }

    return actual;
  }

  async marcarComoLeida(id: number) {
    await pool.query<ResultSetHeader>(
      `UPDATE notificaciones_ausencias SET leida = 1 WHERE id = ?`,
      [id]
    );
    return { leida: true };
  }
}