import { Router } from "express";
import { PeriodoVacacionesController } from "../controllers/PeriodoVacacionesController.ts";

const router = Router();
const periodoController = new PeriodoVacacionesController();

router.get("/", periodoController.listar);
router.get("/empleado/:empleadoId", periodoController.listarPorEmpleado);
router.get("/:id", periodoController.obtenerPorId);
router.post("/", periodoController.crear);
router.put("/:id", periodoController.actualizar);
router.delete("/:id", periodoController.eliminar);

export default router;