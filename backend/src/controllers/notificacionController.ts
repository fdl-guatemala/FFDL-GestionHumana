import type { Request, Response } from "express";
import { pool } from "../config/database.ts";
import type { RowDataPacket } from "mysql2/promise";
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

  private async buscarPeriodoIdPorEmpleado(empleadoId: number): Promise<number | null> {
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) return null;

    const tablasCandidatas = ["periodos_vacaciones", "vacaciones_periodos", "periodo_vacaciones"];
    for (const tabla of tablasCandidatas) {
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM ${tabla} WHERE empleado_id = ? ORDER BY id DESC LIMIT 1`,
          [empleadoId]
        );
        const id = Number(rows?.[0]?.id ?? 0);
        if (Number.isInteger(id) && id > 0) return id;
      } catch {
        // Si la tabla no existe con ese nombre, probamos la siguiente
      }
    }
    return null;
  }

  private async normalizarPayloadSolicitud(rawBody: any): Promise<any> {
    const body = { ...(rawBody ?? {}) };
    const detalles = Array.isArray(body.detalle_ausencias)
      ? body.detalle_ausencias
      : [];

    // 1. empleado_id
    const empleadoId = Number(
      body.empleado_id ?? body.empleadoId ?? body.id_empleado ?? 0
    );
    if (Number.isInteger(empleadoId) && empleadoId > 0) {
      body.empleado_id = empleadoId;
    }

    // 2. dias_tomados
    let diasTomados = Number(
      body.dias_tomados ?? body.diasTomados ?? body.dias ?? 0
    );

    if (!Number.isFinite(diasTomados) || diasTomados <= 0) {
      let totalHoras = 0;
      let totalDiasDetalle = 0;

      for (const item of detalles) {
        if (!item || typeof item !== "object") continue;

        const diasItem = Number(item.dias_tomados ?? item.dias ?? 0);
        if (Number.isFinite(diasItem) && diasItem > 0) {
          totalDiasDetalle += diasItem;
        }

        const horasRaw = String(
          item.horas ??
            item.tiempo_solicitado ??
            item.duracion ??
            item.cantidad ??
            ""
        );
        const matchHoras = horasRaw.match(/(\d+(?:[.,]\d+)?)/);
        if (matchHoras) {
          totalHoras += Number(matchHoras[1].replace(",", "."));
        }
      }

      if (totalDiasDetalle > 0) {
        diasTomados = totalDiasDetalle;
      } else if (totalHoras > 0) {
        diasTomados = Math.max(0.5, Number((totalHoras / 8).toFixed(2)));
      } else {
        const disponibles = Number(body.dias_disponibles_vacaciones ?? 0);
        if (Number.isFinite(disponibles) && disponibles > 0) {
          diasTomados = 1;
        }
      }
    }

    body.dias_tomados =
      Number.isFinite(diasTomados) && diasTomados > 0 ? diasTomados : 0;

    // 3. fecha_disfrute / fecha_inicio / fecha_fin
    const fechasDetalle = detalles
      .map((d: any) =>
        String(d?.fecha ?? d?.fecha_ausencia ?? d?.fecha_disfrute ?? "").trim()
      )
      .filter(Boolean);

    const fechaBase = String(
      body.fecha_disfrute ??
        body.fecha_inicio ??
        body.fechaInicio ??
        fechasDetalle[0] ??
        body.fecha_solicitud ??
        ""
    ).trim();

    body.fecha_disfrute = fechaBase;
    if (!body.fecha_inicio) body.fecha_inicio = fechaBase;
    if (!body.fecha_fin) {
      body.fecha_fin = fechasDetalle[fechasDetalle.length - 1] || fechaBase;
    }

    // 4. periodo_id
    let periodoId = Number(
      body.periodo_id ?? body.periodoId ?? body.id_periodo ?? 0
    );
    if ((!Number.isInteger(periodoId) || periodoId <= 0) && body.empleado_id) {
      const encontrado = await this.buscarPeriodoIdPorEmpleado(body.empleado_id);
      if (encontrado) periodoId = encontrado;
    }
    if (Number.isInteger(periodoId) && periodoId > 0) {
      body.periodo_id = periodoId;
    }

    // 5. Campos de solicitante
    if (!body.nombre_solicitante && body.nombre_colaborador) {
      body.nombre_solicitante = body.nombre_colaborador;
    }
    if (!body.codigo_solicitante && body.codigo_empleado) {
      body.codigo_solicitante = body.codigo_empleado;
    }

    return body;
  }

  private extraerDatosSolicitante(reqBody: any, creado: any) {
    const fuente = { ...(creado ?? {}), ...(reqBody ?? {}) };

    const solicitudId =
      Number(
        creado?.id ??
          creado?.insertId ??
          creado?.registro?.id ??
          fuente?.solicitud_id ??
          0
      ) || null;

    const codigoSolicitante = String(
      fuente?.codigo_solicitante ??
        fuente?.codigo_empleado ??
        fuente?.empleado_codigo ??
        fuente?.codigo ??
        ""
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

    const fechaDisfrute = String(
      fuente?.fecha_disfrute ?? fuente?.fecha_inicio ?? fuente?.fechaInicio ?? ""
    ).trim();

    const fechaFin = String(fuente?.fecha_fin ?? fuente?.fechaFin ?? "").trim();

    const diasTomados =
      fuente?.dias_tomados ?? fuente?.diasTomados ?? fuente?.dias ?? "";

    const partesResumen: string[] = [];
    if (fechaDisfrute && fechaFin && fechaDisfrute !== fechaFin) {
      partesResumen.push(`${fechaDisfrute} al ${fechaFin}`);
    } else if (fechaDisfrute) {
      partesResumen.push(fechaDisfrute);
    }
    if (diasTomados !== "") {
      partesResumen.push(`${diasTomados} día(s)`);
    }

    return {
      solicitudId,
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
      const payloadNormalizado = await this.normalizarPayloadSolicitud(req.body);
      const creado = await this.registroService.crearRegistro(payloadNormalizado);

      try {
        const datos = this.extraerDatosSolicitante(payloadNormalizado, creado);
        if (datos.codigoSolicitante) {
          await this.notificacionService.crearNotificacionesParaSolicitud({
            solicitud_id: datos.solicitudId,
            codigo_solicitante: datos.codigoSolicitante,
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

      const actualizado = await this.registroService.actualizarRegistro(
        id,
        req.body
      );
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

      const resultado = await this.registroService.eliminarRegistro(id);
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
        const notificacionId = Number(req.body?.notificacion_id ?? 0);
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
        const notificacionId = Number(req.body?.notificacion_id ?? 0);
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
}