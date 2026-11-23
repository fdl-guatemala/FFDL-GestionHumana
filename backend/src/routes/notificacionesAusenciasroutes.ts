import { Router } from "express";
import { NotificacionAusenciaService } from "../service/NotificacionAusenciaService.ts";

const router = Router();
const service = new NotificacionAusenciaService();

// GET /api/notificaciones-ausencias?destinatario_tipo=jefe_inmediato
router.get("/", async (req, res) => {
  try {
    const destinatario_tipo =
      typeof req.query.destinatario_tipo === "string"
        ? req.query.destinatario_tipo
        : undefined;
    const destinatario_codigo =
      typeof req.query.destinatario_codigo === "string"
        ? req.query.destinatario_codigo
        : undefined;
    const solo_pendientes = req.query.solo_pendientes === "true";

    const data = await service.listarNotificaciones({
      destinatario_tipo,
      destinatario_codigo,
      solo_pendientes,
    });
    res.status(200).json(data);
  } catch (error) {
    console.error("[GET /notificaciones-ausencias]", error);
    res.status(500).json({ message: "Error al obtener notificaciones" });
  }
});

// PATCH /api/notificaciones-ausencias/:id/resolver  -> { estado: "aprobado" | "rechazado" }
router.patch("/:id/resolver", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "ID de notificación inválido" });
      return;
    }

    const estadoRaw = String(req.body?.estado ?? "").toLowerCase();
    if (estadoRaw !== "aprobado" && estadoRaw !== "rechazado") {
      res.status(400).json({ message: "El estado debe ser 'aprobado' o 'rechazado'" });
      return;
    }

    const actualizada = await service.resolverNotificacion(id, estadoRaw);
    if (!actualizada) {
      res.status(404).json({ message: "Notificación no encontrada" });
      return;
    }

    res.status(200).json(actualizada);
  } catch (error) {
    console.error("[PATCH /notificaciones-ausencias/:id/resolver]", error);
    res.status(500).json({ message: "Error al actualizar la aprobación" });
  }
});

export const notificacionAusenciaroutes = router;
export default router;