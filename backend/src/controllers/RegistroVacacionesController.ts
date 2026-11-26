import type { Request, Response } from "express";
import { RegistroVacacionesService } from "../service/RegistroVacacionesService.ts";
import { NotificacionAusenciaService } from "../service/NotificacionAusenciaService.ts";

export class RegistroVacacionesController {
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
      if (Number.isFinite(directo) && directo > 0) {
        return directo;
      }

      const match = limpio.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const extraido = Number(match[1]);
        if (Number.isFinite(extraido) && extraido > 0) {
          return extraido;
        }
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

    for (const candidato of candidatos) {
      const num = this.extraerNumeroPositivo(candidato);
      if (num > 0) {
        return num;
      }
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

        if (suma > 0) {
          return suma;
        }
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

    // Nunca permitir que al crear llegue preaprobada desde el cliente
    delete raw.estado;
    delete raw.estado_aprobacion;
    delete raw.aprobado_por;
    delete raw.firma_jefe_inmediato;
    delete raw.firma_gh;
    delete raw.firma_gestion_humana;

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

    if (!raw.fecha_inicio && raw.fechaInicio) {
      raw.fecha_inicio = raw.fechaInicio;
    }

    if (!raw.fecha_fin && raw.fechaFin) {
      raw.fecha_fin = raw.fechaFin;
    }

    if (!raw.codigo_empleado && raw.codigoEmpleado) {
      raw.codigo_empleado = raw.codigoEmpleado;
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

  private extraerDatosSolicitante(reqBody: any, creado: any) {
    const fuente = {
      ...(creado?.registro ?? {}),
      ...(creado ?? {}),
      ...(reqBody ?? {}),
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

    const sucursal = String(
      fuente?.sucursal ?? fuente?.lugar ?? fuente?.sede ?? ""
    ).trim();

    const cargo = String(
      fuente?.cargo ?? fuente?.puesto ?? fuente?.rol ?? ""
    ).trim();

    const fechaInicio = this.obtenerFechaDisfrute(fuente);

    const fechaFin = String(fuente?.fecha_fin ?? fuente?.fechaFin ?? "").trim();

    const diasTomados =
      fuente?.dias_tomados ?? fuente?.diasTomados ?? fuente?.dias ?? "";

    const partesResumen: string[] = [];
    if (fechaInicio && fechaFin) {
      partesResumen.push(`${fechaInicio} al ${fechaFin}`);
    } else if (fechaInicio) {
      partesResumen.push(`desde ${fechaInicio}`);
    }
    if (diasTomados !== "") {
      partesResumen.push(`${diasTomados} día(s)`);
    }

    return {
      solicitudId,
      empleadoId,
      codigoSolicitante,
      nombreSolicitante,
      sucursal,
      cargo,
      codigoJefe: fuente?.codigo_jefe_inmediato ?? fuente?.jefe_codigo,
      nombreJefe: fuente?.nombre_jefe_inmediato ?? fuente?.jefe_inmediato,
      detalleResumen: partesResumen.join(" · ") || undefined,
    };
  }

  private extraerEstadoResolucion(
    reqBody: any,
    resultado: any
  ): "aprobado" | "rechazado" {
    const raw = String(
      reqBody?.estado ??
        reqBody?.accion ??
        reqBody?.estado_aprobacion ??
        resultado?.estado ??
        resultado?.estado_aprobacion ??
        "aprobado"
    )
      .trim()
      .toLowerCase();

    return raw === "rechazado" || raw === "rechazar" ? "rechazado" : "aprobado";
  }

  listar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const registros = await this.registroService.listarRegistros();
      res.status(200).json(registros);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al obtener registros de vacaciones";
      res.status(500).json({ message: mensaje });
    }
  };

  obtenerPorId = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const registro = await this.registroService.obtenerRegistro(id);
      res.status(200).json(registro);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al buscar registro de vacaciones";
      const status =
        mensaje === "Registro de vacaciones no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  listarPorEmpleado = async (req: Request, res: Response): Promise<void> => {
    try {
      const empleadoId = Number(req.params.empleadoId);
      if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
        res.status(400).json({ message: "ID de empleado inválido" });
        return;
      }

      const registros = await this.registroService.listarPorEmpleado(empleadoId);
      res.status(200).json(registros);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al obtener vacaciones del empleado";
      res.status(500).json({ message: mensaje });
    }
  };

  crear = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = this.normalizarPayload(req.body);
      const creado = await this.registroService.crearRegistro(payload as any);

      try {
        const datos = this.extraerDatosSolicitante(payload, creado);
        if (datos.codigoSolicitante || datos.empleadoId) {
          await this.notificacionService.crearNotificacionesParaSolicitud({
            solicitud_id: datos.solicitudId,
            codigo_solicitante:
              datos.codigoSolicitante || String(datos.empleadoId),
            nombre_solicitante: datos.nombreSolicitante,
            sucursal: datos.sucursal,
            cargo: datos.cargo,
            codigo_jefe_inmediato: datos.codigoJefe,
            nombre_jefe_inmediato: datos.nombreJefe,
            detalle_resumen: datos.detalleResumen,
          });
        }
      } catch (notifError) {
        console.error(
          "[Notificacion al crear solicitud de vacaciones]:",
          notifError
        );
      }

      res.status(201).json(creado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al crear registro de vacaciones";
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

  actualizar = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const payload = this.normalizarPayload(req.body);
      const serviceAny = this.registroService as any;
      const actualizado =
        typeof serviceAny.actualizarRegistro === "function"
          ? await serviceAny.actualizarRegistro(id, payload)
          : await serviceAny.actualizar(id, payload);
      res.status(200).json(actualizado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al actualizar registro de vacaciones";
      let status = 500;
      if (
        mensaje === "Registro de vacaciones no encontrado" ||
        mensaje === "Periodo de vacaciones no encontrado"
      ) {
        status = 404;
      } else if (
        mensaje.includes("dias_tomados") ||
        mensaje.includes("no pertenece") ||
        mensaje.includes("Días insuficientes")
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
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const serviceAny = this.registroService as any;
      const resultado =
        typeof serviceAny.eliminarRegistro === "function"
          ? await serviceAny.eliminarRegistro(id)
          : await serviceAny.eliminar(id);
      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al eliminar registro de vacaciones";
      const status =
        mensaje === "Registro de vacaciones no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  aprobarPorJefe = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const resultado = await this.registroService.aprobarPorJefe(id, req.body);

      try {
        const notificacionId = Number(
          req.body?.notificacion_id ?? req.body?.notificacionId ?? 0
        );
        const accion = this.extraerEstadoResolucion(req.body, resultado);
        if (notificacionId > 0) {
          await this.notificacionService.resolverNotificacion(
            notificacionId,
            accion
          );
        }
      } catch (notifError) {
        console.error("[Notificacion al resolver por jefe]:", notifError);
      }

      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al aprobar solicitud por jefe inmediato";
      let status = 500;
      if (mensaje === "Registro de vacaciones no encontrado") status = 404;
      else if (mensaje.includes("estado") || mensaje.includes("pendiente")) {
        status = 400;
      }
      res.status(status).json({ message: mensaje });
    }
  };

  registrarEvidencia = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const body = req.body && typeof req.body === "object" ? { ...req.body } : {};
      if (!body.evidencia_base64 && (body.evidenciaBase64 || body.archivo_base64)) {
        body.evidencia_base64 = body.evidenciaBase64 ?? body.archivo_base64;
      }
      if (!body.evidencia_nombre && (body.evidenciaNombre || body.archivo_nombre)) {
        body.evidencia_nombre = body.evidenciaNombre ?? body.archivo_nombre;
      }
      if (!body.evidencia_url && body.evidenciaUrl) {
        body.evidencia_url = body.evidenciaUrl;
      }

      const resultado = await this.registroService.registrarEvidencia(
        id,
        body
      );
      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al registrar evidencia de la solicitud";
      let status = 500;
      if (mensaje === "Registro de vacaciones no encontrado") status = 404;
      else if (
        mensaje.includes("Primero debe") ||
        mensaje.includes("rechazada") ||
        mensaje.includes("ya fue aprobada")
      ) {
        status = 400;
      }
      res.status(status).json({ message: mensaje });
    }
  };

  aprobarPorGestionHumana = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const resultado = await this.registroService.aprobarPorGestionHumana(
        id,
        req.body
      );

      try {
        const notificacionId = Number(
          req.body?.notificacion_id ?? req.body?.notificacionId ?? 0
        );
        const accion = this.extraerEstadoResolucion(req.body, resultado);
        if (notificacionId > 0) {
          await this.notificacionService.resolverNotificacion(
            notificacionId,
            accion
          );
        }
      } catch (notifError) {
        console.error("[Notificacion al resolver por GH]:", notifError);
      }

      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al aprobar solicitud por Gestión Humana";
      let status = 500;
      if (mensaje === "Registro de vacaciones no encontrado") status = 404;
      else if (mensaje.includes("estado") || mensaje.includes("pendiente")) {
        status = 400;
      }
      res.status(status).json({ message: mensaje });
    }
  };

  rechazar = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de registro inválido" });
        return;
      }

      const resultado = await this.registroService.rechazarSolicitud(
        id,
        req.body
      );

      try {
        const notificacionId = Number(
          req.body?.notificacion_id ?? req.body?.notificacionId ?? 0
        );
        if (notificacionId > 0) {
          await this.notificacionService.resolverNotificacion(
            notificacionId,
            "rechazado"
          );
        }
      } catch (notifError) {
        console.error("[Notificacion al rechazar]:", notifError);
      }

      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al rechazar solicitud de vacaciones";
      let status = 500;
      if (mensaje === "Registro de vacaciones no encontrado") status = 404;
      else if (mensaje.includes("motivo")) status = 400;
      res.status(status).json({ message: mensaje });
    }
  };
}