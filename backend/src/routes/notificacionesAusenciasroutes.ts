import { Router } from "express";
import { NotificacionAusenciaService } from "../service/NotificacionAusenciaService.ts";

const router = Router();
const service = new NotificacionAusenciaService();

router.get("/", async (req, res) => {
  try {
    const tipoRaw = req.query.rolTipo ?? req.query.destinatario_tipo;
    const codigoRaw = req.query.codigo ?? req.query.destinatario_codigo;

    const destinatario_tipo =
      typeof tipoRaw === "string" && tipoRaw.trim() !== ""
        ? tipoRaw.trim()
        : undefined;
    const destinatario_codigo =
      typeof codigoRaw === "string" && codigoRaw.trim() !== ""
        ? codigoRaw.trim()
        : undefined;
    const solo_pendientes = req.query.solo_pendientes === "true";

    const data = await service.listarNotificaciones({
      destinatario_tipo,
      destinatario_codigo,
      solo_pendientes,
    });
    res.status(200).json(data);
  } catch (error) {
    console.error("[GET /notificaciones]", error);
    res.status(500).json({ message: "Error al obtener notificaciones" });
  }
});

router.patch("/:id/leer", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "ID de notificación inválido" });
      return;
    }

    const data = await service.marcarComoLeida(id);
    res.status(200).json(data);
  } catch (error) {
    console.error("[PATCH /notificaciones/:id/leer]", error);
    res.status(500).json({ message: "Error al marcar como leída" });
  }
});

router.patch("/:id/resolver", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "ID de notificación inválido" });
      return;
    }

    const estadoRaw = String(
      req.body?.estado ?? req.body?.accion ?? req.body?.estado_aprobacion ?? ""
    )
      .trim()
      .toLowerCase();

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
    console.error("[PATCH /notificaciones/:id/resolver]", error);
    res.status(500).json({ message: "Error al actualizar la aprobación" });
  }
});

export const notificacionAusenciaroutes = router;
export default router;