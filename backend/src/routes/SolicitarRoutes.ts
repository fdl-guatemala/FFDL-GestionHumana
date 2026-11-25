import { Router } from "express";
import { SolicitudController } from "../controllers/SolicitarController.ts";

const router = Router();
const solicitudController = new SolicitudController();

router.get("/", solicitudController.listar);
router.post("/", solicitudController.crear);

export const solicitudRoutes = router;
export default router;