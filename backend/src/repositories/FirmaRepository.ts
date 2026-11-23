import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.ts";

export interface FirmaSolicitud extends RowDataPacket {
  id: number;
  solicitud_id: number;
  tipo_solicitud: string;
  rol_firmante: "EMPLEADO" | "JEFE_INMEDIATO" | "GESTION_HUMANA";
  firmante_referencia: string | null;
  firma_texto: string | null;
  firma_base64: string | null;
  hash_documento: string;
  firmada_en: string;
}

export interface CrearFirmaInput {
  solicitudId: number;
  tipoSolicitud?: "VACACIONES" | "AUSENCIA";
  rolFirmante: "EMPLEADO" | "JEFE_INMEDIATO" | "GESTION_HUMANA";
  firmanteReferencia?: string | null;
  firmaTexto?: string | null;
  firmaBase64?: string | null;
  hashDocumento: string;
}

export class FirmaRepository {
  async crear(input: CrearFirmaInput): Promise<number> {
    const sql = `
      INSERT INTO firmas_solicitudes (
        solicitud_id,
        tipo_solicitud,
        rol_firmante,
        firmante_referencia,
        firma_texto,
        firma_base64,
        hash_documento
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query<ResultSetHeader>(sql, [
      input.solicitudId,
      input.tipoSolicitud ?? "VACACIONES",
      input.rolFirmante,
      input.firmanteReferencia ?? null,
      input.firmaTexto ?? null,
      input.firmaBase64 ?? null,
      input.hashDocumento,
    ]);

    return result.insertId;
  }

  async listarPorSolicitud(
    solicitudId: number,
    tipoSolicitud = "VACACIONES"
  ): Promise<FirmaSolicitud[]> {
    const sql = `
      SELECT *
      FROM firmas_solicitudes
      WHERE solicitud_id = ? AND tipo_solicitud = ?
      ORDER BY id ASC
    `;
    const [rows] = await pool.query<FirmaSolicitud[]>(sql, [
      solicitudId,
      tipoSolicitud,
    ]);
    return rows;
  }
}