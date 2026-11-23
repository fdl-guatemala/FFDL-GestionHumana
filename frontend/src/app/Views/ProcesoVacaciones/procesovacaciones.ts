import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.services'; // Ajusta la ruta si es distinta

export interface SolicitudVacacionProceso {
  id: number | string;
  codigo_empleado?: string;
  nombre_colaborador?: string;
  sucursal?: string;
  cargo?: string;
  fecha_solicitud: string;
  rango_o_fechas: string;
  dias_horas: string;
  motivo: string;
  jefe_inmediato?: string;
  etapa_actual?: 1 | 2 | 3;
  estado_jefe?: 'Pendiente' | 'Aprobado' | 'Rechazado';
  estado_gh?: 'Pendiente' | 'Aprobado' | 'Rechazado';
  estado: 'Pendiente' | 'En revisión' | 'Aprobada' | 'Rechazada';
  observaciones?: string;
}

export interface PasoLineaTiempo {
  numero: number;
  titulo: string;
  subtitulo: string;
  mensaje: string;
  estadoPaso: 'completado' | 'actual' | 'pendiente' | 'rechazado';
}

@Component({
  selector: 'app-proceso-vacaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './procesovacaciones.html',
  styleUrl: './procesovacaciones.css'
})
export class ProcesoVacacionesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly apiUrl = 'http://localhost:3000/api';
  readonly usuario = this.authService.usuarioActual;

  readonly solicitudes = signal<SolicitudVacacionProceso[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly errorMensaje = signal<string>('');
  readonly filtroEstado = signal<string>('TODAS');
  readonly busqueda = signal<string>('');
  readonly solicitudSeleccionada = signal<SolicitudVacacionProceso | null>(null);

  readonly solicitudesFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const texto = this.busqueda().trim().toLowerCase();

    return this.solicitudes().filter((item) => {
      const coincideEstado = estado === 'TODAS' || item.estado === estado;
      const coincideTexto =
        !texto ||
        (item.motivo || '').toLowerCase().includes(texto) ||
        (item.rango_o_fechas || '').toLowerCase().includes(texto) ||
        (item.estado || '').toLowerCase().includes(texto) ||
        String(item.id).toLowerCase().includes(texto);

      return coincideEstado && coincideTexto;
    });
  });

  readonly totalPendientes = computed(
    () =>
      this.solicitudes().filter(
        (s) => s.estado === 'Pendiente' || s.estado === 'En revisión'
      ).length
  );

  readonly totalAprobadas = computed(
    () => this.solicitudes().filter((s) => s.estado === 'Aprobada').length
  );

  // Línea de tiempo dinámica de la solicitud activa
  readonly pasosLineaTiempo = computed<PasoLineaTiempo[]>(() => {
    const det = this.solicitudSeleccionada();
    const u = this.usuario();

    const nombreEmpleado =
      det?.nombre_colaborador ||
      u?.nombre_completo ||
      u?.codigo_empleado ||
      'Colaborador';

    const nombreJefe =
      det?.jefe_inmediato ||
      (u as { nombre_jefe_inmediato?: string; jefe_inmediato?: string } | null)
        ?.nombre_jefe_inmediato ||
      (u as { jefe_inmediato?: string } | null)?.jefe_inmediato ||
      'tu jefe inmediato';

    if (!det) {
      return [
        {
          numero: 1,
          titulo: 'Llenado de formulario',
          subtitulo: 'Registro inicial',
          mensaje: `${nombreEmpleado}, aquí verás la confirmación cuando llenes y envíes tu formulario.`,
          estadoPaso: 'pendiente'
        },
        {
          numero: 2,
          titulo: 'Jefe inmediato',
          subtitulo: 'Vo. Bo. y autorización',
          mensaje: `Tu solicitud será revisada por ${nombreJefe}.`,
          estadoPaso: 'pendiente'
        },
        {
          numero: 3,
          titulo: 'Gestión Humana',
          subtitulo: 'Validación final y registro',
          mensaje: 'Gestión Humana validará tus días disponibles y finalizará el proceso.',
          estadoPaso: 'pendiente'
        }
      ];
    }

    // Determinar estados por etapa según campos del backend o estado general
    const jefeAprobado =
      det.estado_jefe === 'Aprobado' ||
      det.estado === 'En revisión' ||
      det.estado === 'Aprobada';

    const jefeRechazado =
      det.estado_jefe === 'Rechazado' ||
      (det.estado === 'Rechazada' && det.estado_gh !== 'Rechazado');

    const ghAprobado =
      det.estado_gh === 'Aprobado' || det.estado === 'Aprobada';

    const ghRechazado =
      det.estado_gh === 'Rechazado' ||
      (det.estado === 'Rechazada' && jefeAprobado);

    // Paso 1: Llenado de formulario (si existe la solicitud, ya fue enviado)
    const paso1: PasoLineaTiempo = {
      numero: 1,
      titulo: 'Llenado de formulario',
      subtitulo: `Enviado el ${det.fecha_solicitud}`,
      mensaje: `${nombreEmpleado} has llenado el formulario, fue enviado a tu jefe inmediato (${nombreJefe}).`,
      estadoPaso: 'completado'
    };

    // Paso 2: Jefe inmediato
    let paso2: PasoLineaTiempo;
    if (jefeRechazado) {
      paso2 = {
        numero: 2,
        titulo: 'Jefe inmediato',
        subtitulo: 'Solicitud no autorizada',
        mensaje: `${nombreJefe} ha rechazado la solicitud. Revisa las observaciones para más detalle.`,
        estadoPaso: 'rechazado'
      };
    } else if (jefeAprobado) {
      paso2 = {
        numero: 2,
        titulo: 'Jefe inmediato',
        subtitulo: 'Vo. Bo. aprobado',
        mensaje: `${nombreJefe} ha aprobado tu solicitud y la envió a Gestión Humana para su validación final.`,
        estadoPaso: 'completado'
      };
    } else {
      paso2 = {
        numero: 2,
        titulo: 'Jefe inmediato',
        subtitulo: 'En espera de Vo. Bo.',
        mensaje: `Tu solicitud está en manos de ${nombreJefe} pendiente de revisión y visto bueno.`,
        estadoPaso: 'actual'
      };
    }

    // Paso 3: Gestión Humana
    let paso3: PasoLineaTiempo;
    if (jefeRechazado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Proceso detenido',
        mensaje: 'La solicitud no llegó a Gestión Humana debido a que fue rechazada en la etapa anterior.',
        estadoPaso: 'pendiente'
      };
    } else if (ghRechazado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Observada / Rechazada',
        mensaje: `Gestión Humana ha rechazado la solicitud de ${nombreEmpleado}. Consulta las observaciones.`,
        estadoPaso: 'rechazado'
      };
    } else if (ghAprobado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Proceso finalizado',
        mensaje: `¡Listo, ${nombreEmpleado}! Gestión Humana aprobó y registró tus vacaciones correctamente.`,
        estadoPaso: 'completado'
      };
    } else if (jefeAprobado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'En validación',
        mensaje: `Gestión Humana recibió el Vo. Bo. de ${nombreJefe} y está verificando tus días disponibles.`,
        estadoPaso: 'actual'
      };
    } else {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Pendiente',
        mensaje: 'En espera de que tu jefe inmediato envíe la autorización a Gestión Humana.',
        estadoPaso: 'pendiente'
      };
    }

    return [paso1, paso2, paso3];
  });

  ngOnInit(): void {
    this.cargarSolicitudes();
  }

  cargarSolicitudes(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');

    const u = this.usuario();
    const query = u?.codigo_empleado
      ? `?codigo_empleado=${encodeURIComponent(u.codigo_empleado)}`
      : '';

    this.http
      .get<SolicitudVacacionProceso[] | { data?: SolicitudVacacionProceso[] }>(
        `${this.apiUrl}/vacaciones/proceso${query}`
      )
      .subscribe({
        next: (res) => {
          const lista = Array.isArray(res) ? res : res?.data ?? [];
          this.solicitudes.set(lista);
          if (lista.length > 0 && !this.solicitudSeleccionada()) {
            this.solicitudSeleccionada.set(lista[0]);
          }
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.errorMensaje.set(
            'No se pudieron cargar las solicitudes desde el servidor. Verifica el endpoint de proceso de vacaciones.'
          );
        }
      });
  }

  seleccionarSolicitud(item: SolicitudVacacionProceso): void {
    this.solicitudSeleccionada.set(item);
  }
}