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
  cantidad_solicitada: number;
  unidad_tiempo: 'días' | 'horas';
  dias_horas_solicitadas: string;
  motivo: string;
  tipo_permiso: string;
}

interface EvidenciaAdjunta {
  nombre: string;
  tipo: string;
  tamanoKb: number;
  dataUrl: string;
  esImagen: boolean;
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
  @ViewChild('firmaJefeCanvas') firmaJefeCanvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly apiUrl = 'http://localhost:3000/api';
  readonly usuario = this.authService.usuarioActual;

  readonly opcionesHorarioLista: string[] = [
    'Jornada completa (08:00 - 17:00)',
    'Media jornada mañana (08:00 - 12:00)',
    'Media jornada tarde (13:00 - 17:00)',
    '08:00 - 10:00',
    '08:00 - 12:00',
    '13:00 - 15:00',
    '15:00 - 17:00',
  ];

  readonly opcionesMotivoLista: string[] = [
    'Vacaciones',
    'IGSS',
    'Ausencia con trabajo desde casa en horario normal',
    'Ausencia con reposición de tiempo fuera de horario laboral',
    'Con goce de salario',
    'Sin goce de salario',
  ];

  readonly opcionesTipoPermisoLista: string[] = [
    'Permiso personal',
    'Permiso médico / Cita IGSS',
    'Duelo / Fallecimiento familiar',
    'Matrimonio',
    'Nacimiento / Lactancia',
    'Trámite legal o bancario',
    'Diligencia institucional / Comisión',
    'Caso fortuito o emergencia familiar',
  ];

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

  filas: DetalleAusenciaFila[] = [this.crearFilaVacia('Vacaciones', 'Permiso personal')];

  modalidadHorario: 'trabajo_casa' | 'reposicion_tiempo' | '' = '';
  condicionSalario: 'con_goce' | 'sin_goce' | '' = '';
  tipoAviso: 'coordinacion_anticipada' | 'aviso_posterior' | '' = '';
  tipoMotivoEspecial: 'igss' | 'vacaciones' | '' = 'vacaciones';

  diasDisponiblesVacaciones: number | null = null;
  observaciones = '';

  // Evidencia del porqué faltaron o van a faltar
  evidenciaDescripcion = '';
  evidencias: EvidenciaAdjunta[] = [];

  firmaColaborador = '';
  tieneFirmaDigital = false;
  nombreJefeInmediato = '';
  firmaJefeInmediato = '';

  cargando = false;
  mensajeError = '';
  mensajeExito = '';

  private dibujando = false;
  private ctx: CanvasRenderingContext2D | null = null;
  private dibujandoJefe = false;
  private ctxJefe: CanvasRenderingContext2D | null = null;

  ngOnInit(): void {
    this.cargarDatosColaborador();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inicializarCanvasFirma();
      this.inicializarCanvasFirmaJefe();
    }, 0);
  }

  private formatearTextoCantidad(cantidad: number, unidad: 'días' | 'horas'): string {
    const valorSeguro = Math.max(0.5, Number(cantidad) || 1);
    const esEntero = Number.isInteger(valorSeguro);
    const numTexto = esEntero ? String(valorSeguro) : String(valorSeguro);
    if (unidad === 'horas') {
      return `${numTexto} ${valorSeguro === 1 ? 'hora' : 'horas'}`;
    }
    return `${numTexto} ${valorSeguro === 1 ? 'día' : 'días'}`;
  }

  private crearFilaVacia(motivo = 'Vacaciones', tipoPermiso = 'Permiso personal'): DetalleAusenciaFila {
    const cantidadInicial = 1;
    const unidadInicial: 'días' | 'horas' = 'días';
    return {
      fecha_ausencia: '',
      horario_ausencia: this.opcionesHorarioLista[0],
      cantidad_solicitada: cantidadInicial,
      unidad_tiempo: unidadInicial,
      dias_horas_solicitadas: this.formatearTextoCantidad(cantidadInicial, unidadInicial),
      motivo,
      tipo_permiso: tipoPermiso,
    };
  }

  ajustarCantidadFila(index: number, delta: number): void {
    const fila = this.filas[index];
    if (!fila) return;
    const paso = fila.unidad_tiempo === 'horas' ? 1 : 0.5;
    const cambio = delta > 0 ? paso : -paso;
    const nuevaCantidad = Math.max(0.5, Number(((Number(fila.cantidad_solicitada) || 0) + cambio).toFixed(2)));
    fila.cantidad_solicitada = nuevaCantidad;
    fila.dias_horas_solicitadas = this.formatearTextoCantidad(nuevaCantidad, fila.unidad_tiempo);
  }

  alCambiarCantidadDirecta(index: number, valor: unknown): void {
    const fila = this.filas[index];
    if (!fila) return;
    const num = Number(valor);
    const cantidadSegura = Number.isFinite(num) && num >= 0.5 ? num : 0.5;
    fila.cantidad_solicitada = cantidadSegura;
    fila.dias_horas_solicitadas = this.formatearTextoCantidad(cantidadSegura, fila.unidad_tiempo);
  }

  alCambiarUnidadFila(index: number, unidad: 'días' | 'horas'): void {
    const fila = this.filas[index];
    if (!fila) return;
    fila.unidad_tiempo = unidad;
    const cantidadSegura = Math.max(0.5, Number(fila.cantidad_solicitada) || 1);
    fila.cantidad_solicitada = cantidadSegura;
    fila.dias_horas_solicitadas = this.formatearTextoCantidad(cantidadSegura, unidad);
  }

  alCambiarMotivoFila(index: number, valorSeleccionado: string): void {
    const fila = this.filas[index];
    if (!fila) return;
    fila.motivo = valorSeleccionado;

    if (valorSeleccionado === 'Vacaciones') {
      this.tipoMotivoEspecial = 'vacaciones';
    } else if (valorSeleccionado === 'IGSS') {
      this.tipoMotivoEspecial = 'igss';
      if (!fila.tipo_permiso) {
        fila.tipo_permiso = 'Permiso médico / Cita IGSS';
      }
    } else if (valorSeleccionado === 'Ausencia con trabajo desde casa en horario normal') {
      this.modalidadHorario = 'trabajo_casa';
    } else if (valorSeleccionado === 'Ausencia con reposición de tiempo fuera de horario laboral') {
      this.modalidadHorario = 'reposicion_tiempo';
    } else if (valorSeleccionado === 'Con goce de salario') {
      this.condicionSalario = 'con_goce';
    } else if (valorSeleccionado === 'Sin goce de salario') {
      this.condicionSalario = 'sin_goce';
    }
  }

  onSeleccionarEvidencias(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const archivos = input?.files;
    if (!archivos || archivos.length === 0) return;

    this.mensajeError = '';
    const maxBytes = 5 * 1024 * 1024; // 5 MB por archivo

    Array.from(archivos).forEach((archivo) => {
      if (archivo.size > maxBytes) {
        this.mensajeError = `El archivo "${archivo.name}" supera el límite de 5 MB.`;
        return;
      }

      const lector = new FileReader();
      lector.onload = () => {
        const resultado = typeof lector.result === 'string' ? lector.result : '';
        if (!resultado) return;

        const esImagen =
          archivo.type.startsWith('image/') ||
          /\.(png|jpe?g|gif|webp)$/i.test(archivo.name);

        const existe = this.evidencias.some(
          (item) => item.nombre === archivo.name && item.tamanoKb === Math.round(archivo.size / 1024)
        );
        if (existe) return;

        this.evidencias.push({
          nombre: archivo.name,
          tipo: archivo.type || 'archivo',
          tamanoKb: Math.max(1, Math.round(archivo.size / 1024)),
          dataUrl: resultado,
          esImagen,
        });
        this.cdr.detectChanges();
      };
      lector.readAsDataURL(archivo);
    });

    if (input) {
      input.value = '';
    }
  }

  eliminarEvidencia(index: number): void {
    this.evidencias.splice(index, 1);
  }

  private prepararCanvas(
    canvas: HTMLCanvasElement,
    fallbackHeight: number
  ): CanvasRenderingContext2D | null {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width || canvas.clientWidth || 320, 100);
    const height = Math.max(rect.height || canvas.clientHeight || fallbackHeight, 60);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.2;
    context.strokeStyle = '#0f294a';
    return context;
  }

  private inicializarCanvasFirma(): void {
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = this.prepararCanvas(canvas, 95);
  }

  private obtenerCoordenadas(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (event instanceof TouchEvent) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return {
        x: (touch?.clientX ?? rect.left) - rect.left,
        y: (touch?.clientY ?? rect.top) - rect.top,
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
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    if (
      !this.ctx ||
      canvas.width === 0 ||
      canvas.height === 0 ||
      (rect.width > 0 && Math.abs(canvas.width - Math.round(rect.width * ratio)) > 2)
    ) {
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
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.tieneFirmaDigital = true;
  }

  finalizarTrazo(): void {
    if (!this.dibujando) return;
    this.dibujando = false;
    if (this.ctx) {
      this.ctx.beginPath();
    }
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (canvas && this.tieneFirmaDigital) {
      this.firmaColaborador = canvas.toDataURL('image/png');
    }
  }

  limpiarFirma(): void {
    const canvas = this.firmaCanvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = this.prepararCanvas(canvas, 95);
    this.firmaColaborador = '';
    this.tieneFirmaDigital = false;
  }

  private inicializarCanvasFirmaJefe(): void {
    const canvas = this.firmaJefeCanvasRef?.nativeElement;
    if (!canvas) return;
    this.ctxJefe = this.prepararCanvas(canvas, 95);
  }

  private obtenerCoordenadasJefe(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.firmaJefeCanvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (event instanceof TouchEvent) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return {
        x: (touch?.clientX ?? rect.left) - rect.left,
        y: (touch?.clientY ?? rect.top) - rect.top,
      };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  iniciarTrazoJefe(event: MouseEvent | TouchEvent): void {
    if (event instanceof TouchEvent) {
      event.preventDefault();
    }
    const canvas = this.firmaJefeCanvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    if (
      !this.ctxJefe ||
      canvas.width === 0 ||
      canvas.height === 0 ||
      (rect.width > 0 && Math.abs(canvas.width - Math.round(rect.width * ratio)) > 2)
    ) {
      this.inicializarCanvasFirmaJefe();
    }
    if (!this.ctxJefe) return;

    const { x, y } = this.obtenerCoordenadasJefe(event);
    this.dibujandoJefe = true;
    this.ctxJefe.beginPath();
    this.ctxJefe.moveTo(x, y);
  }

  dibujarTrazoJefe(event: MouseEvent | TouchEvent): void {
    if (!this.dibujandoJefe || !this.ctxJefe) return;
    if (event instanceof TouchEvent) {
      event.preventDefault();
    }

    const { x, y } = this.obtenerCoordenadasJefe(event);
    this.ctxJefe.lineTo(x, y);
    this.ctxJefe.stroke();
    this.ctxJefe.beginPath();
    this.ctxJefe.moveTo(x, y);
  }

  finalizarTrazoJefe(): void {
    if (!this.dibujandoJefe) return;
    this.dibujandoJefe = false;
    if (this.ctxJefe) {
      this.ctxJefe.beginPath();
    }
    const canvas = this.firmaJefeCanvasRef?.nativeElement;
    if (canvas) {
      this.firmaJefeInmediato = canvas.toDataURL('image/png');
    }
  }

  limpiarFirmaJefe(): void {
    const canvas = this.firmaJefeCanvasRef?.nativeElement;
    if (!canvas) return;
    this.ctxJefe = this.prepararCanvas(canvas, 95);
    this.firmaJefeInmediato = '';
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

  private diasDeAnticipacion(fechaAusenciaISO: string): number {
    const [anioBase, mesBase, diaBase] = this.fechaActual.split('-').map(Number);
    const [anioAus, mesAus, diaAus] = fechaAusenciaISO.split('-').map(Number);

    if (!anioBase || !mesBase || !diaBase || !anioAus || !mesAus || !diaAus) {
      return 0;
    }

    const utcBase = Date.UTC(anioBase, mesBase - 1, diaBase);
    const utcAus = Date.UTC(anioAus, mesAus - 1, diaAus);
    const unDiaMs = 1000 * 60 * 60 * 24;

    return Math.round((utcAus - utcBase) / unDiaMs);
  }

  private calcularTotalDiasSolicitados(): number {
    return this.filas.reduce((acc, fila) => {
      const cantidad = Number(fila.cantidad_solicitada);
      if (Number.isFinite(cantidad) && cantidad > 0) {
        return acc + (fila.unidad_tiempo === 'horas' ? Number((cantidad / 8).toFixed(2)) : cantidad);
      }
      const texto = String(fila.dias_horas_solicitadas ?? '').trim().replace(',', '.');
      const match = texto.match(/(\d+(?:\.\d+)?)/);
      const num = match ? Number(match[1]) : 0;
      return acc + (Number.isFinite(num) && num > 0 ? num : 1);
    }, 0);
  }

  agregarFila(): void {
    this.filas.push(
      this.crearFilaVacia(
        this.filas[0]?.motivo || 'Vacaciones',
        this.filas[0]?.tipo_permiso || 'Permiso personal'
      )
    );
  }

  eliminarFila(index: number): void {
    if (this.filas.length > 1) {
      this.filas.splice(index, 1);
    }
  }

  enviarSolicitud(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    const u = this.usuario() as (UsuarioSesion & EmpleadoApiItem) | null;
    const filaInvalida = this.filas.some(
      (f) => !f.fecha_ausencia || !(Number(f.cantidad_solicitada) > 0)
    );

    if (filaInvalida) {
      this.mensajeError =
        'Complete al menos la fecha de ausencia y la cantidad de días u horas solicitadas en cada fila.';
      return;
    }

    for (const fila of this.filas) {
      const anticipacion = this.diasDeAnticipacion(fila.fecha_ausencia);

      if (anticipacion === 0) {
        this.mensajeError =
          'No se puede enviar la solicitud porque es del mismo día; tiene que enviarse con 3 días de anticipación antes de faltar.';
        return;
      }

      if (anticipacion < 3) {
        this.mensajeError =
          'No se puede enviar la solicitud: tiene que enviarse con 3 días de anticipación antes de faltar.';
        return;
      }
    }

    if (!this.tieneFirmaDigital || !this.firmaColaborador) {
      this.mensajeError =
        'Por favor realice su firma digital en el recuadro de Firma del colaborador.';
      return;
    }

    this.cargando = true;

    const filasNormalizadas = this.filas.map((f) => ({
      ...f,
      dias_horas_solicitadas: this.formatearTextoCantidad(
        Number(f.cantidad_solicitada) || 1,
        f.unidad_tiempo || 'días'
      ),
    }));

    const primeraFecha = filasNormalizadas[0]?.fecha_ausencia ?? this.fechaActual;
    const totalDias = this.calcularTotalDiasSolicitados();
    const empleadoIdResuelto = u?.empleado_id ?? u?.id ?? null;

    const payload = {
      empleado_id: empleadoIdResuelto,
      codigo_empleado: u?.codigo_empleado ?? '',
      nombre_colaborador: this.nombreColaborador,
      fecha_solicitud: this.fechaActual,
      fecha_disfrute: primeraFecha,
      dias_tomados: totalDias,
      motivo: filasNormalizadas[0]?.motivo || 'Vacaciones',
      tipo_permiso: filasNormalizadas[0]?.tipo_permiso || 'Permiso personal',
      sucursal: this.sucursalSignal(),
      cargo: this.cargoSignal(),
      detalle_ausencias: filasNormalizadas,
      seleccion_x: {
        modalidad_horario: this.modalidadHorario,
        condicion_salario: this.condicionSalario,
        tipo_aviso: this.tipoAviso,
        motivo_especial: this.tipoMotivoEspecial,
      },
      dias_disponibles_vacaciones: this.diasDisponiblesVacaciones,
      observaciones: this.observaciones.trim(),
      evidencia_descripcion: this.evidenciaDescripcion.trim(),
      evidencias: this.evidencias,
      firma_colaborador: this.firmaColaborador,
      nombre_jefe_inmediato: this.nombreJefeInmediato.trim(),
      firma_jefe_inmediato: this.firmaJefeInmediato.trim(),
    };

    this.http.post<any>(`${this.apiUrl}/vacaciones/solicitudes`, payload).subscribe({
      next: (res) => {
        this.cargando = false;
        this.mensajeExito = 'Solicitud de ausencia enviada correctamente.';
        const idCreado = res?.id ?? res?.data?.id ?? res?.registro?.id;
        setTimeout(() => {
          if (idCreado) {
            this.router.navigate(['/procesovacaciones'], {
              queryParams: { solicitudId: idCreado },
            });
          } else {
            this.router.navigate(['/procesovacaciones']);
          }
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