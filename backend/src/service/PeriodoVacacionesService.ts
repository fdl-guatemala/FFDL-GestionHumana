import {
  PeriodoVacacionesRepository,
  type ActualizarPeriodoVacacionesInput,
  type CrearPeriodoVacacionesInput,
} from "../repositories/PeriodoVacacionesRepository.ts";

export class PeriodoVacacionesService {
  private readonly periodoRepo: PeriodoVacacionesRepository;

  constructor(periodoRepo = new PeriodoVacacionesRepository()) {
    this.periodoRepo = periodoRepo;
  }

  async listarPeriodos() {
    return this.periodoRepo.obtenerTodos();
  }

  async obtenerPeriodo(id: number) {
    const periodo = await this.periodoRepo.obtenerPorId(id);
    if (!periodo) {
      throw new Error("Periodo de vacaciones no encontrado");
    }
    return periodo;
  }

  async listarPorEmpleado(empleadoId: number) {
    return this.periodoRepo.obtenerPorEmpleadoId(empleadoId);
  }

  async crearPeriodo(input: CrearPeriodoVacacionesInput) {
    if (
      !input.empleado_id ||
      !input.fecha_inicio_periodo ||
      !input.fecha_fin_periodo
    ) {
      throw new Error(
        "Faltan campos obligatorios (empleado_id, fecha_inicio_periodo, fecha_fin_periodo)"
      );
    }

    if (input.fecha_fin_periodo < input.fecha_inicio_periodo) {
      throw new Error(
        "La fecha_fin_periodo no puede ser menor que fecha_inicio_periodo"
      );
    }

    const dias = input.dias_disponibles ?? 0;
    if (dias < 0) {
      throw new Error("dias_disponibles no puede ser negativo");
    }

    const nuevoId = await this.periodoRepo.crear({
      ...input,
      dias_disponibles: dias,
    });

    return this.periodoRepo.obtenerPorId(nuevoId);
  }

  async actualizarPeriodo(id: number, input: ActualizarPeriodoVacacionesInput) {
    const actual = await this.periodoRepo.obtenerPorId(id);
    if (!actual) {
      throw new Error("Periodo de vacaciones no encontrado");
    }

    const fechaInicio = input.fecha_inicio_periodo ?? actual.fecha_inicio_periodo;
    const fechaFin = input.fecha_fin_periodo ?? actual.fecha_fin_periodo;

    if (fechaFin < fechaInicio) {
      throw new Error(
        "La fecha_fin_periodo no puede ser menor que fecha_inicio_periodo"
      );
    }

    if (input.dias_disponibles !== undefined && input.dias_disponibles < 0) {
      throw new Error("dias_disponibles no puede ser negativo");
    }

    const actualizado = await this.periodoRepo.actualizar(id, input);
    if (!actualizado) {
      throw new Error("No se pudo actualizar el periodo de vacaciones");
    }

    return this.periodoRepo.obtenerPorId(id);
  }

  async eliminarPeriodo(id: number) {
    const eliminado = await this.periodoRepo.eliminar(id);
    if (!eliminado) {
      throw new Error("Periodo de vacaciones no encontrado");
    }
    return { eliminado: true };
  }
}