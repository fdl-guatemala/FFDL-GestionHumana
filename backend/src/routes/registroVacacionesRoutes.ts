import { Router, type NextFunction, type Request, type Response } from "express";
import { RegistroVacacionesController } from "../controllers/RegistroVacacionesController.ts";

const router = Router();
const registroController = new RegistroVacacionesController();

function validarIdNumerico(paramName: "id" | "empleadoId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const valor = Number(req.params[paramName]);
    if (!Number.isInteger(valor) || valor <= 0) {
      res.status(400).json({
        message: `El parámetro ${paramName} debe ser un número entero positivo.`,
      });
      return;
    }
    next();
  };
}

// Listado y consulta para abrir la solicitud al hacer clic en la notificación
router.get("/", registroController.listar);
router.get(
  "/empleado/:empleadoId",
  validarIdNumerico("empleadoId"),
  registroController.listarPorEmpleado
);
router.get(
  "/:id",
  validarIdNumerico("id"),
  registroController.obtenerPorId
);

// Crear / actualizar / eliminar solicitud
router.post("/", registroController.crear);
router.put(
  "/:id",
  validarIdNumerico("id"),
  registroController.actualizar
);
router.delete(
  "/:id",
  validarIdNumerico("id"),
  registroController.eliminar
);

// Paso 1: Aprobación por Jefe Inmediato -> pasa a pendiente de evidencia del colaborador
router.post(
  "/:id/aprobar-jefe",
  validarIdNumerico("id"),
  registroController.aprobarPorJefe
);
router.post(
  "/:id/aprobar-jefe-inmediato",
  validarIdNumerico("id"),
  registroController.aprobarPorJefe
);

// Paso 2: Registro de evidencia del colaborador -> pasa a pendiente de Gestión Humana
router.post(
  "/:id/evidencia",
  validarIdNumerico("id"),
  registroController.registrarEvidencia
);

// Paso 3: Aprobación final por Gestión Humana -> completa el flujo y notifica al empleado
router.post(
  "/:id/aprobar-gh",
  validarIdNumerico("id"),
  registroController.aprobarPorGestionHumana
);
router.post(
  "/:id/aprobar-gestion-humana",
  validarIdNumerico("id"),
  registroController.aprobarPorGestionHumana
);

// Rechazo con motivo por Jefe Inmediato o Gestión Humana
router.post(
  "/:id/rechazar",
  validarIdNumerico("id"),
  registroController.rechazar
);

export const registroVacacionesRoutes = router;
export default router;