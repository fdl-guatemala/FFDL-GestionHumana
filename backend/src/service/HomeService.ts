import { EmpleadoRepository } from "../repositories/EmpleadoRepository.ts";
import { PeriodoVacacionesRepository } from "../repositories/PeriodoVacacionesRepository.ts";
import { RegistroVacacionesRepository } from "../repositories/RegistroVacacionesRepository.ts";

export class HomeService {
  private readonly empleadosRepo: EmpleadoRepository;
  private readonly periodoVacacionesRepo: PeriodoVacacionesRepository;
  private readonly registroVacacionesRepo: RegistroVacacionesRepository;

  constructor(
    empleadosRepo = new EmpleadoRepository(),
    periodoVacacionesRepo = new PeriodoVacacionesRepository(),
    registroVacacionesRepo = new RegistroVacacionesRepository()
  ) {
    this.empleadosRepo = empleadosRepo;
    this.periodoVacacionesRepo = periodoVacacionesRepo;
    this.registroVacacionesRepo = registroVacacionesRepo;
  }

  async obtenerDatosHome() {
    const [empleados, periodos, registros] = await Promise.all([
      this.empleadosRepo.obtenerTodos(),
      this.periodoVacacionesRepo.obtenerTodos(),
      this.registroVacacionesRepo.obtenerTodos(),
    ]);

    return {
      estadisticas: {
        total_empleados: empleados.length,
        periodo_vacaciones: periodos.length,
        registro_vacaciones: registros.length,
      },
      empleados,
      periodo: periodos,
      registro: registros,
    };
  }
}