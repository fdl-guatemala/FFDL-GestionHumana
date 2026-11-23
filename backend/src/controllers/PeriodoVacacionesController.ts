import type { Request, Response } from "express";
import { PeriodoVacacionesService } from "../service/PeriodoVacacionesService.ts";

export class PeriodoVacacionesController {
  private readonly periodoService: PeriodoVacacionesService;

  constructor(periodoService = new PeriodoVacacionesService()) {
    this.periodoService = periodoService;
  }

  listar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const periodos = await this.periodoService.listarPeriodos();
      res.status(200).json(periodos);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al obtener periodos";
      res.status(500).json({ message: mensaje });
    }
  };

  obtenerPorId = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de periodo inválido" });
        return;
      }

      const periodo = await this.periodoService.obtenerPeriodo(id);
      res.status(200).json(periodo);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al buscar periodo";
      const status = mensaje === "Periodo de vacaciones no encontrado" ? 404 : 500;
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

      const periodos = await this.periodoService.listarPorEmpleado(empleadoId);
      res.status(200).json(periodos);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Error al obtener periodos del empleado";
      res.status(500).json({ message: mensaje });
    }
  };

  crear = async (req: Request, res: Response): Promise<void> => {
    try {
      const creado = await this.periodoService.crearPeriodo(req.body);
      res.status(201).json(creado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al crear periodo";
      const status =
        mensaje.includes("Faltan campos") ||
        mensaje.includes("fecha_fin_periodo") ||
        mensaje.includes("dias_disponibles")
          ? 400
          : 500;
      res.status(status).json({ message: mensaje });
    }
  };

  actualizar = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "ID de periodo inválido" });
        return;
      }

      const actualizado = await this.periodoService.actualizarPeriodo(id, req.body);
      res.status(200).json(actualizado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al actualizar periodo";
      let status = 500;
      if (mensaje === "Periodo de vacaciones no encontrado") status = 404;
      else if (
        mensaje.includes("fecha_fin_periodo") ||
        mensaje.includes("dias_disponibles")
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
        res.status(400).json({ message: "ID de periodo inválido" });
        return;
      }

      const resultado = await this.periodoService.eliminarPeriodo(id);
      res.status(200).json(resultado);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error al eliminar periodo";
      const status = mensaje === "Periodo de vacaciones no encontrado" ? 404 : 500;
      res.status(status).json({ message: mensaje });
    }
  };
}