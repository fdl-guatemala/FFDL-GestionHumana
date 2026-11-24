import crypto from "node:crypto";
import { pool } from "../config/database.ts";
import {
  EmpleadoRepository,
  type ActualizarEmpleadoInput,
  type CrearEmpleadoInput,
} from "../repositories/EmpleadoRepository.ts";
import { PeriodoVacacionesRepository } from "../repositories/PeriodoVacacionesRepository.ts";

const DIAS_VACACIONES_FINIQUITO = 15;
const ROL_POR_DEFECTO_ID = 3; // Ajusta este ID según tu tabla `roles`

export interface OpcionesFiniquitoInput {
  fechaFiniquito?: string;
  descontarDias?: boolean;
}

export interface CrearEmpleadoConUsuarioInput extends CrearEmpleadoInput {
  password?: string;
  rol_id?: number | null;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
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

  async crearEmpleado(input: CrearEmpleadoConUsuarioInput) {
    const codigoLimpio = input.codigo_empleado?.trim();
    const nombreLimpio = input.nombre_completo?.trim();
    const puestoLimpio = input.puesto?.trim();
    const lugarLimpio = input.lugar?.trim();
    const passwordPlano = input.password ?? "";

    if (
      !codigoLimpio ||
      !nombreLimpio ||
      !puestoLimpio ||
      !lugarLimpio ||
      !input.fecha_ingreso ||
      !passwordPlano.trim()
    ) {
      throw new Error(
        "Faltan campos obligatorios (codigo_empleado, nombre_completo, puesto, lugar, fecha_ingreso, password)"
      );
    }

    const existente = await this.empleadoRepo.obtenerPorCodigo(codigoLimpio);
    if (existente) {
      throw new Error("Ya existe un empleado con ese codigo_empleado");
    }

    const rolId =
      typeof input.rol_id === "number" && Number.isInteger(input.rol_id) && input.rol_id > 0
        ? input.rol_id
        : ROL_POR_DEFECTO_ID;

    const activo = (input.estado ?? "Activo").toLowerCase() === "inactivo" ? 0 : 1;
    const passwordHash = hashPassword(passwordPlano);

    const connection = await pool.getConnection();
    let nuevoId = 0;

    try {
      await connection.beginTransaction();

      const [empResult] = await connection.query<any>(
        `
          INSERT INTO empleados (
            codigo_empleado,
            nombre_completo,
            puesto,
            jefe_inmediato,
            lugar,
            fecha_ingreso,
            fecha_ingreso_prueba,
            fecha_egreso,
            estado
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          codigoLimpio,
          nombreLimpio,
          puestoLimpio,
          input.jefe_inmediato ?? null,
          lugarLimpio,
          input.fecha_ingreso,
          input.fecha_ingreso_prueba ?? null,
          input.fecha_egreso ?? null,
          input.estado ?? "Activo",
        ]
      );

      nuevoId = Number(empResult.insertId);

      const [usrResult] = await connection.query<any>(
        `
          INSERT INTO usuarios (
            empleado_id,
            codigo_empleado,
            nombre_empleados,
            password_hash,
            rol_id,
            activo
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [nuevoId, codigoLimpio, nombreLimpio, passwordHash, rolId, activo]
      );

      const usuarioId = Number(usrResult.insertId);
      if (usuarioId > 0) {
        await connection.query(
          `
            INSERT IGNORE INTO usuario_roles (usuario_id, rol_id)
            VALUES (?, ?)
          `,
          [usuarioId, rolId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

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