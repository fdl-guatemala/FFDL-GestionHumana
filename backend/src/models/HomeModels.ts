import { Router } from "express";
import { obtenerHome } from "../controllers/HomeController.ts";

const routes = Router();

routes.get("/", obtenerHome)

export default routes;