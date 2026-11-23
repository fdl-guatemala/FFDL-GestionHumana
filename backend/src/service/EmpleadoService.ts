import {
  EmpleadoRepository,
  type ActualizarEmpleadoInput,
  type CrearEmpleadoInput,
} from "../repositories/EmpleadoRepository.ts";

export class EmpleadoService {
  private readonly empleadoRepo: EmpleadoRepository;

  constructor(empleadoRepo = new EmpleadoRepository()) {
    this.empleadoRepo = empleadoRepo;
  }

  async listarEmpleados() {
    return this.empleadoRepo.obtenerTodos();
  }

  async obtenerEmpleado(id: number) {
    const empleado = await this.empleadoRepo.obtenerPorId(id);
    if (!empleado) {
      throw new Error("Empleado no encontrado");
    }
    return empleado;
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

    return {
      ...empleado,
      empleado_id: empleado.id ?? empleadoId,
      codigo_empleado: empleado.codigo_empleado,
      nombre: empleado.nombre_completo ?? "Colaborador",
      puesto: empleado.puesto ?? "Cargo no asignado",
      sucursal: empleado.lugar ?? "Sede no asignada",
      ingreso: empleado.fecha_ingreso ?? "—",
      egreso: empleado.fecha_egreso ?? "—",
      periodos: [],
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

  async eliminarEmpleado(id: number) {
    const eliminado = await this.empleadoRepo.eliminar(id);
    if (!eliminado) {
      throw new Error("Empleado no encontrado");
    }
    return { eliminado: true };
  }
}