import type { Request, Response } from "express";
import { RegistroVacacionesService } from "../service/RegistroVacacionesService.ts";
import { NotificacionAusenciaService } from "../service/NotificacionAusenciaService.ts";

export class SolicitudController {
  private readonly registroService: RegistroVacacionesService;
  private readonly notificacionService: NotificacionAusenciaService;

  constructor(
    registroService = new RegistroVacacionesService(),
    notificacionService = new NotificacionAusenciaService()
  ) {
    this.registroService = registroService;
    this.notificacionService = notificacionService;
  }

  private extraerNumeroPositivo(valor: unknown): number {
    if (typeof valor === "number") {
      return Number.isFinite(valor) && valor > 0 ? valor : 0;
    }

    if (typeof valor === "string") {
      const limpio = valor.trim().replace(",", ".");
      if (!limpio) return 0;

      const directo = Number(limpio);
      if (Number.isFinite(directo) && directo > 0) return directo;

      const match = limpio.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const num = Number(match[1]);
        if (Number.isFinite(num) && num > 0) return num;
      }
    }

    return 0;
  }

  private extraerDiasTomados(raw: Record<string, any>): number {
    const candidatos = [
      raw.dias_tomados,
      raw.diasTomados,
      raw.dias,
      raw.total_dias,
      raw.totalDias,
      raw.dias_solicitados,
      raw.diasSolicitados,
      raw.cantidad_dias,
      raw.cantidadDias,
      raw.horas_solicitadas,
      raw.numero_dias_horas,
    ];

    for (const c of candidatos) {
      const n = this.extraerNumeroPositivo(c);
      if (n > 0) return n;
    }

    const listas = [
      raw.detalle_ausencias,
      raw.detalleAusencias,
      raw.ausencias,
      raw.dias_detalle,
      raw.detalle,
      raw.filas,
    ];

    for (const lista of listas) {
      if (Array.isArray(lista) && lista.length > 0) {
        const suma = lista.reduce((acc: number, item: any) => {
          if (typeof item === "number") {
            return Number.isFinite(item) && item > 0 ? acc + item : acc;
          }
          if (typeof item === "string") {
            const n = this.extraerNumeroPositivo(item);
            return acc + (n > 0 ? n : 1);
          }
          if (item && typeof item === "object") {
            const rawDiasItem =
              item.dias_tomados ??
              item.diasTomados ??
              item.dias ??
              item.cantidad ??
              item.total_dias ??
              item.horas ??
              item.dias_horas_solicitadas ??
              item.numero_dias_horas ??
              1;
            const diasItem = this.extraerNumeroPositivo(rawDiasItem);
            return acc + (diasItem > 0 ? diasItem : 1);
          }
          return acc + 1;
        }, 0);

        if (suma > 0) return suma;
      }
    }

    return 0;
  }

  private obtenerFechaDisfrute(raw: Record<string, any>): string {
    const candidatos = [
      raw.fecha_disfrute,
      raw.fechaDisfrute,
      raw.fecha_ausencia,
      raw.fechaAusencia,
      raw.fecha_inicio,
      raw.fechaInicio,
    ];

    for (const c of candidatos) {
      if (typeof c === "string" && c.trim()) {
        return c.trim();
      }
    }

    const listas = [raw.detalle_ausencias, raw.detalleAusencias, raw.ausencias];
    for (const lista of listas) {
      if (
        Array.isArray(lista) &&
        lista.length > 0 &&
        lista[0] &&
        typeof lista[0] === "object"
      ) {
        const fila = lista[0];
        const f =
          fila.fecha_ausencia ??
          fila.fecha_disfrute ??
          fila.fechaAusencia ??
          fila.fecha ??
          "";
        if (String(f).trim()) {
          return String(f).trim();
        }
      }
    }

    return typeof raw.fecha_solicitud === "string"
      ? raw.fecha_solicitud.trim()
      : "";
  }

  private normalizarPayload(body: any): Record<string, any> {
    const raw = body && typeof body === "object" ? { ...body } : {};

    const diasTomados = this.extraerDiasTomados(raw);
    if (diasTomados > 0) {
      raw.dias_tomados = diasTomados;
      if (raw.dias === undefined || raw.dias === null || raw.dias === "") {
        raw.dias = diasTomados;
      }
    }

    const fechaDisfrute = this.obtenerFechaDisfrute(raw);
    if (fechaDisfrute && !raw.fecha_disfrute) {
      raw.fecha_disfrute = fechaDisfrute;
    }

    const empId = Number(raw.empleado_id ?? raw.empleadoId ?? 0);
    if (Number.isFinite(empId) && empId > 0) {
      raw.empleado_id = empId;
    }

    const perId = Number(raw.periodo_id ?? raw.periodoId ?? 0);
    if (Number.isFinite(perId) && perId > 0) {
      raw.periodo_id = perId;
    }

    return raw;
  }

  crear = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = this.normalizarPayload(req.body);
      const creado = await this.registroService.crearRegistro(payload as any);

      try {
        const fuente = {
          ...(creado?.registro ?? {}),
          ...(creado ?? {}),
          ...(payload ?? {}),
        };

        const solicitudId =
          Number(
            creado?.id ??
              creado?.insertId ??
              creado?.registro?.id ??
              fuente?.solicitud_id ??
              0
          ) || null;

        const empleadoId =
          Number(fuente?.empleado_id ?? fuente?.empleadoId ?? 0) || null;

        const codigoSolicitante = String(
          fuente?.codigo_solicitante ??
            fuente?.codigo_empleado ??
            fuente?.empleado_codigo ??
            fuente?.codigo ??
            (empleadoId ? String(empleadoId) : "")
        ).trim();

        const nombreSolicitante = String(
          fuente?.nombre_solicitante ??
            fuente?.nombre_colaborador ??
            fuente?.nombre_empleado ??
            fuente?.empleado_nombre ??
            fuente?.nombre_completo ??
            "Colaborador"
        ).trim();

        if (codigoSolicitante || empleadoId) {
          await this.notificacionService.crearNotificacionesParaSolicitud({
            solicitud_id: solicitudId,
            codigo_solicitante: codigoSolicitante || String(empleadoId),
            nombre_solicitante: nombreSolicitante,
            sucursal: String(fuente?.sucursal ?? "").trim(),
            cargo: String(fuente?.cargo ?? "").trim(),
            codigo_jefe_inmediato:
              fuente?.codigo_jefe_inmediato ?? fuente?.jefe_codigo,
            nombre_jefe_inmediato:
              fuente?.nombre_jefe_inmediato ?? fuente?.jefe_inmediato,
          });
        }
      } catch (notifErr) {
        console.error("[SolicitudController notificacion]:", notifErr);
      }

      res.status(201).json(creado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al procesar la solicitud";
      let status = 500;
      if (mensaje === "Periodo de vacaciones no encontrado") status = 404;
      else if (
        mensaje.includes("Faltan campos") ||
        mensaje.includes("dias_tomados") ||
        mensaje.includes("no pertenece") ||
        mensaje.includes("Días insuficientes")
      ) {
        status = 400;
      }
      res.status(status).json({ message: mensaje });
    }
  };

  listar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const registros = await this.registroService.listarRegistros();
      res.status(200).json(registros);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al listar solicitudes";
      res.status(500).json({ message: mensaje });
    }
  };
}