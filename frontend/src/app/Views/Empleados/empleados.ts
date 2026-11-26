import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.services';

export interface MovimientoVacacion {
  no: number;
  fecha: string;
  horas_solicitadas?: string;
  tiempo_vacaciones: number;
  estado_constancia: string;
  observaciones?: string;
}

export interface PeriodoVacacionExpediente {
  id?: number | string;
  periodo_inicio: string;
  periodo_fin: string;
  dias_disponibles: number;
  total_dias_gozados: number;
  finiquito_vacaciones: string;
  movimientos?: MovimientoVacacion[];
}

export interface ExpedienteEmpleado {
  empleado_id?: number;
  codigo_empleado?: string;
  nombre: string;
  puesto: string;
  sucursal?: string;
  ingreso: string;
  egreso?: string | null;
  periodos: PeriodoVacacionExpediente[];
}

export interface FiniquitoGenerado {
  empleado_id: number;
  codigo_empleado: string;
  nombre_completo: string;
  puesto: string;
  jefe_inmediato: string;
  lugar: string;
  fecha_ingreso: string;
  fecha_egreso: string | null;
  estado: string;
  dias_vacaciones_disponibles: number;
  dias_vacaciones_requeridos: number;
  dias_descontados: number;
  fecha_generacion: string;
  concepto: string;
}

interface EmpleadoListadoItem {
  empleado_id?: number;
  id?: number;
  codigo_empleado?: string;
  nombre?: string;
  nombre_completo?: string;
  nombre_empleados?: string;
  puesto?: string;
  cargo?: string;
  sucursal?: string;
  lugar?: string;
  fecha_ingreso?: string;
  ingreso?: string;
  fecha_egreso?: string | null;
  egreso?: string | null;
  periodos?: PeriodoVacacionExpediente[];
}

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './empleados.html',
  styleUrl: './empleados.css'
})
export class EmpleadosComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  private readonly apiUrl = 'http://localhost:3000/api';
  private readonly diasVacacionesRequeridos = 15;
  readonly usuario = this.authService.usuarioActual;

  readonly expediente = signal<ExpedienteEmpleado | null>(null);
  readonly cargando = signal<boolean>(false);
  readonly errorMensaje = signal<string>('');
  readonly periodoActivoIndex = signal<number>(0);
  readonly generandoFiniquito = signal<boolean>(false);
  readonly finiquitoGenerado = signal<FiniquitoGenerado | null>(null);

  private codigoConsultadoActual = '';

  readonly periodoSeleccionado = computed<PeriodoVacacionExpediente | null>(() => {
    const exp = this.expediente();
    if (!exp || !exp.periodos || exp.periodos.length === 0) return null;
    const idx = this.periodoActivoIndex();
    return exp.periodos[idx] ?? exp.periodos[0];
  });

  readonly totalDiasDisponiblesGeneral = computed<number>(() => {
    const exp = this.expediente();
    if (!exp?.periodos?.length) return 0;
    return exp.periodos.reduce((acc, p) => acc + (Number(p.dias_disponibles) || 0), 0);
  });

  readonly totalDiasGozadosGeneral = computed<number>(() => {
    const exp = this.expediente();
    if (!exp?.periodos?.length) return 0;
    return exp.periodos.reduce((acc, p) => acc + (Number(p.total_dias_gozados) || 0), 0);
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const codigoParam = (params.get('codigo') ?? '').trim();
      this.codigoConsultadoActual = codigoParam;
      if (codigoParam) {
        this.cargarExpedientePorCodigo(codigoParam);
      } else {
        this.cargarMiExpediente();
      }
    });
  }

  private mapearEmpleadoAExpediente(
    emp: EmpleadoListadoItem,
    base?: Partial<ExpedienteEmpleado>
  ): ExpedienteEmpleado {
    const empleadoId = emp.empleado_id ?? emp.id ?? base?.empleado_id;
    const codigoEmp = String(emp.codigo_empleado ?? base?.codigo_empleado ?? '').trim();
    const nombre =
      emp.nombre_completo ||
      emp.nombre ||
      emp.nombre_empleados ||
      base?.nombre ||
      codigoEmp ||
      'Colaborador';

    return {
      empleado_id: empleadoId,
      codigo_empleado: codigoEmp,
      nombre,
      puesto: emp.puesto || emp.cargo || base?.puesto || 'Cargo no asignado',
      sucursal: emp.lugar || emp.sucursal || base?.sucursal || 'Sede no asignada',
      ingreso: emp.fecha_ingreso || emp.ingreso || base?.ingreso || '—',
      egreso: emp.fecha_egreso ?? emp.egreso ?? base?.egreso ?? '—',
      periodos: Array.isArray(emp.periodos) ? emp.periodos : (base?.periodos ?? []),
    };
  }

  cargarExpedientePorCodigo(codigo: string): void {
    const codigoLimpio = codigo.trim();
    if (!codigoLimpio) {
      this.cargarMiExpediente();
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set('');

    const fallbackPorCodigo: ExpedienteEmpleado = {
      codigo_empleado: codigoLimpio,
      nombre: `Empleado Código ${codigoLimpio}`,
      puesto: 'Cargo no asignado',
      sucursal: 'Sede no asignada',
      ingreso: '—',
      egreso: '—',
      periodos: [],
    };

    this.http
      .get<EmpleadoListadoItem[] | { data?: EmpleadoListadoItem[]; empleados?: EmpleadoListadoItem[] }>(
        `${this.apiUrl}/empleados`
      )
      .subscribe({
        next: (res) => {
          const lista = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.empleados)
                ? res.empleados
                : [];

          const codigoNorm = codigoLimpio.toLowerCase();
          const encontrado = lista.find(
            (item) => String(item.codigo_empleado ?? '').trim().toLowerCase() === codigoNorm
          );

          if (!encontrado) {
            this.expediente.set(fallbackPorCodigo);
            this.periodoActivoIndex.set(0);
            this.cargando.set(false);
            this.errorMensaje.set(`No se encontró ningún empleado con el código "${codigoLimpio}".`);
            return;
          }

          const baseExp = this.mapearEmpleadoAExpediente(encontrado, fallbackPorCodigo);
          const empId = encontrado.empleado_id ?? encontrado.id ?? '';
          const codEmp = encontrado.codigo_empleado ?? codigoLimpio;
          const query = `?empleado_id=${encodeURIComponent(String(empId))}&codigo_empleado=${encodeURIComponent(String(codEmp))}`;

          this.http
            .get<ExpedienteEmpleado | { data?: ExpedienteEmpleado }>(
              `${this.apiUrl}/empleados/mi-expediente${query}`
            )
            .subscribe({
              next: (expRes) => {
                const detalle =
                  (expRes as { data?: ExpedienteEmpleado })?.data ??
                  (expRes as ExpedienteEmpleado);

                this.expediente.set({
                  ...baseExp,
                  ...(detalle && typeof detalle === 'object' ? detalle : {}),
                  empleado_id: detalle?.empleado_id ?? baseExp.empleado_id,
                  codigo_empleado: detalle?.codigo_empleado ?? baseExp.codigo_empleado,
                  nombre: detalle?.nombre || baseExp.nombre,
                  puesto: detalle?.puesto || baseExp.puesto,
                  sucursal: detalle?.sucursal || baseExp.sucursal,
                  ingreso: detalle?.ingreso || baseExp.ingreso,
                  periodos: Array.isArray(detalle?.periodos)
                    ? detalle.periodos
                    : baseExp.periodos,
                });
                this.periodoActivoIndex.set(0);
                this.cargando.set(false);
              },
              error: () => {
                this.expediente.set(baseExp);
                this.periodoActivoIndex.set(0);
                this.cargando.set(false);
              },
            });
        },
        error: () => {
          this.expediente.set(fallbackPorCodigo);
          this.periodoActivoIndex.set(0);
          this.cargando.set(false);
          this.errorMensaje.set(
            `No se pudo consultar el empleado con código "${codigoLimpio}" desde el servidor.`
          );
        },
      });
  }

  cargarMiExpediente(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');

    const u = this.usuario();

    const fallbackExpediente: ExpedienteEmpleado = {
      empleado_id: u?.empleado_id,
      codigo_empleado: u?.codigo_empleado,
      nombre: u?.nombre_completo || u?.codigo_empleado || 'Colaborador',
      puesto: u?.puesto || 'Cargo no asignado',
      sucursal: u?.lugar || 'Sede no asignada',
      ingreso: '—',
      egreso: '—',
      periodos: []
    };

    const identificador = u?.empleado_id ?? u?.codigo_empleado ?? '';
    const query = identificador
      ? `?empleado_id=${encodeURIComponent(String(u?.empleado_id ?? ''))}&codigo_empleado=${encodeURIComponent(u?.codigo_empleado ?? '')}`
      : '';

    this.http
      .get<ExpedienteEmpleado | { data?: ExpedienteEmpleado }>(
        `${this.apiUrl}/empleados/mi-expediente${query}`
      )
      .subscribe({
        next: (res) => {
          const data = (res as { data?: ExpedienteEmpleado })?.data ?? (res as ExpedienteEmpleado);
          if (data && data.nombre) {
            this.expediente.set({
              ...fallbackExpediente,
              ...data,
              periodos: Array.isArray(data.periodos) ? data.periodos : []
            });
            this.periodoActivoIndex.set(0);
          } else {
            this.expediente.set(fallbackExpediente);
          }
          this.cargando.set(false);
        },
        error: () => {
          this.expediente.set(fallbackExpediente);
          this.cargando.set(false);
          this.errorMensaje.set(
            'Se muestran tus datos de sesión; no se pudo obtener el historial completo desde el servidor.'
          );
        }
      });
  }

  seleccionarPeriodo(index: number): void {
    this.periodoActivoIndex.set(index);
  }

  generarFiniquito(exp: ExpedienteEmpleado, descontarDias = false): void {
    const diasAcumulados = this.totalDiasDisponiblesGeneral();
    const empleadoId = Number(exp.empleado_id ?? this.usuario()?.empleado_id);

    if (diasAcumulados < this.diasVacacionesRequeridos) {
      this.errorMensaje.set(
        `Aún no cumples los ${this.diasVacacionesRequeridos} días de vacaciones requeridos (llevas ${diasAcumulados}).`
      );
      return;
    }

    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      this.errorMensaje.set('No se pudo identificar el ID del empleado para generar el finiquito.');
      return;
    }

    this.generandoFiniquito.set(true);
    this.errorMensaje.set('');

    this.http
      .post<{ message: string; finiquito: FiniquitoGenerado }>(
        `${this.apiUrl}/empleados/${empleadoId}/finiquito`,
        { descontar_dias: descontarDias }
      )
      .subscribe({
        next: (res) => {
          this.generandoFiniquito.set(false);
          this.finiquitoGenerado.set(res.finiquito);
          if (descontarDias) {
            if (this.codigoConsultadoActual) {
              this.cargarExpedientePorCodigo(this.codigoConsultadoActual);
            } else {
              this.cargarMiExpediente();
            }
          }
        },
        error: (err) => {
          this.generandoFiniquito.set(false);
          this.errorMensaje.set(
            err?.error?.message ?? 'No se pudo generar el finiquito.'
          );
        }
      });
  }

  cerrarFiniquito(): void {
    this.finiquitoGenerado.set(null);
  }
}