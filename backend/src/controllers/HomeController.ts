import type { Request, Response } from "express";
import { HomeService } from "../service/HomeService.ts";

const homeService = new HomeService();

export const obtenerHome = (req: Request, res: Response) => {
    const datos = homeService.obtenerDatosHome();
    res.status(200).json(datos);
};