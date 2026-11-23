import { EmpleadoRepository } from "../repositories/EmpleadoRepository.ts";
import { NotificacionRepository } from "../repositories/NotificacionRepository.ts";
import { PeriodoVacacionesRepository } from "../repositories/PeriodoVacacionesRepository.ts";
import {
  RegistroVacacionesRepository,
  type ActualizarRegistroVacacionesInput,
  type CrearRegistroVacacionesInput,
} from "../repositories/RegistroVacacionesRepository.ts";

export interface AprobarSolicitudPayload {
  aprobado_por?: string;
  observaciones?: string;
}

export class RegistroVacacionesService {
  private readonly registroRepo: RegistroVacacionesRepository;
  private readonly periodoRepo: PeriodoVacacionesRepository;
  private readonly empleadoRepo: EmpleadoRepository;
  private readonly notificacionRepo: NotificacionRepository;

  constructor(
    registroRepo = new RegistroVacacionesRepository(),
    periodoRepo = new PeriodoVacacionesRepository(),
    empleadoRepo = new EmpleadoRepository(),
    notificacionRepo = new NotificacionRepository()
  ) {
    this.registroRepo = registroRepo;
    this.periodoRepo = periodoRepo;
    this.empleadoRepo = empleadoRepo;
    this.notificacionRepo = notificacionRepo;
  }

  async listarRegistros() {
    return this.registroRepo.obtenerTodos();
  }

  async obtenerRegistro(id: number) {
    const registro = await this.registroRepo.obtenerPorId(id);
    if (!registro) {
      throw new Error("Registro de vacaciones no encontrado");
    }
    return registro;
  }

  async listarPorEmpleado(empleadoId: number) {
    return this.registroRepo.obtenerPorEmpleadoId(empleadoId);
  }

  async crearRegistro(input: CrearRegistroVacacionesInput) {
    if (
      !input.empleado_id ||
      !input.periodo_id ||
      !input.fecha_disfrute?.trim() ||
      input.dias_tomados === undefined ||
      input.dias_tomados <= 0
    ) {
      throw new Error(
        "Faltan campos obligatorios o dias_tomados es inválido (debe ser mayor que 0)"
      );
    }

    const periodo = await this.periodoRepo.obtenerPorId(input.periodo_id);
    if (!periodo) {
      throw new Error("Periodo de vacaciones no encontrado");
    }

    if (Number(periodo.empleado_id) !== Number(input.empleado_id)) {
      throw new Error(
        "El periodo seleccionado no pertenece al empleado indicado"
      );
    }

    const disponiblesActuales = Number(periodo.dias_disponibles);
    const diasTomados = Number(input.dias_tomados);

    if (disponiblesActuales < diasTomados) {
      throw new Error(
        `Días insuficientes en el periodo (disponibles: ${disponiblesActuales}, solicitados: ${diasTomados})`
      );
    }

    const empleado = await this.empleadoRepo.obtenerPorId(Number(input.empleado_id));

    const nuevoId = await this.registroRepo.crear({
      ...input,
      dias_tomados: diasTomados,
    });

    await this.periodoRepo.ajustarDiasDisponibles(input.periodo_id, -diasTomados);

    // 1) Notificación inicial para el jefe inmediato del empleado
    const nombreEmpleado =
      (empleado as { nombre_completo?: string; nombre?: string } | null)
        ?.nombre_completo ??
      (empleado as { nombre?: string } | null)?.nombre ??
      `Empleado #${input.empleado_id}`;

    const jefeInmediato =
      (empleado as { jefe_inmediato?: string | null } | null)?.jefe_inmediato ??
      null;

    await this.notificacionRepo.crear({
      solicitudId: nuevoId,
      tipoSolicitud: "VACACIONES",
      destinatarioTipo: "JEFE_INMEDIATO",
      destinatarioReferencia: jefeInmediato,
      titulo: "Nueva solicitud de vacaciones por aprobar",
      mensaje: `${nombreEmpleado} solicitó ${diasTomados} día(s) de vacaciones para el ${input.fecha_disfrute}.`,
    });

    return this.registroRepo.obtenerPorId(nuevoId);
  }

  async aprobarPorJefe(id: number, _payload: AprobarSolicitudPayload = {}) {
    const registro = await this.obtenerRegistro(id);

    // Marcamos como leída la notificación del jefe inmediato
    await this.notificacionRepo.marcarLeidasPorSolicitudYTipo(
      id,
      "JEFE_INMEDIATO"
    );

    // 2) Notificación para Gestión Humana tras la aprobación del jefe
    const empleado = await this.empleadoRepo.obtenerPorId(
      Number(registro.empleado_id)
    );
    const nombreEmpleado =
      (empleado as { nombre_completo?: string; nombre?: string } | null)
        ?.nombre_completo ??
      (empleado as { nombre?: string } | null)?.nombre ??
      `Empleado #${registro.empleado_id}`;

    await this.notificacionRepo.crear({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      destinatarioTipo: "GESTION_HUMANA",
      destinatarioReferencia: null,
      titulo: "Solicitud aprobada por jefe inmediato",
      mensaje: `La solicitud #${id} de ${nombreEmpleado} fue aprobada por su jefe inmediato y está lista para Gestión Humana.`,
    });

    return {
      aprobado_por: "JEFE_INMEDIATO",
      registro,
    };
  }

  async aprobarPorGestionHumana(
    id: number,
    _payload: AprobarSolicitudPayload = {}
  ) {
    const registro = await this.obtenerRegistro(id);

    // Marcamos como leída la notificación de Gestión Humana
    await this.notificacionRepo.marcarLeidasPorSolicitudYTipo(
      id,
      "GESTION_HUMANA"
    );

    // 3) Notificación final al empleado
    await this.notificacionRepo.crear({
      solicitudId: id,
      tipoSolicitud: "VACACIONES",
      destinatarioTipo: "EMPLEADO",
      destinatarioReferencia: String(registro.empleado_id),
      titulo: "Solicitud de vacaciones aprobada",
      mensaje: `Tu solicitud de vacaciones #${id} fue aprobada por Gestión Humana.`,
    });

    return {
      aprobado_por: "GESTION_HUMANA",
      registro,
    };
  }

  async actualizarRegistro(id: number, input: ActualizarRegistroVacacionesInput) {
    const actual = await this.registroRepo.obtenerPorId(id);
    if (!actual) {
      throw new Error("Registro de vacaciones no encontrado");
    }

    const periodoDestinoId = input.periodo_id ?? actual.periodo_id;
    const empleadoDestinoId = input.empleado_id ?? actual.empleado_id;
    const nuevosDias =
      input.dias_tomados !== undefined
        ? Number(input.dias_tomados)
        : Number(actual.dias_tomados);

    if (nuevosDias <= 0) {
      throw new Error("dias_tomados debe ser mayor que 0");
    }

    const periodoDestino = await this.periodoRepo.obtenerPorId(periodoDestinoId);
    if (!periodoDestino) {
      throw new Error("Periodo de vacaciones no encontrado");
    }

    if (Number(periodoDestino.empleado_id) !== Number(empleadoDestinoId)) {
      throw new Error(
        "El periodo seleccionado no pertenece al empleado indicado"
      );
    }

    // Devolvemos primero los días del registro anterior a su periodo original
    await this.periodoRepo.ajustarDiasDisponibles(
      actual.periodo_id,
      Number(actual.dias_tomados)
    );

    // Consultamos saldo actualizado en el periodo destino
    const periodoActualizado =
      await this.periodoRepo.obtenerPorId(periodoDestinoId);
    const disponibles = Number(periodoActualizado?.dias_disponibles ?? 0);

    if (disponibles < nuevosDias) {
      // Revertimos la devolución para no dejar el saldo alterado si falla
      await this.periodoRepo.ajustarDiasDisponibles(
        actual.periodo_id,
        -Number(actual.dias_tomados)
      );
      throw new Error(
        `Días insuficientes en el periodo (disponibles: ${disponibles}, solicitados: ${nuevosDias})`
      );
    }

    const actualizado = await this.registroRepo.actualizar(id, {
      ...input,
      dias_tomados: nuevosDias,
    });

    if (!actualizado) {
      await this.periodoRepo.ajustarDiasDisponibles(
        actual.periodo_id,
        -Number(actual.dias_tomados)
      );
      throw new Error("No se pudo actualizar el registro de vacaciones");
    }

    await this.periodoRepo.ajustarDiasDisponibles(periodoDestinoId, -nuevosDias);

    return this.registroRepo.obtenerPorId(id);
  }

  async eliminarRegistro(id: number) {
    const actual = await this.registroRepo.obtenerPorId(id);
    if (!actual) {
      throw new Error("Registro de vacaciones no encontrado");
    }

    const eliminado = await this.registroRepo.eliminar(id);
    if (!eliminado) {
      throw new Error("No se pudo eliminar el registro de vacaciones");
    }

    // Reintegra los días tomados al periodo correspondiente
    await this.periodoRepo.ajustarDiasDisponibles(
      actual.periodo_id,
      Number(actual.dias_tomados)
    );

    return { eliminado: true };
  }
}