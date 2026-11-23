import {
  EmpleadoRepository,
  type ActualizarEmpleadoInput,
  type CrearEmpleadoInput,
} from "../repositories/EmpleadoRepository.ts";
import { PeriodoVacacionesRepository } from "../repositories/PeriodoVacacionesRepository.ts";

const DIAS_VACACIONES_FINIQUITO = 15;

export interface OpcionesFiniquitoInput {
  fechaFiniquito?: string;
  descontarDias?: boolean;
}

export class EmpleadoService {
  private readonly empleadoRepo: EmpleadoRepository;
  private readonly periodoVacacionesRepo: PeriodoVacacionesRepository;

  constructor(
    empleadoRepo = new EmpleadoRepository(),
    periodoVacacionesRepo = new PeriodoVacacionesRepository()
  ) {
    this.empleadoRepo = empleadoRepo;
    this.periodoVacacionesRepo = periodoVacacionesRepo;
  }

  async listarEmpleados() {
    const empleados = await this.empleadoRepo.obtenerTodos();
    return Promise.all(
      empleados.map(async (emp) => {
        const diasVacacionesDisponibles =
          await this.empleadoRepo.obtenerDiasVacacionesDisponibles(emp.id);
        return {
          ...emp,
          dias_vacaciones_disponibles: diasVacacionesDisponibles,
          puede_generar_finiquito:
            diasVacacionesDisponibles >= DIAS_VACACIONES_FINIQUITO,
        };
      })
    );
  }

  async obtenerEmpleado(id: number) {
    const empleado = await this.empleadoRepo.obtenerPorId(id);
    if (!empleado) {
      throw new Error("Empleado no encontrado");
    }
    const diasVacacionesDisponibles =
      await this.empleadoRepo.obtenerDiasVacacionesDisponibles(id);
    return {
      ...empleado,
      dias_vacaciones_disponibles: diasVacacionesDisponibles,
      puede_generar_finiquito:
        diasVacacionesDisponibles >= DIAS_VACACIONES_FINIQUITO,
    };
  }

  async obtenerMiExpediente(empleadoId?: number, codigoEmpleado?: string) {
    let empleado = null;

    if (empleadoId && Number.isInteger(empleadoId) && empleadoId > 0) {
      empleado = await this.empleadoRepo.obtenerPorId(empleadoId);
    }

    if (!empleado && codigoEmpleado?.trim()) {
      empleado = await this.empleadoRepo.obtenerPorCodigo(codigoEmpleado.trim());
    }

    if (!empleado) {
      throw new Error("Empleado no encontrado");
    }

    const periodos = await this.periodoVacacionesRepo.obtenerPorEmpleadoId(
      empleado.id
    );

    return {
      ...empleado,
      empleado_id: empleado.id ?? empleadoId,
      codigo_empleado: empleado.codigo_empleado,
      nombre: empleado.nombre_completo ?? "Colaborador",
      puesto: empleado.puesto ?? "Cargo no asignado",
      sucursal: empleado.lugar ?? "Sede no asignada",
      ingreso: empleado.fecha_ingreso ?? "—",
      egreso: empleado.fecha_egreso ?? "—",
      periodos,
    };
  }

  async crearEmpleado(input: CrearEmpleadoInput) {
    if (
      !input.codigo_empleado?.trim() ||
      !input.nombre_completo?.trim() ||
      !input.puesto?.trim() ||
      !input.lugar?.trim() ||
      !input.fecha_ingreso
    ) {
      throw new Error(
        "Faltan campos obligatorios (codigo_empleado, nombre_completo, puesto, lugar, fecha_ingreso)"
      );
    }

    const existente = await this.empleadoRepo.obtenerPorCodigo(
      input.codigo_empleado.trim()
    );
    if (existente) {
      throw new Error("Ya existe un empleado con ese codigo_empleado");
    }

    const nuevoId = await this.empleadoRepo.crear(input);
    return this.empleadoRepo.obtenerPorId(nuevoId);
  }

  async actualizarEmpleado(id: number, input: ActualizarEmpleadoInput) {
    const actual = await this.empleadoRepo.obtenerPorId(id);
    if (!actual) {
      throw new Error("Empleado no encontrado");
    }

    if (input.codigo_empleado) {
      const codigoTrim = input.codigo_empleado.trim();
      const otroConCodigo = await this.empleadoRepo.obtenerPorCodigo(codigoTrim);
      if (otroConCodigo && otroConCodigo.id !== id) {
        throw new Error("Ese codigo_empleado ya está asignado a otro empleado");
      }
    }

    const actualizado = await this.empleadoRepo.actualizar(id, input);
    if (!actualizado) {
      throw new Error("No se pudo actualizar el empleado");
    }

    return this.empleadoRepo.obtenerPorId(id);
  }

  async eliminarEmpleadoPorCodigo(codigoEmpleado: string) {
    const codigoLimpio = String(codigoEmpleado ?? "").trim();
    if (!codigoLimpio) {
      throw new Error("El codigo_empleado es obligatorio para eliminar");
    }

    const empleado = await this.empleadoRepo.obtenerPorCodigo(codigoLimpio);
    if (!empleado) {
      throw new Error("Empleado no encontrado");
    }

    const eliminado = await this.empleadoRepo.eliminarPorCodigo(codigoLimpio);
    if (!eliminado) {
      throw new Error("No se pudo eliminar el empleado");
    }

    return {
      eliminado: true,
      codigo_empleado: codigoLimpio,
      nombre_completo: empleado.nombre_completo,
    };
  }
  
  async generarFiniquito(id: number, options?: OpcionesFiniquitoInput) {
    const empleado = await this.empleadoRepo.obtenerPorId(id);
    if (!empleado) {
      throw new Error("Empleado no encontrado");
    }

    const periodos = await this.periodoVacacionesRepo.obtenerPorEmpleadoId(id);
    const totalDiasDisponibles = periodos.reduce(
      (acc, periodo) => acc + Number(periodo.dias_disponibles ?? 0),
      0
    );

    if (totalDiasDisponibles < DIAS_VACACIONES_FINIQUITO) {
      throw new Error(
        `No se puede generar el finiquito: el empleado tiene ${totalDiasDisponibles} de ${DIAS_VACACIONES_FINIQUITO} días de vacaciones requeridos.`
      );
    }

    if (options?.descontarDias) {
      let restantePorDescontar = DIAS_VACACIONES_FINIQUITO;

      for (const periodo of periodos) {
        if (restantePorDescontar <= 0) break;
        const disponiblesEnPeriodo = Number(periodo.dias_disponibles ?? 0);
        if (disponiblesEnPeriodo <= 0) continue;

        const aDescontar = Math.min(disponiblesEnPeriodo, restantePorDescontar);
        await this.periodoVacacionesRepo.ajustarDiasDisponibles(
          periodo.id,
          -aDescontar
        );
        restantePorDescontar -= aDescontar;
      }
    }

    const fechaEmision =
      options?.fechaFiniquito ?? new Date().toISOString().slice(0, 10);

    return {
      empleado_id: empleado.id,
      codigo_empleado: empleado.codigo_empleado,
      nombre_completo: empleado.nombre_completo,
      puesto: empleado.puesto,
      jefe_inmediato: empleado.jefe_inmediato ?? "No asignado",
      lugar: empleado.lugar,
      fecha_ingreso: empleado.fecha_ingreso,
      fecha_egreso: empleado.fecha_egreso ?? fechaEmision,
      estado: empleado.estado,
      dias_vacaciones_disponibles: totalDiasDisponibles,
      dias_vacaciones_requeridos: DIAS_VACACIONES_FINIQUITO,
      dias_descontados: options?.descontarDias ? DIAS_VACACIONES_FINIQUITO : 0,
      fecha_generacion: fechaEmision,
      concepto: "Finiquito por cumplimiento de 15 días de vacaciones",
    };
  }
}