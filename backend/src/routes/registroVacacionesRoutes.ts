import { Router } from "express";
import { RegistroVacacionesController } from "../controllers/RegistroVacacionesController.ts";

const router = Router();
const registroController = new RegistroVacacionesController();

router.get("/", registroController.listar);
router.get("/empleado/:empleadoId", registroController.listarPorEmpleado);
router.get("/:id", registroController.obtenerPorId);
router.post("/", registroController.crear);
router.put("/:id", registroController.actualizar);
router.delete("/:id", registroController.eliminar);

// Flujo de aprobación en dos pasos: Jefe Inmediato -> Gestión Humana
router.post("/:id/aprobar-jefe", registroController.aprobarPorJefe);
router.post("/:id/aprobar-gh", registroController.aprobarPorGestionHumana);

export const registroVacacionesRoutes = router;
export default router;