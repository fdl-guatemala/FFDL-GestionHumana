import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface NotificacionAusencia {
  id: number;
  solicitud_id?: number | null;
  solicitudId?: number | null;
  tipo_solicitud: string;
  destinatario_tipo: 'JEFE_INMEDIATO' | 'GESTION_HUMANA' | 'EMPLEADO';
  destinatario_referencia: string | null;
  titulo: string;
  mensaje: string;
  leida: number | boolean;
  creada_en: string;
  nombre_solicitante?: string;
  codigo_solicitante?: string;
  estado_aprobacion?: string;
}

@Component({
  selector: 'app-notificaciones-campana',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones-campana.html',
  styleUrl: './notificaciones-campana.css',
})
export class NotificacionesCampanaComponent
  implements OnInit, OnChanges, OnDestroy
{
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly apiUrl = 'http://localhost:3000/api';

  @Input() codigoUsuario = '';
  @Input() nombreUsuario = '';
  @Input() empleadoId: number | string | null = null;
  @Input() rolTipo: 'empleado' | 'jefe_inmediato' | 'gestion_humana' =
    'empleado';
  @Input() navegarAlSeleccionar = true;

  @Output() seleccionarSolicitud = new EventEmitter<number>();

  abierta = false;
  notificaciones: NotificacionAusencia[] = [];
  private intervaloPoll: ReturnType<typeof setInterval> | null = null;

  get noLeidasCount(): number {
    return this.notificaciones.filter((n) => !n.leida || n.leida === 0).length;
  }

  ngOnInit(): void {
    this.cargarNotificaciones();
    this.intervaloPoll = setInterval(() => this.cargarNotificaciones(), 10000);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['codigoUsuario'] ||
      changes['nombreUsuario'] ||
      changes['empleadoId'] ||
      changes['rolTipo']
    ) {
      this.cargarNotificaciones();
    }
  }

  ngOnDestroy(): void {
    if (this.intervaloPoll) {
      clearInterval(this.intervaloPoll);
      this.intervaloPoll = null;
    }
  }

  alternarPanel(): void {
    this.abierta = !this.abierta;
    if (this.abierta) {
      this.cargarNotificaciones();
    }
  }

  cargarNotificaciones(): void {
    const params = new URLSearchParams();
    if (this.codigoUsuario.trim()) {
      params.set('codigo', this.codigoUsuario.trim());
    }
    if (this.nombreUsuario.trim()) {
      params.set('nombre', this.nombreUsuario.trim());
    }
    if (this.empleadoId !== null && String(this.empleadoId).trim() !== '') {
      params.set('empleadoId', String(this.empleadoId).trim());
    }
    params.set('rolTipo', this.rolTipo);

    this.http
      .get<NotificacionAusencia[]>(
        `${this.apiUrl}/notificaciones?${params.toString()}`
      )
      .subscribe({
        next: (data) => {
          this.notificaciones = Array.isArray(data) ? data : [];
          this.cdr.detectChanges();
        },
        error: () => {
          // Mantiene la vista estable ante errores temporales de red
        },
      });
  }

  marcarComoLeida(notif: NotificacionAusencia, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    if (!notif.leida || notif.leida === 0) {
      notif.leida = 1;
      this.http
        .patch(`${this.apiUrl}/notificaciones/${notif.id}/leer`, {})
        .subscribe({
          next: () => this.cargarNotificaciones(),
          error: () => this.cargarNotificaciones(),
        });
    }
  }

  alHacerClicNotificacion(notif: NotificacionAusencia, event?: Event): void {
    this.marcarComoLeida(notif, event);
    this.abierta = false;

    const solicitudId = Number(
      notif.solicitud_id ?? notif.solicitudId ?? 0
    );

    if (solicitudId > 0) {
      this.seleccionarSolicitud.emit(solicitudId);

      if (this.navegarAlSeleccionar) {
        this.router.navigate(['/procesovacaciones'], {
          queryParams: { solicitudId },
        });
      }
    } else if (this.navegarAlSeleccionar) {
      this.router.navigate(['/procesovacaciones']);
    }
  }
}