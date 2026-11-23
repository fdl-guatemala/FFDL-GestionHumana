import { Router } from "express";
import { UsuarioController } from "../controllers/UsuarioController.ts";

const router = Router();
const usuarioController = new UsuarioController();

router.post("/login", usuarioController.login);
router.get("/", usuarioController.listar);
router.get("/:id", usuarioController.obtenerPorId);
router.post("/", usuarioController.crear);
router.put("/:id", usuarioController.actualizar);
router.delete("/:id", usuarioController.eliminar);

export default router;