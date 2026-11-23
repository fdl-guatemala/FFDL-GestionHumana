import type { Request, Response } from "express";
import { EmpleadoService } from "../service/EmpleadoService.ts";

export class EmpleadoController {
  private readonly empleadoService: EmpleadoService;

  constructor(empleadoService = new EmpleadoService()) {
    this.empleadoService = empleadoService;
  }

  listar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const empleados = await this.empleadoService.listarEmpleados();
      res.status(200).json(empleados);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al obtener empleados";
      res.status(500).json({ message: mensaje });
    }
  };

  miExpediente = async (req: Request, res: Response): Promise<void> => {
    try {
      const empleadoId = Number(req.query.empleado_id);
      const codigoEmpleado = String(req.query.codigo_empleado ?? "").trim();

      const expediente = await this.empleadoService.obtenerMiExpediente(
        empleadoId,
        codigoEmpleado
      );
      res.status(200).json(expediente);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al obtener expediente";
      const status = mensaje === "Empleado no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  obtenerPorId = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de empleado inválido" });
        return;
      }

      const empleado = await this.empleadoService.obtenerEmpleado(id);
      res.status(200).json(empleado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al buscar empleado";
      const status = mensaje === "Empleado no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  crear = async (req: Request, res: Response): Promise<void> => {
    try {
      const creado = await this.empleadoService.crearEmpleado(req.body);
      res.status(201).json(creado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al crear empleado";
      const status =
        mensaje.includes("Faltan campos") || mensaje.includes("Ya existe")
          ? 400
          : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  actualizar = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de empleado inválido" });
        return;
      }

      const actualizado = await this.empleadoService.actualizarEmpleado(
        id,
        req.body
      );
      res.status(200).json(actualizado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al actualizar empleado";
      let status = 500;
      if (mensaje === "Empleado no encontrado") status = 404;
      else if (mensaje.includes("ya está asignado")) status = 400;
      res.status(status).json({ message: mensaje });
    }
  };

  eliminarPorCodigo = async (req: Request, res: Response): Promise<void> => {
    try {
      const codigo = String(
        req.params.codigo ?? req.query.codigo_empleado ?? req.body?.codigo_empleado ?? ""
      ).trim();

      if (!codigo) {
        res.status(400).json({ message: "El código de empleado es obligatorio" });
        return;
      }

      const resultado = await this.empleadoService.eliminarEmpleadoPorCodigo(codigo);
      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al eliminar empleado";
      let status = 500;
      if (mensaje === "Empleado no encontrado") status = 404;
      else if (mensaje.includes("obligatorio")) status = 400;
      res.status(status).json({ message: mensaje });
    }
  };
  generarFiniquito = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de empleado inválido" });
        return;
      }

      const finiquito = await this.empleadoService.generarFiniquito(id, {
        fechaFiniquito: req.body?.fecha_finiquito,
        descontarDias: Boolean(req.body?.descontar_dias),
      });

      res.status(200).json({
        message: "Finiquito generado correctamente",
        finiquito,
      });
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al generar finiquito";
      let status = 500;
      if (mensaje === "Empleado no encontrado") status = 404;
      else if (mensaje.includes("No se puede generar el finiquito")) status = 400;
      res.status(status).json({ message: mensaje });
    }
  };
}