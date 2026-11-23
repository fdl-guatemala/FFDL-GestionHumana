import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import empleadoRoutes from './routes/empleadoroutes.ts';
import usuarioRoutes from './routes/UsuarioRoutes.ts';
import periodoVacacionesRoutes from './routes/periodoVacacionesroutes.ts';
import { registroVacacionesRoutes } from './routes/registroVacacionesRoutes.ts';
import homeRoutes from './routes/HomeRoutes.ts';
import { pool } from './config/database.ts';
import notificacionesAusenciasRouter from './routes/notificacionesAusenciasroutes.ts';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'public/uploads')));

app.use('/api/empleados', empleadoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/periodos-vacaciones', periodoVacacionesRoutes);
app.use('/api/registro-vacaciones', registroVacacionesRoutes);
app.use('/api/home', homeRoutes);
app.use("/api/notificaciones-ausencias", notificacionesAusenciasRouter)

app.get('/', (_req: Request, res: Response) => {
  res.json({ mensaje: 'API Gestión Humana funcionando' });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no controlado en la API:', err);
  const mensaje = err instanceof Error ? err.message : 'Error interno del servidor';
  res.status(500).json({ mensaje });
});

app.listen(PORT, async () => {
  console.log('Servidor corriendo en el puerto ' + PORT);

  try {
    await pool.query('SELECT 1');
    console.log('Conexión a MySQL exitosa');
  } catch (error) {
    console.error('Error al conectar a MySQL:', error);
  }
});

export default app;