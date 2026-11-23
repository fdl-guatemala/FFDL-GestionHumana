import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService, type UsuarioSesion } from '../../core/services/auth.services';

interface DetalleAusenciaFila {
  fecha_ausencia: string;
  horario_ausencia: string;
  dias_horas_solicitadas: string;
  motivo: string;
}

interface EmpleadoApiItem {
  empleado_id?: number;
  id?: number;
  codigo_empleado?: string;
  nombre?: string;
  nombre_completo?: string;
  nombre_empleados?: string;
  nombre_empleado?: string;
  puesto?: string;
  cargo?: string;
  nombre_puesto?: string;
  puesto_trabajo?: string;
  sucursal?: string;
  lugar?: string;
  sede?: string;
  nombre_sucursal?: string;
  agencia?: string;
  jefe_inmediato?: string | null;
  nombre_jefe_inmediato?: string | null;
  data?: EmpleadoApiItem;
  empleado?: EmpleadoApiItem;
}

@Component({
  selector: 'app-solicitar-vacaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './solicitarvacaciones.html',
  styleUrl: './solicitarvacaciones.css',
})
export class SolicitarVacacionesComponent implements OnInit, AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('firmaCanvas') firmaCanvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly apiUrl = 'http://localhost:3000/api';
  readonly usuario = this.authService.usuarioActual;

  nombreColaborador = '';
  fechaActual = this.obtenerFechaHoyISO();
  readonly sucursalSignal = signal<string>('');
  readonly cargoSignal = signal<string>('');

  get sucursal(): string {
    return this.sucursalSignal();
  }
  set sucursal(valor: string) {
    this.sucursalSignal.set(valor);
  }

  get cargo(): string {
    return this.cargoSignal();
  }
  set cargo(valor: string) {
    this.cargoSignal.set(valor);
  }

  filas: DetalleAusenciaFila[] = [
    {
      fecha_ausencia: '',
      horario_ausencia: '',
      dias_horas_solicitadas: '',
      motivo: 'Vacaciones',
    },
  ];

  modalidadHorario: 'trabajo_casa' | 'reposicion_tiempo' | '' = '';
  condicionSalario: 'con_goce' | 'sin_goce' | '' = '';
  tipoAviso: 'coordinacion_anticipada' | 'aviso_posterior' | '' = '';
  tipoMotivoEspecial: 'igss' | 'vacaciones' | '' = 'vacaciones';

  diasDisponiblesVacaciones: number | null = null;
  observaciones = '';

  firmaColaborador = '';
  tieneFirmaDigital = false;
  nombreJefeInmediato = '';
  firmaJefeInmediato = '';

  cargando = false;
  mensajeError = '';
  mensajeExito = '';

  private dibujando = false;
  private ctx: CanvasRenderingContext2D | null = null;

  ngOnInit(): void {
    this.cargarDatosColaborador();
  }

  ngAfterViewInit(): void {
    this.inicializarCanvasFirma();
  }

  private inicializarCanvasFirma(): void {
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 320;
    const height = rect.height > 0 ? rect.height : 90;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2;
    context.strokeStyle = '#0f294a';
    this.ctx = context;
  }

  private obtenerCoordenadas(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (event instanceof TouchEvent) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  iniciarTrazo(event: MouseEvent | TouchEvent): void {
    if (event instanceof TouchEvent) {
      event.preventDefault();
    }
    if (!this.ctx) {
      this.inicializarCanvasFirma();
    }
    if (!this.ctx) return;

    const { x, y } = this.obtenerCoordenadas(event);
    this.dibujando = true;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  dibujarTrazo(event: MouseEvent | TouchEvent): void {
    if (!this.dibujando || !this.ctx) return;
    if (event instanceof TouchEvent) {
      event.preventDefault();
    }

    const { x, y } = this.obtenerCoordenadas(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.tieneFirmaDigital = true;
  }

  finalizarTrazo(): void {
    if (!this.dibujando) return;
    this.dibujando = false;
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (canvas && this.tieneFirmaDigital) {
      this.firmaColaborador = canvas.toDataURL('image/png');
    }
  }

  limpiarFirma(): void {
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.firmaColaborador = '';
    this.tieneFirmaDigital = false;
  }

  private primerTexto(...valores: unknown[]): string | undefined {
    for (const val of valores) {
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
      if (typeof val === 'number' && Number.isFinite(val)) {
        return String(val);
      }
    }
    return undefined;
  }

  private extraerSucursal(obj?: EmpleadoApiItem | null): string | undefined {
    if (!obj) return undefined;
    return this.primerTexto(
      obj.lugar,
      obj.sucursal,
      obj.sede,
      obj.nombre_sucursal,
      obj.agencia
    );
  }

  private extraerCargo(obj?: EmpleadoApiItem | null): string | undefined {
    if (!obj) return undefined;
    return this.primerTexto(
      obj.puesto,
      obj.cargo,
      obj.nombre_puesto,
      obj.puesto_trabajo
    );
  }

  private extraerNombre(obj?: EmpleadoApiItem | null): string | undefined {
    if (!obj) return undefined;
    return this.primerTexto(
      obj.nombre_completo,
      obj.nombre,
      obj.nombre_empleados,
      obj.nombre_empleado
    );
  }

  private aplicarDatosEmpleado(data?: EmpleadoApiItem | null): void {
    if (!data || typeof data !== 'object') return;

    const nombreReal = this.extraerNombre(data);
    if (nombreReal) {
      this.nombreColaborador = nombreReal;
    }

    const sucursalReal = this.extraerSucursal(data);
    if (sucursalReal) {
      this.sucursalSignal.set(sucursalReal);
    }

    const cargoReal = this.extraerCargo(data);
    if (cargoReal) {
      this.cargoSignal.set(cargoReal);
    }

    const jefeReal = this.primerTexto(
      data.nombre_jefe_inmediato,
      data.jefe_inmediato
    );
    if (jefeReal) {
      this.nombreJefeInmediato = jefeReal;
    }

    this.cdr.detectChanges();
  }

  private cargarDatosColaborador(): void {
    const u = this.usuario() as (UsuarioSesion & EmpleadoApiItem) | null;

    this.aplicarDatosEmpleado(u);
    if (!this.nombreColaborador) {
      this.nombreColaborador = this.primerTexto(u?.codigo_empleado) ?? '';
    }

    const empleadoId = u?.empleado_id ?? u?.id ?? '';
    const codigoEmpleado = u?.codigo_empleado ?? '';

    if (empleadoId || codigoEmpleado) {
      const query = `?empleado_id=${encodeURIComponent(String(empleadoId))}&codigo_empleado=${encodeURIComponent(String(codigoEmpleado))}`;
      this.http
        .get<EmpleadoApiItem>(`${this.apiUrl}/empleados/mi-expediente${query}`)
        .subscribe({
          next: (res) => {
            const data = res?.data ?? res?.empleado ?? res;
            this.aplicarDatosEmpleado(data);
            if (!this.sucursalSignal() || !this.cargoSignal()) {
              this.buscarEnListaEmpleados(codigoEmpleado, this.nombreColaborador);
            }
          },
          error: () => {
            this.buscarEnListaEmpleados(codigoEmpleado, this.nombreColaborador);
          },
        });
    } else {
      this.buscarEnListaEmpleados('', this.nombreColaborador);
    }
  }

  private buscarEnListaEmpleados(codigo: string, nombre: string): void {
    this.http.get<EmpleadoApiItem[]>(`${this.apiUrl}/empleados`).subscribe({
      next: (lista) => {
        if (!Array.isArray(lista)) return;
        const codigoNorm = codigo.trim().toLowerCase();
        const nombreNorm = nombre.trim().toLowerCase();

        const encontrado = lista.find((emp) => {
          const codEmp = String(emp.codigo_empleado ?? '').trim().toLowerCase();
          const nomEmp = (this.extraerNombre(emp) ?? '').toLowerCase();
          return (
            (codigoNorm.length > 0 && codEmp === codigoNorm) ||
            (nombreNorm.length > 0 && nomEmp === nombreNorm)
          );
        });

        if (encontrado) {
          this.aplicarDatosEmpleado(encontrado);
        }
      },
      error: () => {},
    });
  }

  private obtenerFechaHoyISO(): string {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  agregarFila(): void {
    this.filas.push({
      fecha_ausencia: '',
      horario_ausencia: '',
      dias_horas_solicitadas: '',
      motivo: this.tipoMotivoEspecial === 'igss' ? 'IGSS' : 'Vacaciones',
    });
  }

  eliminarFila(index: number): void {
    if (this.filas.length > 1) {
      this.filas.splice(index, 1);
    }
  }

  seleccionarMotivoEspecial(valor: 'igss' | 'vacaciones'): void {
    this.tipoMotivoEspecial = this.tipoMotivoEspecial === valor ? '' : valor;
    if (this.tipoMotivoEspecial === 'vacaciones') {
      this.filas.forEach((f) => {
        if (!f.motivo) f.motivo = 'Vacaciones';
      });
    } else if (this.tipoMotivoEspecial === 'igss') {
      this.filas.forEach((f) => {
        if (!f.motivo) f.motivo = 'IGSS';
      });
    }
  }

  enviarSolicitud(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    const u = this.usuario();
    const filaInvalida = this.filas.some(
      (f) => !f.fecha_ausencia || !f.dias_horas_solicitadas.trim()
    );

    if (filaInvalida) {
      this.mensajeError =
        'Complete al menos la fecha de ausencia y los días u horas solicitadas en cada fila.';
      return;
    }

    if (!this.tieneFirmaDigital || !this.firmaColaborador) {
      this.mensajeError =
        'Por favor realice su firma digital en el recuadro de Firma del colaborador.';
      return;
    }

    this.cargando = true;

    const payload = {
      empleado_id: u?.empleado_id ?? null,
      codigo_empleado: u?.codigo_empleado ?? '',
      nombre_colaborador: this.nombreColaborador,
      fecha_solicitud: this.fechaActual,
      sucursal: this.sucursalSignal(),
      cargo: this.cargoSignal(),
      detalle_ausencias: this.filas,
      seleccion_x: {
        modalidad_horario: this.modalidadHorario,
        condicion_salario: this.condicionSalario,
        tipo_aviso: this.tipoAviso,
        motivo_especial: this.tipoMotivoEspecial,
      },
      dias_disponibles_vacaciones: this.diasDisponiblesVacaciones,
      observaciones: this.observaciones.trim(),
      firma_colaborador: this.firmaColaborador,
      nombre_jefe_inmediato: this.nombreJefeInmediato.trim(),
      firma_jefe_inmediato: this.firmaJefeInmediato.trim(),
    };

    this.http.post(`${this.apiUrl}/vacaciones/solicitudes`, payload).subscribe({
      next: () => {
        this.cargando = false;
        this.mensajeExito = 'Solicitud de ausencia enviada correctamente.';
        setTimeout(() => {
          this.router.navigate(['/proceso-vacaciones']);
        }, 1500);
      },
      error: (err) => {
        this.cargando = false;
        this.mensajeError =
          err?.error?.message ||
          err?.error?.error ||
          'No se pudo registrar la solicitud. Verifica la ruta del backend.';
      },
    });
  }
}