import { Request, Response } from "express";
import { AuthService } from "../service/AuthService.ts";

export class AuthController {
    private authService = new AuthService();

    login = async (req: Request, res: Response) => {
        try {
            const { codigo_empleado, contrasena} = req.body;

            if (!codigo_empleado || !contrasena) {
                return res.status(400).json({ exito: false, mensaje: "Codigo y contraseña son requeridos"})
            }

            const resultado = await this.authService.login(codigo_empleado, contrasena);

            if (!resultado.exito){
                return res.status(401).json(resultado);
            }

            res.status(200).json(resultado);
        }catch (error) {
            console.error("Error en login:", error);
            res.status(500).json({exito: false, mensaje: "Error interno del servidor" });
        }
        
    };

    registro = async (req: Request, res: Response) => {
        try {
            const resultado = await this.authService.registro(req.body);

            if(!resultado.exito) {
                return res.status(400).json(resultado);
            }

            res.status(201).json(resultado);
        } catch (error) {
            console.error("Error en registro:", error);
            res.status(500).json({ exito: false, mensaje: "Error interno del servidor al registrar" });
        }
    };
}