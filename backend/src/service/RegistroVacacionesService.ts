import { EmpleadoRepository } from "../repositories/EmpleadoRepository.ts";
import { NotificacionRepository } from "../repositories/NotificacionRepository.ts";
import { PeriodoVacacionesRepository } from "../repositories/PeriodoVacacionesRepository.ts";
import {
  RegistroVacacionesRepository,
  type ActualizarRegistroVacacionesInput,
  type CrearRegistroVacacionesInput,
} from "../repositories/RegistroVacacionesRepository.ts";
import { FirmaRepository } from "../repositories/FirmaRepository.ts";
import { generarHashFirma } from "../utils/firmaDigital.ts";

export interface AprobarSolicitudPayload {
  aprobado_por?: string;
  observaciones?: string;
  firma_texto?: string | null;
  firma_base64?: string | null;
  notificacion_id?: number;
  notificacionId?: number;
  estado?: string;
  accion?: string;
  motivo_rechazo?: string;
  rechazado_por?: string;
}

export interface EvidenciaSolicitudPayload {
  evidencia_url?: string | null;
  evidencia_nombre?: string | null;
  evidencia_base64?: string | null;
  observaciones?: string | null;
  sin_evidencia?: boolean;
  enviado_por?: string;
}

export interface PasoLineaProceso {
  paso: number;
  clave: string;
  titulo: string;
  estado: "COMPLETADO" | "EN_PROCESO" | "PENDIENTE" | "RECHAZADO";
}

export type EtapaFlujoVacaciones =
  | "PENDIENTE_JEFE"
  | "PENDIENTE_EVIDENCIA"
  | "PENDIENTE_GH"
  | "APROBADA"
  | "RECHAZADA";

export class RegistroVacacionesService {
  private readonly registroRepo: RegistroVacacionesRepository;
  private readonly periodoRepo: PeriodoVacacionesRepository;
  private readonly empleadoRepo: EmpleadoRepository;
  private readonly notificacionRepo: NotificacionRepository;
  private readonly firmaRepo: FirmaRepository;

  constructor(
    registroRepo = new RegistroVacacionesRepository(),
    periodoRepo = new PeriodoVacacionesRepository(),
    empleadoRepo = new EmpleadoRepository(),
    notificacionRepo = new NotificacionRepository(),
    firmaRepo = new FirmaRepository()
  ) {
    this.registroRepo = registroRepo;
    this.periodoRepo = periodoRepo;
    this.empleadoRepo = empleadoRepo;
    this.notificacionRepo = notificacionRepo;
    this.firmaRepo = firmaRepo;
  }

  private normalizarTextoComparacion(texto: unknown): string {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
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

  private extraerEnteroPositivo(valor: unknown): number {
    if (typeof valor === "number") {
      return Number.isInteger(valor) && valor > 0 ? valor : 0;
    }
    if (typeof valor === "string") {
      const limpio = valor.trim();
      if (!limpio) return 0;
      const directo = Number(limpio);
      if (Number.isInteger(directo) && directo > 0) return directo;
      const match = limpio.match(/(\d+)/);
      if (match) {
        const num = Number(match[1]);
        if (Number.isInteger(num) && num > 0) return num;
      }
    }
    return 0;
  }

  private normalizarDiasTomados(raw: Record<string, any>): number {
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
            const val =
              item.dias_tomados ??
              item.diasTomados ??
              item.dias ??
              item.cantidad ??
              item.total_dias ??
              item.horas ??
              item.dias_horas_solicitadas ??
              item.numero_dias_horas ??
              1;
            const n = this.extraerNumeroPositivo(val);
            return acc + (n > 0 ? n : 1);
          }
          return acc + 1;
        }, 0);
        if (suma > 0) return suma;
      }
    }

    return 0;
  }

  private normalizarFechaDisfrute(raw: Record<string, any>): string {
    const directa =
      raw.fecha_disfrute ??
      raw.fechaDisfrute ??
      raw.fecha_ausencia ??
      raw.fechaAusencia ??
      raw.fecha_inicio ??
      raw.fechaInicio ??
      "";
    if (String(directa).trim()) return String(directa).trim();

    const listas = [raw.detalle_ausencias, raw.detalleAusencias, raw.ausencias];
    for (const lista of listas) {
      if (
        Array.isArray(lista) &&
        lista.length > 0 &&
        lista[0] &&
        typeof lista[0] === "object"
      ) {
        const fechaFila =
          lista[0].fecha_disfrute ??
          lista[0].fecha_ausencia ??
          lista[0].fechaAusencia ??
          lista[0].fecha ??
          "";
        if (String(fechaFila).trim()) return String(fechaFila).trim();
      }
    }

    return String(raw.fecha_solicitud ?? "").trim();
  }

  private async resolverEmpleadoId(raw: Record<string, any>): Promise<number> {
    const directo = this.extraerEnteroPositivo(
      raw.empleado_id ?? raw.empleadoId ?? 0
    );

    if (directo > 0) {
      const empPorId = await this.empleadoRepo.obtenerPorId(directo);
      if (empPorId && Number(empPorId.id) > 0) {
        return Number(empPorId.id);
      }
    }

    const codigo = String(
      raw.codigo_empleado ?? raw.codigoEmpleado ?? raw.codigo ?? ""
    ).trim();

    if (
      codigo &&
      typeof (this.empleadoRepo as any).obtenerPorCodigo === "function"
    ) {
      const emp = await (this.empleadoRepo as any).obtenerPorCodigo(codigo);
      const idEncontrado = Number(emp?.id ?? 0);
      if (Number.isInteger(idEncontrado) && idEncontrado > 0) {
        return idEncontrado;
      }
    }

    return 0;
  }

  private async resolverPeriodoId(
    empleadoId: number,
    periodoIdActual?: unknown
  ): Promise<number | undefined> {
    const empId = Number(empleadoId);
    if (!Number.isInteger(empId) || empId <= 0) {
      return undefined;
    }

    const periodos = await this.periodoRepo.obtenerPorEmpleadoId(empId);
    if (!Array.isArray(periodos) || periodos.length === 0) {
      return undefined;
    }

    const idActualNum = this.extraerEnteroPositivo(periodoIdActual ?? 0);
    if (idActualNum > 0) {
      const coincide = periodos.find((p) => Number(p.id) === idActualNum);
      if (coincide) {
        return Number(coincide.id);
      }
    }

    const conSaldo = periodos.find((p) => Number(p.dias_disponibles ?? 0) > 0);
    const elegido = conSaldo ?? periodos[0];
    const encontrado = Number(elegido?.id ?? 0);

    return Number.isInteger(encontrado) && encontrado > 0
      ? encontrado
      : undefined;
  }

  private async asegurarPeriodoId(
    empleadoId: number,
    periodoIdActual?: unknown,
    fechaReferencia?: string
  ): Promise<number | undefined> {
    const existente = await this.resolverPeriodoId(empleadoId, periodoIdActual);
    if (existente) {
      return existente;
    }

    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      return undefined;
    }

    const empleado = await this.empleadoRepo.obtenerPorId(empleadoId);
    if (!empleado) {
      return undefined;
    }

    const baseFecha = /^\d{4}-\d{2}-\d{2}/.test(String(fechaReferencia ?? ""))
      ? String(fechaReferencia).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const anio = Number(baseFecha.slice(0, 4)) || new Date().getFullYear();

    const creado = await this.periodoRepo.crear({
      empleado_id: empleadoId,
      fecha_inicio_periodo: `${anio}-01-01`,
      fecha_fin_periodo: `${anio}-12-31`,
      dias_disponibles: 15,
    });

    const nuevoPeriodoId =
      typeof creado === "number"
        ? creado
        : Number((creado as any)?.id ?? (creado as any)?.insertId ?? 0);

    return Number.isInteger(nuevoPeriodoId) && nuevoPeriodoId > 0
      ? nuevoPeriodoId
      : undefined;
  }

  private resolverNombreEmpleado(
    empleado: any,
    fallbackId: number,
    payloadNombre?: unknown
  ): string {
    const desdePayload = String(payloadNombre ?? "").trim();
    if (desdePayload) return desdePayload;
    const desdeRepo = String(
      empleado?.nombre_completo ?? empleado?.nombre ?? ""
    ).trim();
    if (desdeRepo) return desdeRepo;
    return `Empleado #${fallbackId}`;
  }

  private resolverDestinatarioJefe(
    raw: Record<string, any>,
    empleado: any,
    nombreSolicitante: string,
    empleadoId: number
  ): string | null {
    const candidato = String(
      raw.nombre_jefe_inmediato ??
        raw.jefe_inmediato ??
        (empleado as { jefe_inmediato?: string | null } | null)
          ?.jefe_inmediato ??
        raw.codigo_jefe_inmediato ??
        raw.jefe_codigo ??
        ""
    ).trim();

    if (!candidato) {
      return null;
    }

    const candidatoNorm = this.normalizarTextoComparacion(candidato);
    const solicitanteNorm = this.normalizarTextoComparacion(nombreSolicitante);
    const codigoSolicitanteNorm = this.normalizarTextoComparacion(
      empleado?.codigo_empleado ?? raw.codigo_empleado ?? ""
    );

    const esMismaPersona =
      candidatoNorm === solicitanteNorm ||
      candidato.trim() === String(empleadoId) ||
      (codigoSolicitanteNorm && candidatoNorm === codigoSolicitanteNorm);

    return esMismaPersona ? null : candidato;
  }

  private construirLineaProceso(etapaActual: EtapaFlujoVacaciones): {
    etapa_actual: EtapaFlujoVacaciones;
    estado_visible_colaborador: string;
    pasos: PasoLineaProceso[];
  } {
    if (etapaActual === "RECHAZADA") {
      return {
        etapa_actual: "RECHAZADA",
        estado_visible_colaborador: "Solicitud rechazada",
        pasos: [
          { paso: 1, clave: "ENVIADA", titulo: "Solicitud enviada", estado: "COMPLETADO" },
          { paso: 2, clave: "JEFE_INMEDIATO", titulo: "Vo. Bo. Jefe Inmediato", estado: "RECHAZADO" },
          { paso: 3, clave: "EVIDENCIA_COLABORADOR", titulo: "Evidencia del colaborador", estado: "PENDIENTE" },
          { paso: 4, clave: "GESTION_HUMANA", titulo: "Aprobación Gestión Humana", estado: "PENDIENTE" },
        ],
      };
    }

    if (etapaActual === "APROBADA") {
      return {
        etapa_actual: "APROBADA",
        estado_visible_colaborador: "Aprobada por Jefatura y Gestión Humana",
        pasos: [
          { paso: 1, clave: "ENVIADA", titulo: "Solicitud enviada", estado: "COMPLETADO" },
          { paso: 2, clave: "JEFE_INMEDIATO", titulo: "Vo. Bo. Jefe Inmediato", estado: "COMPLETADO" },
          { paso: 3, clave: "EVIDENCIA_COLABORADOR", titulo: "Evidencia del colaborador", estado: "COMPLETADO" },
          { paso: 4, clave: "GESTION_HUMANA", titulo: "Aprobación Gestión Humana", estado: "COMPLETADO" },
        ],
      };
    }

    if (etapaActual === "PENDIENTE_GH") {
      return {
        etapa_actual: "PENDIENTE_GH",
        estado_visible_colaborador: "En proceso · Pendiente de Gestión Humana",
        pasos: [
          { paso: 1, clave: "ENVIADA", titulo: "Solicitud enviada", estado: "COMPLETADO" },
          { paso: 2, clave: "JEFE_INMEDIATO", titulo: "Vo. Bo. Jefe Inmediato", estado: "COMPLETADO" },
          { paso: 3, clave: "EVIDENCIA_COLABORADOR", titulo: "Evidencia del colaborador", estado: "COMPLETADO" },
          { paso: 4, clave: "GESTION_HUMANA", titulo: "Aprobación Gestión Humana", estado: "EN_PROCESO" },
        ],
      };
    }

    if (etapaActual === "PENDIENTE_EVIDENCIA") {
      return {
        etapa_actual: "PENDIENTE_EVIDENCIA",
        estado_visible_colaborador: "En proceso · Pendiente de evidencia del colaborador",
        pasos: [
          { paso: 1, clave: "ENVIADA", titulo: "Solicitud enviada", estado: "COMPLETADO" },
          { paso: 2, clave: "JEFE_INMEDIATO", titulo: "Vo. Bo. Jefe Inmediato", estado: "COMPLETADO" },
          { paso: 3, clave: "EVIDENCIA_COLABORADOR", titulo: "Evidencia del colaborador", estado: "EN_PROCESO" },
          { paso: 4, clave: "GESTION_HUMANA", titulo: "Aprobación Gestión Humana", estado: "PENDIENTE" },
        ],
      };
    }

    return {
      etapa_actual: "PENDIENTE_JEFE",
      estado_visible_colaborador: "En proceso · Enviada a Jefe Inmediato",
      pasos: [
        { paso: 1, clave: "ENVIADA", titulo: "Solicitud enviada", estado: "COMPLETADO" },
        { paso: 2, clave: "JEFE_INMEDIATO", titulo: "Vo. Bo. Jefe Inmediato", estado: "EN_PROCESO" },
        { paso: 3, clave: "EVIDENCIA_COLABORADOR", titulo: "Evidencia del colaborador", estado: "PENDIENTE" },
        { paso: 4, clave: "GESTION_HUMANA", titulo: "Aprobación Gestión Humana", estado: "PENDIENTE" },
      ],
    };
  }

  private async determinarEtapaDesdeFirmas(
    solicitudId: number,
    registro?: any
  ): Promise<EtapaFlujoVacaciones> {
    const estadoReg = this.normalizarTextoComparacion(registro?.estado ?? "");
    if (estadoReg === "rechazada" || estadoReg === "rechazado") {
      return "RECHAZADA";
    }

    try {
      const firmas = await this.firmaRepo.listarPorSolicitud(
        solicitudId,
        "VACACIONES"
      );

      if (Array.isArray(firmas) && firmas.length > 0) {
        const firmasDeSolicitud = firmas.filter((f) => {
          const idFirma = Number(f?.solicitud_id ?? 0);
          const tipo = String(f?.tipo_solicitud ?? "VACACIONES").toUpperCase();
          return (
            idFirma > 0 && idFirma === Number(solicitudId) && tipo === "VACACIONES"
          );
        });

        const tieneJefe = firmasDeSolicitud.some(
          (f) => String(f?.rol_firmante ?? "").toUpperCase() === "JEFE_INMEDIATO"
        );
        const tieneEvidencia =
          Boolean(registro?.evidencia_enviada) ||
          Boolean(registro?.evidencia_base64) ||
          String(registro?.observaciones ?? "").includes("Evidencia:") ||
          firmasDeSolicitud.some(
            (f) => String(f?.rol_firmante ?? "").toUpperCase() === "EMPLEADO"
          );
        const tieneGh = firmasDeSolicitud.some(
          (f) => String(f?.rol_firmante ?? "").toUpperCase() === "GESTION_HUMANA"
        );

        if (tieneJefe && tieneEvidencia && tieneGh) return "APROBADA";
        if (tieneJefe && tieneEvidencia) return "PENDIENTE_GH";
        if (tieneJefe) return "PENDIENTE_EVIDENCIA";
      }
    } catch {
      // Si falla la consulta de firmas, mantiene PENDIENTE_JEFE
    }

    return "PENDIENTE_JEFE";
  }

  private formatearRegistroConEtapa(reg: any, etapa: EtapaFlujoVacaciones) {
    const estadoDerivado =
      etapa === "APROBADA"
        ? "Aprobada"
        : etapa === "RECHAZADA"
          ? "Rechazada"
          : etapa === "PENDIENTE_EVIDENCIA" || etapa === "PENDIENTE_GH"
            ? "En revisión"
            : "Pendiente";

    const jefeAprobado =
      etapa === "PENDIENTE_EVIDENCIA" ||
      etapa === "PENDIENTE_GH" ||
      etapa === "APROBADA";
    const evidenciaEnviada = etapa === "PENDIENTE_GH" || etapa === "APROBADA";
    const ghAprobado = etapa === "APROBADA";

    return {
      ...reg,
      estado: estadoDerivado,
      estado_jefe:
        etapa === "RECHAZADA"
          ? "Rechazado"
          : jefeAprobado
            ? "Aprobado"
            : "Pendiente",
      estado_evidencia: evidenciaEnviada ? "Enviada" : "Pendiente",
      evidencia_enviada: evidenciaEnviada,
      estado_gh: ghAprobado ? "Aprobado" : "Pendiente",
      linea_proceso: this.construirLineaProceso(etapa),
    };
  }

  async listarRegistros() {
    const registros = await this.registroRepo.obtenerTodos();
    return Promise.all(
      registros.map(async (reg: any) => {
        const idNum = Number(reg?.id ?? 0);
        const etapa =
          idNum > 0
            ? await this.determinarEtapaDesdeFirmas(idNum, reg)
            : "PENDIENTE_JEFE";
        return this.formatearRegistroConEtapa(reg, etapa);
      })
    );
  }

  async obtenerRegistro(id: number) {
    const registro = await this.registroRepo.obtenerPorId(id);
    if (!registro) {
      throw new Error("Registro de vacaciones no encontrado");
    }
    const etapa = await this.determinarEtapaDesdeFirmas(id, registro);
    return this.formatearRegistroConEtapa(registro, etapa);
  }

  async listarPorEmpleado(empleadoId: number) {
    const registros = await this.registroRepo.obtenerPorEmpleadoId(empleadoId);
    return Promise.all(
      registros.map(async (reg: any) => {
        const idNum = Number(reg?.id ?? 0);
        const etapa =
          idNum > 0
            ? await this.determinarEtapaDesdeFirmas(idNum, reg)
            : "PENDIENTE_JEFE";
        return this.formatearRegistroConEtapa(reg, etapa);
      })
    );
  }

  async crearRegistro(input: CrearRegistroVacacionesInput) {
    const raw = (input ?? {}) as Record<string, any>;
    const empleadoId = await this.resolverEmpleadoId(raw);
    const fechaDisfrute = this.normalizarFechaDisfrute(raw);
    const diasTomados = this.normalizarDiasTomados(raw);
    const periodoId = await this.asegurarPeriodoId(
      empleadoId,
      raw.periodo_id ?? raw.periodoId,
      fechaDisfrute
    );

    const faltantes: string[] = [];
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      faltantes.push("empleado_id");
    }
    if (!periodoId) {
      faltantes.push("periodo_id");
    }
    if (!fechaDisfrute.trim()) {
      faltantes.push("fecha_disfrute");
    }
    if (!Number.isFinite(diasTomados) || diasTomados <= 0) {
      faltantes.push("dias_tomados (debe ser mayor que 0)");
    }

    if (faltantes.length > 0) {
      throw new Error(
        `Faltan campos obligatorios o son inválidos: ${faltantes.join(", ")}`
      );
    }

    const periodo = await this.periodoRepo.obtenerPorId(periodoId!);
    if (!periodo) {
      throw new Error("Periodo de vacaciones no encontrado");
    }

    if (Number(periodo.empleado_id) !== empleadoId) {
      throw new Error(
        "El periodo seleccionado no pertenece al empleado indicado"
      );
    }

    const disponiblesActuales = Number(periodo.dias_disponibles);

    if (disponiblesActuales < diasTomados) {
      throw new Error(
        `Días insuficientes en el periodo (disponibles: ${disponiblesActuales}, solicitados: ${diasTomados})`
      );
    }

    const empleado = await this.empleadoRepo.obtenerPorId(empleadoId);

    const payloadNormalizado: CrearRegistroVacacionesInput = {
      ...(input as any),
      empleado_id: empleadoId,
      periodo_id: periodoId,
      fecha_disfrute: fechaDisfrute.trim(),
      dias_tomados: diasTomados,
      estado: "Pendiente",
      estado_constancia: "Pendiente",
    };

    const nuevoId = await this.registroRepo.crear(payloadNormalizado);

    await this.periodoRepo.ajustarDiasDisponibles(periodoId!, -diasTomados);

    try {
      const nombreEmpleado = this.resolverNombreEmpleado(
        empleado,
        empleadoId,
        raw.nombre_colaborador ?? raw.nombre_solicitante ?? raw.nombre_completo
      );

      const jefeInmediato = this.resolverDestinatarioJefe(
        raw,
        empleado,
        nombreEmpleado,
        empleadoId
      );

      await this.notificacionRepo.crear({
        solicitudId: nuevoId,
        tipoSolicitud: "VACACIONES",
        destinatarioTipo: "JEFE_INMEDIATO",
        destinatarioReferencia: jefeInmediato,
        titulo: "Nueva solicitud de vacaciones por aprobar",
        mensaje: `${nombreEmpleado} solicitó ${diasTomados} día(s) de vacaciones para el ${fechaDisfrute.trim()}.`,
      });
    } catch (notifErr) {
      console.error("[Servicio Notificacion crearRegistro]:", notifErr);
    }

    const creado = await this.registroRepo.obtenerPorId(nuevoId);
    return {
      ...(creado ?? {}),
      id: nuevoId,
      estado: "Pendiente",
      estado_jefe: "Pendiente",
      estado_evidencia: "Pendiente",
      evidencia_enviada: false,
      estado_gh: "Pendiente",
      linea_proceso: this.construirLineaProceso("PENDIENTE_JEFE"),
    };
  }

  async aprobarPorJefe(id: number, payload: AprobarSolicitudPayload = {}) {
    const registro = await this.registroRepo.obtenerPorId(id);
    if (!registro) {
      throw new Error("Registro de vacaciones no encontrado");
    }

    const etapaActual = await this.determinarEtapaDesdeFirmas(id, registro);
    if (etapaActual === "RECHAZADA") {
      throw new Error("No se puede aprobar una solicitud rechazada");
    }
    if (etapaActual === "PENDIENTE_EVIDENCIA") {
      throw new Error(
        "La solicitud ya fue aprobada por el Jefe Inmediato y está en espera de la evidencia del colaborador"
      );
    }
    if (etapaActual === "PENDIENTE_GH") {
      throw new Error(
        "La solicitud ya fue aprobada por el Jefe Inmediato y está pendiente de Gestión Humana"
      );
    }
    if (etapaActual === "APROBADA") {
      throw new Error("La solicitud ya fue aprobada por Gestión Humana");
    }

    try {
      await this.notificacionRepo.marcarLeidasPorSolicitudYTipo(
        id,
        "JEFE_INMEDIATO"
      );
    } catch (notifErr) {
      console.error("[Servicio Notificacion marcarLeidas jefe]:", notifErr);
    }

    const firmanteRef = payload.aprobado_por?.trim() || "JEFE_INMEDIATO";

    const hashDocumento = generarHashFirma({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      rolFirmante: "JEFE_INMEDIATO",
      firmanteReferencia: firmanteRef,
      fechaHoraIso: new Date().toISOString(),
      resumenDatos: `empleado=${registro.empleado_id};periodo=${registro.periodo_id};dias=${registro.dias_tomados};obs=${payload.observaciones ?? ""}`,
    });

    await this.firmaRepo.crear({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      rolFirmante: "JEFE_INMEDIATO",
      firmanteReferencia: firmanteRef,
      firmaTexto: payload.firma_texto ?? null,
      firmaBase64: payload.firma_base64 ?? null,
      hashDocumento,
    });

    try {
      await this.notificacionRepo.crear({
        solicitudId: id,
        tipoSolicitud: "VACACIONES",
        destinatarioTipo: "EMPLEADO",
        destinatarioReferencia: String(registro.empleado_id),
        titulo: "Solicitud aprobada por jefe inmediato · Pendiente de evidencia",
        mensaje: `Tu solicitud #${id} fue aprobada por tu jefe inmediato. Envía tu evidencia (si aplica) para pasar a Gestión Humana.`,
      });
    } catch (notifErr) {
      console.error("[Servicio Notificacion aprobarPorJefe]:", notifErr);
    }

    return {
      aprobado_por: "JEFE_INMEDIATO",
      hash_documento: hashDocumento,
      registro: {
        ...registro,
        estado: "En revisión",
        estado_jefe: "Aprobado",
        estado_evidencia: "Pendiente",
        evidencia_enviada: false,
        estado_gh: "Pendiente",
        linea_proceso: this.construirLineaProceso("PENDIENTE_EVIDENCIA"),
      },
    };
  }

  async registrarEvidencia(id: number, payload: EvidenciaSolicitudPayload = {}) {
    const registro = await this.registroRepo.obtenerPorId(id);
    if (!registro) {
      throw new Error("Registro de vacaciones no encontrado");
    }

    const etapaActual = await this.determinarEtapaDesdeFirmas(id, registro);
    if (etapaActual === "RECHAZADA") {
      throw new Error("No se puede enviar evidencia en una solicitud rechazada");
    }
    if (etapaActual === "PENDIENTE_JEFE") {
      throw new Error(
        "Primero debe aprobar el Jefe Inmediato antes de enviar la evidencia"
      );
    }
    if (etapaActual === "APROBADA") {
      throw new Error("La solicitud ya fue aprobada por Gestión Humana");
    }

    const obsActuales = String(registro.observaciones ?? "").trim();
    const detalleEvidencia = [
      payload.evidencia_nombre
        ? `Evidencia: ${String(payload.evidencia_nombre).trim()}`
        : payload.sin_evidencia
          ? "Evidencia: Sin evidencia adjunta"
          : payload.evidencia_url
            ? `Evidencia: ${String(payload.evidencia_url).trim()}`
            : "Evidencia: Confirmada por colaborador",
      payload.observaciones ? String(payload.observaciones).trim() : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const nuevasObservaciones = [obsActuales, detalleEvidencia]
      .filter(Boolean)
      .join(" — ");

    if (nuevasObservaciones) {
      await this.registroRepo.actualizar(id, {
        observaciones: nuevasObservaciones,
      });
    }

    const repoAny = this.registroRepo as any;
    if (typeof repoAny.guardarEvidenciaAdjunta === "function") {
      await repoAny.guardarEvidenciaAdjunta(id, {
        evidencia_nombre: payload.evidencia_nombre ?? null,
        evidencia_url: payload.evidencia_url ?? null,
        evidencia_base64: payload.evidencia_base64 ?? null,
      });
    }

    const remitenteRef = payload.enviado_por?.trim() || "COLABORADOR";
    const hashEvidencia = generarHashFirma({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      rolFirmante: "EMPLEADO",
      firmanteReferencia: remitenteRef,
      fechaHoraIso: new Date().toISOString(),
      resumenDatos: `empleado=${registro.empleado_id};evidencia=${payload.evidencia_nombre ?? payload.evidencia_url ?? "confirmada"}`,
    });

    await this.firmaRepo.crear({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      rolFirmante: "EMPLEADO",
      firmanteReferencia: remitenteRef,
      firmaTexto: detalleEvidencia || null,
      firmaBase64: payload.evidencia_base64 ?? null,
      hashDocumento: hashEvidencia,
    });

    try {
      const empleado = await this.empleadoRepo.obtenerPorId(
        Number(registro.empleado_id)
      );
      const nombreEmpleado = this.resolverNombreEmpleado(
        empleado,
        Number(registro.empleado_id),
        registro.nombre_completo
      );

      await this.notificacionRepo.crear({
        solicitudId: id,
        tipoSolicitud: "VACACIONES",
        destinatarioTipo: "GESTION_HUMANA",
        destinatarioReferencia: null,
        titulo: "Evidencia enviada · Lista para Gestión Humana",
        mensaje: `${nombreEmpleado} completó el paso de evidencia en la solicitud #${id}; pendiente de aprobación final de Gestión Humana.`,
      });
    } catch (notifErr) {
      console.error("[Servicio Notificacion registrarEvidencia]:", notifErr);
    }

    return {
      evidencia_enviada: true,
      hash_documento: hashEvidencia,
      registro: {
        ...registro,
        observaciones: nuevasObservaciones || registro.observaciones,
        evidencia_nombre: payload.evidencia_nombre ?? registro.evidencia_nombre ?? null,
        evidencia_url: payload.evidencia_url ?? registro.evidencia_url ?? null,
        evidencia_base64: payload.evidencia_base64 ?? registro.evidencia_base64 ?? null,
        estado: "En revisión",
        estado_jefe: "Aprobado",
        estado_evidencia: "Enviada",
        evidencia_enviada: true,
        estado_gh: "Pendiente",
        linea_proceso: this.construirLineaProceso("PENDIENTE_GH"),
      },
    };
  }

  async aprobarPorGestionHumana(
    id: number,
    payload: AprobarSolicitudPayload = {}
  ) {
    const registro = await this.registroRepo.obtenerPorId(id);
    if (!registro) {
      throw new Error("Registro de vacaciones no encontrado");
    }

    const etapaActual = await this.determinarEtapaDesdeFirmas(id, registro);
    if (etapaActual === "RECHAZADA") {
      throw new Error("No se puede aprobar una solicitud rechazada");
    }
    if (etapaActual === "PENDIENTE_JEFE") {
      throw new Error(
        "Primero debe aprobar el Jefe Inmediato antes de que Gestión Humana apruebe la solicitud"
      );
    }
    if (etapaActual === "PENDIENTE_EVIDENCIA") {
      throw new Error(
        "Primero debe completarse el paso de evidencia del colaborador antes de la aprobación final de Gestión Humana"
      );
    }
    if (etapaActual === "APROBADA") {
      throw new Error("La solicitud ya fue aprobada por Gestión Humana");
    }

    try {
      await this.notificacionRepo.marcarLeidasPorSolicitudYTipo(
        id,
        "GESTION_HUMANA"
      );
    } catch (notifErr) {
      console.error("[Servicio Notificacion marcarLeidas GH]:", notifErr);
    }

    const firmanteRef = payload.aprobado_por?.trim() || "GESTION_HUMANA";

    const hashDocumento = generarHashFirma({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      rolFirmante: "GESTION_HUMANA",
      firmanteReferencia: firmanteRef,
      fechaHoraIso: new Date().toISOString(),
      resumenDatos: `empleado=${registro.empleado_id};periodo=${registro.periodo_id};dias=${registro.dias_tomados};obs=${payload.observaciones ?? ""}`,
    });

    await this.firmaRepo.crear({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      rolFirmante: "GESTION_HUMANA",
      firmanteReferencia: firmanteRef,
      firmaTexto: payload.firma_texto ?? null,
      firmaBase64: payload.firma_base64 ?? null,
      hashDocumento,
    });

    try {
      await this.notificacionRepo.crear({
        solicitudId: id,
        tipoSolicitud: "VACACIONES",
        destinatarioTipo: "EMPLEADO",
        destinatarioReferencia: String(registro.empleado_id),
        titulo: "Solicitud de vacaciones aprobada",
        mensaje: `Tu solicitud de vacaciones #${id} fue aprobada por Gestión Humana.`,
      });
    } catch (notifErr) {
      console.error("[Servicio Notificacion aprobarPorGH]:", notifErr);
    }

    return {
      aprobado_por: "GESTION_HUMANA",
      hash_documento: hashDocumento,
      registro: {
        ...registro,
        estado: "Aprobada",
        estado_jefe: "Aprobado",
        estado_evidencia: "Enviada",
        evidencia_enviada: true,
        estado_gh: "Aprobado",
        linea_proceso: this.construirLineaProceso("APROBADA"),
      },
    };
  }

  async rechazarSolicitud(id: number, payload: AprobarSolicitudPayload = {}) {
    const registro = await this.registroRepo.obtenerPorId(id);
    if (!registro) {
      throw new Error("Registro de vacaciones no encontrado");
    }

    const motivo = String(
      payload.motivo_rechazo ?? payload.observaciones ?? ""
    ).trim();
    if (!motivo) {
      throw new Error("Debe indicar el motivo del rechazo");
    }

    const rechazadoPor =
      payload.rechazado_por?.trim() ||
      payload.aprobado_por?.trim() ||
      "APROBADOR";

    try {
      const repoAny = this.registroRepo as any;
      if (typeof repoAny.actualizarEstado === "function") {
        await repoAny.actualizarEstado(id, {
          estado: "Rechazada",
          motivo_rechazo: motivo,
          rechazado_por: rechazadoPor,
        });
      }
      if (
        registro.periodo_id &&
        Number(registro.dias_tomados ?? 0) > 0 &&
        this.normalizarTextoComparacion((registro as any).estado) !== "rechazada"
      ) {
        await this.periodoRepo.ajustarDiasDisponibles(
          Number(registro.periodo_id),
          Number(registro.dias_tomados)
        );
      }
    } catch (err) {
      console.error("[Servicio rechazarSolicitud]:", err);
    }

    try {
      await this.notificacionRepo.crear({
        solicitudId: id,
        tipoSolicitud: "VACACIONES",
        destinatarioTipo: "EMPLEADO",
        destinatarioReferencia: String(registro.empleado_id),
        titulo: "Solicitud de vacaciones rechazada",
        mensaje: `Tu solicitud #${id} fue rechazada por ${rechazadoPor}. Motivo: ${motivo}`,
      });
    } catch (notifErr) {
      console.error("[Servicio Notificacion rechazarSolicitud]:", notifErr);
    }

    return {
      rechazada: true,
      estado: "Rechazada",
      motivo_rechazo: motivo,
      rechazado_por: rechazadoPor,
      registro: {
        ...registro,
        estado: "Rechazada",
        motivo_rechazo: motivo,
        linea_proceso: this.construirLineaProceso("RECHAZADA"),
      },
    };
  }
}