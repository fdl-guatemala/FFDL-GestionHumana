import crypto from "node:crypto";

export interface DatosFirmaHash {
  solicitudId: number | string;
  tipoSolicitud: "VACACIONES" | "AUSENCIA";
  rolFirmante: "EMPLEADO" | "JEFE_INMEDIATO" | "GESTION_HUMANA";
  firmanteReferencia: string;
  fechaHoraIso: string;
  resumenDatos: string;
}

export function generarHashFirma(datos: DatosFirmaHash): string {
  const payload = JSON.stringify(datos);
  return crypto.createHash("sha256").update(payload).digest("hex");
}