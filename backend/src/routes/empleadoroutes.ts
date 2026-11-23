import { Router } from "express";
import { EmpleadoController } from "../controllers/EmpleadoController.ts";

const router = Router();
const empleadoController = new EmpleadoController();

router.get("/", empleadoController.listar);
router.get("/mi-expediente", empleadoController.miExpediente);
router.get("/:id", empleadoController.obtenerPorId);
router.post("/", empleadoController.crear);
router.post("/:id/finiquito", empleadoController.generarFiniquito);
router.put("/:id", empleadoController.actualizar);
router.delete("/codigo/:codigo", empleadoController.eliminarPorCodigo);


export default router;