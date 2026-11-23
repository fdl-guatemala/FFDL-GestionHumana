import type { Request, Response } from "express";
import { RegistroVacacionesService } from "../service/RegistroVacacionesService.ts";

export class RegistroVacacionesController {
  private readonly registroService: RegistroVacacionesService;

  constructor(registroService = new RegistroVacacionesService()) {
    this.registroService = registroService;
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
      const creado = await this.registroService.crearRegistro(req.body);
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