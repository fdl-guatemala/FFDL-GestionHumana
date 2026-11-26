import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.services';

export interface SolicitudVacacionProceso {
  id: number | string;
  codigo_empleado?: string;
  empleado_id?: number | string;
  nombre_colaborador?: string;
  sucursal?: string;
  cargo?: string;
  fecha_solicitud: string;
  rango_o_fechas: string;
  dias_horas: string;
  motivo: string;
  jefe_inmediato?: string;
  etapa_actual?: 1 | 2 | 3 | 4;
  estado_jefe?: 'Pendiente' | 'Aprobado' | 'Rechazado';
  estado_evidencia?: 'Pendiente' | 'Enviada';
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
  styleUrl: './procesovacaciones.css',
})
export class ProcesoVacacionesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private readonly apiUrl = 'http://localhost:3000/api';
  readonly usuario = this.authService.usuarioActual;

  readonly solicitudes = signal<SolicitudVacacionProceso[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly procesandoAprobacion = signal<boolean>(false);
  readonly mostrarPanelEvidencia = signal<boolean>(false);
  readonly enviandoEvidencia = signal<boolean>(false);
  readonly errorMensaje = signal<string>('');
  readonly estadoFeedback = signal<string>('');
  readonly filtroEstado = signal<string>('TODAS');
  readonly busqueda = signal<string>('');
  readonly solicitudSeleccionada = signal<SolicitudVacacionProceso | null>(null);

  observacionesAprobacion = '';
  firmaTextoAprobacion = '';

  evidenciaNombre = '';
  evidenciaUrl = '';
  evidenciaObservaciones = '';
  evidenciaArchivoNombre = '';
  evidenciaArchivoTipo = '';
  evidenciaBase64: string | null = null;
  sinEvidenciaAdjunta = false;

  private solicitudIdDesdeUrl: number | null = null;

  readonly solicitudesFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const texto = this.busqueda().trim().toLowerCase();

    return this.solicitudes().filter((item) => {
      const coincideEstado = estado === 'TODAS' || item.estado === estado;
      const coincideTexto =
        !texto ||
        (item.motivo || '').toLowerCase().includes(texto) ||
        (item.rango_o_fechas || '').toLowerCase().includes(texto) ||
        (item.nombre_colaborador || '').toLowerCase().includes(texto) ||
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

  readonly puedeEnviarEvidencia = computed(() => {
    const det = this.solicitudSeleccionada();
    if (!det) return false;
    if (det.estado === 'Aprobada' || det.estado === 'Rechazada') {
      return false;
    }
    return (
      det.estado_jefe === 'Aprobado' && det.estado_evidencia !== 'Enviada'
    );
  });

  readonly puedeAprobarJefe = computed(() => {
    const det = this.solicitudSeleccionada();
    if (!det) return false;
    if (
      det.estado === 'Aprobada' ||
      det.estado === 'Rechazada' ||
      det.estado_jefe === 'Aprobado'
    ) {
      return false;
    }
    return this.esJefeInmediatoDeSolicitud(det);
  });

  readonly puedeAprobarGestionHumana = computed(() => {
    const det = this.solicitudSeleccionada();
    if (!det) return false;
    if (
      det.estado === 'Aprobada' ||
      det.estado === 'Rechazada' ||
      det.estado_gh === 'Aprobado'
    ) {
      return false;
    }
    return (
      this.esUsuarioGestionHumana() &&
      det.estado_jefe === 'Aprobado' &&
      det.estado_evidencia === 'Enviada'
    );
  });

  readonly pasosLineaTiempo = computed<PasoLineaTiempo[]>(() => {
    const det = this.solicitudSeleccionada();
    const u: any = this.usuario();

    const nombreEmpleado =
      det?.nombre_colaborador ||
      u?.nombre_completo ||
      u?.nombre ||
      u?.nombre_empleados ||
      u?.codigo_empleado ||
      'Colaborador';

    const nombreJefe =
      det?.jefe_inmediato ||
      u?.nombre_jefe_inmediato ||
      u?.jefe_inmediato ||
      'su jefe inmediato';

    if (!det) {
      return [
        {
          numero: 1,
          titulo: 'Llenado de formulario',
          subtitulo: 'Registro inicial',
          mensaje: `${nombreEmpleado}, aquí verás la confirmación cuando llenes y envíes tu formulario.`,
          estadoPaso: 'pendiente',
        },
        {
          numero: 2,
          titulo: 'Jefe inmediato',
          subtitulo: 'Vo. Bo. y autorización',
          mensaje: `Tu solicitud será revisada por ${nombreJefe}.`,
          estadoPaso: 'pendiente',
        },
        {
          numero: 3,
          titulo: 'Evidencia del colaborador',
          subtitulo: 'Carga de soporte',
          mensaje: `Tras aprobar ${nombreJefe}, ${nombreEmpleado} enviará su evidencia si aplica.`,
          estadoPaso: 'pendiente',
        },
        {
          numero: 4,
          titulo: 'Gestión Humana',
          subtitulo: 'Validación final y registro',
          mensaje:
            'Gestión Humana validará la evidencia y los días disponibles para la aprobación final.',
          estadoPaso: 'pendiente',
        },
      ];
    }

    const jefeRechazado =
      det.estado_jefe === 'Rechazado' ||
      (det.estado === 'Rechazada' && det.estado_gh !== 'Rechazado');

    const jefeAprobado =
      !jefeRechazado &&
      (det.estado_jefe === 'Aprobado' || det.estado === 'Aprobada');

    const evidenciaEnviada =
      jefeAprobado &&
      (det.estado_evidencia === 'Enviada' || det.estado === 'Aprobada');

    const ghRechazado =
      det.estado_gh === 'Rechazado' ||
      (det.estado === 'Rechazada' && evidenciaEnviada);

    const ghAprobado = !ghRechazado && det.estado === 'Aprobada';

    const paso1: PasoLineaTiempo = {
      numero: 1,
      titulo: 'Llenado de formulario',
      subtitulo: `Enviado el ${det.fecha_solicitud || 'recientemente'}`,
      mensaje: `${nombreEmpleado} ha llenado el formulario y fue enviado a ${nombreJefe}.`,
      estadoPaso: 'completado',
    };

    const paso2: PasoLineaTiempo = jefeRechazado
      ? {
          numero: 2,
          titulo: 'Jefe inmediato',
          subtitulo: 'Solicitud no autorizada',
          mensaje: `${nombreJefe} ha rechazado la solicitud. Revisa las observaciones para más detalle.`,
          estadoPaso: 'rechazado',
        }
      : jefeAprobado
        ? {
            numero: 2,
            titulo: 'Jefe inmediato',
            subtitulo: 'Vo. Bo. aprobado',
            mensaje: `${nombreJefe} aprobó la solicitud y pasó al turno de evidencia de ${nombreEmpleado}.`,
            estadoPaso: 'completado',
          }
        : {
            numero: 2,
            titulo: 'Jefe inmediato',
            subtitulo: 'En espera de Vo. Bo.',
            mensaje: `La solicitud está en manos de ${nombreJefe} pendiente de revisión y visto bueno.`,
            estadoPaso: 'actual',
          };

    const paso3: PasoLineaTiempo = jefeRechazado
      ? {
          numero: 3,
          titulo: 'Evidencia del colaborador',
          subtitulo: 'Proceso detenido',
          mensaje: 'No aplica porque la solicitud fue rechazada por el jefe inmediato.',
          estadoPaso: 'pendiente',
        }
      : !jefeAprobado
        ? {
            numero: 3,
            titulo: 'Evidencia del colaborador',
            subtitulo: 'Pendiente',
            mensaje: `Se habilita después de que ${nombreJefe} apruebe la solicitud.`,
            estadoPaso: 'pendiente',
          }
        : evidenciaEnviada
          ? {
              numero: 3,
              titulo: 'Evidencia del colaborador',
              subtitulo: 'Evidencia enviada',
              mensaje: `${nombreEmpleado} completó/envió su evidencia y pasó a Gestión Humana.`,
              estadoPaso: 'completado',
            }
          : {
              numero: 3,
              titulo: 'Evidencia del colaborador',
              subtitulo: 'Pendiente de evidencia',
              mensaje: `Turno de ${nombreEmpleado} para subir su evidencia (si aplica) antes de Gestión Humana.`,
              estadoPaso: 'actual',
            };

    const paso4: PasoLineaTiempo = jefeRechazado
      ? {
          numero: 4,
          titulo: 'Gestión Humana',
          subtitulo: 'Proceso detenido',
          mensaje: 'La solicitud no llegó a Gestión Humana debido a que fue rechazada antes.',
          estadoPaso: 'pendiente',
        }
      : ghRechazado
        ? {
            numero: 4,
            titulo: 'Gestión Humana',
            subtitulo: 'Observada / Rechazada',
            mensaje: `Gestión Humana ha rechazado la solicitud de ${nombreEmpleado}.`,
            estadoPaso: 'rechazado',
          }
        : ghAprobado
          ? {
              numero: 4,
              titulo: 'Gestión Humana',
              subtitulo: 'Aprobación final',
              mensaje: `¡Listo, ${nombreEmpleado}! Gestión Humana aprobó definitivamente y registró las vacaciones.`,
              estadoPaso: 'completado',
            }
          : evidenciaEnviada
            ? {
                numero: 4,
                titulo: 'Gestión Humana',
                subtitulo: 'En validación final',
                mensaje: 'Gestión Humana está revisando la evidencia y los días para dar la aprobación final.',
                estadoPaso: 'actual',
              }
            : {
                numero: 4,
                titulo: 'Gestión Humana',
                subtitulo: 'En espera de evidencia',
                mensaje: `En espera de que ${nombreEmpleado} envíe su evidencia para pasar a Gestión Humana.`,
                estadoPaso: 'pendiente',
              };

    return [paso1, paso2, paso3, paso4];
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const rawId = params.get('solicitudId') ?? params.get('id');
      const parsedId = Number(rawId);
      this.solicitudIdDesdeUrl =
        Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

      if (this.solicitudIdDesdeUrl) {
        this.seleccionarPorIdSiExiste(this.solicitudIdDesdeUrl);
      }
    });

    this.cargarSolicitudes();
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private resolverJefePorJerarquia(raw: any, nombreColab: string): string {
    const jefeBackend = String(
      raw?.jefe_inmediato ?? raw?.nombre_jefe_inmediato ?? ''
    ).trim();
    if (jefeBackend) return jefeBackend;

    const colabNorm = this.normalizarTexto(nombreColab);
    const codEmp = String(raw?.codigo_empleado ?? raw?.empleado_id ?? '').trim();

    if (colabNorm.includes('mildred')) {
      return 'Eva Maritza Gómez Osorio de Aroche';
    }
    if (
      codEmp === '410' ||
      (colabNorm.includes('eva') && colabNorm.includes('maritza'))
    ) {
      return 'Gloria Esperanza del Carmen Zarazúa Sesam';
    }
    return '';
  }

  private esUsuarioGestionHumana(): boolean {
    const u: any = this.usuario();
    const rolNorm = this.normalizarTexto(
      u?.rol ?? u?.rol_tipo ?? u?.tipo_usuario ?? u?.rol_nombre ?? ''
    );
    const puestoNorm = this.normalizarTexto(u?.puesto ?? u?.cargo ?? '');

    return (
      rolNorm.includes('gestion humana') ||
      rolNorm.includes('recursos humanos') ||
      rolNorm === 'gh' ||
      rolNorm === 'rrhh' ||
      puestoNorm.includes('gestion humana')
    );
  }

  private esJefeInmediatoDeSolicitud(
    det: SolicitudVacacionProceso | null
  ): boolean {
    if (!det) return false;
    const u: any = this.usuario();
    if (!u) return false;

    const jefeSolicitudNorm = this.normalizarTexto(det.jefe_inmediato ?? '');
    if (!jefeSolicitudNorm) return false;

    const candidatosUsuario = [
      u?.nombre_completo,
      u?.nombre,
      u?.nombre_empleados,
      u?.usuario,
      u?.codigo_empleado,
      u?.codigo,
    ]
      .map((v) => this.normalizarTexto(v))
      .filter((v) => v.length > 0);

    return candidatosUsuario.some(
      (cand) =>
        jefeSolicitudNorm === cand ||
        (cand.length >= 5 && jefeSolicitudNorm.includes(cand)) ||
        (jefeSolicitudNorm.length >= 5 && cand.includes(jefeSolicitudNorm))
    );
  }

  private perteneceAlUsuarioActual(item: SolicitudVacacionProceso): boolean {
    const u: any = this.usuario();
    if (!u) return true;

    const idsUsuario = new Set(
      [u?.empleado_id, u?.id]
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    );

    const codigosUsuario = new Set(
      [u?.codigo_empleado, u?.codigo]
        .map((v) => this.normalizarTexto(v))
        .filter(Boolean)
    );

    const nombresUsuario = [
      u?.nombre_completo,
      u?.nombre,
      u?.nombre_empleados,
      u?.nombre_empleado,
    ]
      .map((v) => this.normalizarTexto(v))
      .filter(Boolean);

    if (
      idsUsuario.size === 0 &&
      codigosUsuario.size === 0 &&
      nombresUsuario.length === 0
    ) {
      return true;
    }

    const idItem = Number(item.empleado_id ?? 0);
    if (idItem > 0 && idsUsuario.has(idItem)) {
      return true;
    }

    const codigosItem = [item.codigo_empleado, item.empleado_id]
      .map((v) => this.normalizarTexto(v))
      .filter(Boolean);

    if (codigosItem.some((c) => codigosUsuario.has(c))) {
      return true;
    }

    const nombreItem = this.normalizarTexto(item.nombre_colaborador ?? '');
    if (nombreItem && nombresUsuario.length > 0) {
      const coincideNombre = nombresUsuario.some((nomU) => {
        if (
          nombreItem === nomU ||
          (nomU.length >= 4 && nombreItem.includes(nomU)) ||
          (nombreItem.length >= 4 && nomU.includes(nombreItem))
        ) {
          return true;
        }
        const partesU = nomU.split(' ').filter((p) => p.length >= 3);
        const partesI = new Set(
          nombreItem.split(' ').filter((p) => p.length >= 3)
        );
        if (partesU.length >= 2 && partesI.size >= 2) {
          const coincidencias = partesU.filter((p) => partesI.has(p)).length;
          return coincidencias >= 2;
        }
        return false;
      });
      if (coincideNombre) {
        return true;
      }
    }

    return false;
  }

  private normalizarItem(raw: any): SolicitudVacacionProceso {
    const lineaEtapa = String(
      raw?.linea_proceso?.etapa_actual ?? raw?.etapa_flujo ?? ''
    ).toUpperCase();
    const fechaBase = String(
      raw?.fecha_solicitud ?? raw?.fecha_disfrute ?? ''
    ).slice(0, 10);

    const idResuelto = raw?.id ?? raw?.solicitud_id;

    const estadoRaw = String(raw?.estado ?? raw?.estado_constancia ?? '')
      .trim()
      .toLowerCase();
    const estadoJefeRaw = String(raw?.estado_jefe ?? '')
      .trim()
      .toLowerCase();
    const estadoGhRaw = String(raw?.estado_gh ?? '')
      .trim()
      .toLowerCase();

    const ghAprobadoReal =
      estadoGhRaw === 'aprobado' ||
      lineaEtapa === 'APROBADA' ||
      estadoRaw === 'aprobada';

    const jefeAprobadoReal =
      ghAprobadoReal ||
      estadoJefeRaw === 'aprobado' ||
      lineaEtapa === 'PENDIENTE_EVIDENCIA' ||
      lineaEtapa === 'PENDIENTE_GH' ||
      lineaEtapa === 'GESTION_HUMANA';

    const evidenciaEnviadaReal =
      ghAprobadoReal ||
      Boolean(raw?.evidencia_enviada) ||
      String(raw?.estado_evidencia ?? '').toLowerCase() === 'enviada' ||
      lineaEtapa === 'PENDIENTE_GH' ||
      lineaEtapa === 'GESTION_HUMANA';

    const estadoJefe: SolicitudVacacionProceso['estado_jefe'] =
      estadoJefeRaw === 'rechazado'
        ? 'Rechazado'
        : jefeAprobadoReal
          ? 'Aprobado'
          : 'Pendiente';

    const estadoEvidencia: SolicitudVacacionProceso['estado_evidencia'] =
      evidenciaEnviadaReal ? 'Enviada' : 'Pendiente';

    const estadoGh: SolicitudVacacionProceso['estado_gh'] =
      estadoGhRaw === 'rechazado'
        ? 'Rechazado'
        : ghAprobadoReal
          ? 'Aprobado'
          : 'Pendiente';

    let estado: SolicitudVacacionProceso['estado'] = 'Pendiente';
    if (
      lineaEtapa === 'RECHAZADA' ||
      estadoRaw === 'rechazada' ||
      estadoRaw === 'rechazado' ||
      estadoJefe === 'Rechazado' ||
      estadoGh === 'Rechazado'
    ) {
      estado = 'Rechazada';
    } else if (ghAprobadoReal) {
      estado = 'Aprobada';
    } else if (jefeAprobadoReal) {
      estado = 'En revisión';
    }

    const nombreColaborador =
      raw?.nombre_colaborador ??
      raw?.nombre_completo ??
      raw?.nombre_solicitante ??
      raw?.nombre_empleados ??
      '';

    const motivoLimpio =
      String(raw?.motivo ?? '').trim() ||
      String(raw?.observaciones ?? '').trim() ||
      'Vacaciones';

    return {
      id: idResuelto,
      codigo_empleado:
        raw?.codigo_empleado ?? (raw?.empleado_id ? String(raw.empleado_id) : ''),
      empleado_id: raw?.empleado_id,
      nombre_colaborador: nombreColaborador,
      sucursal: raw?.sucursal ?? raw?.lugar ?? '',
      cargo: raw?.cargo ?? raw?.puesto ?? '',
      fecha_solicitud: fechaBase,
      rango_o_fechas:
        raw?.rango_o_fechas ??
        (raw?.fecha_disfrute ? String(raw.fecha_disfrute).slice(0, 10) : ''),
      dias_horas:
        raw?.dias_horas ??
        (raw?.dias_tomados !== undefined ? `${raw.dias_tomados} día(s)` : ''),
      motivo: motivoLimpio,
      jefe_inmediato: this.resolverJefePorJerarquia(raw, nombreColaborador),
      etapa_actual: ghAprobadoReal
        ? 4
        : evidenciaEnviadaReal
          ? 4
          : jefeAprobadoReal
            ? 3
            : 1,
      estado_jefe: estadoJefe,
      estado_evidencia: estadoEvidencia,
      estado_gh: estadoGh,
      estado,
      observaciones: raw?.observaciones ?? '',
    };
  }

  private seleccionarPorIdSiExiste(id: number): void {
    const encontrada = this.solicitudes().find((s) => Number(s.id) === id);
    if (encontrada) {
      this.solicitudSeleccionada.set(encontrada);
    }

    this.http
      .get<any>(`${this.apiUrl}/vacaciones/${id}`)
      .pipe(catchError(() => of(null)))
      .subscribe((detalle) => {
        const raw = detalle?.data ?? detalle?.registro ?? detalle;
        if (raw && (raw.id !== undefined || raw.solicitud_id !== undefined)) {
          const item = this.normalizarItem({
            ...raw,
            id: raw.id ?? raw.solicitud_id ?? id,
          });
          if (!this.perteneceAlUsuarioActual(item)) {
            return;
          }
          this.solicitudSeleccionada.set(item);
          this.solicitudes.update((prev) => {
            const existe = prev.some((s) => Number(s.id) === Number(item.id));
            return existe ? prev : [item, ...prev];
          });
        }
      });
  }

  cargarSolicitudes(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');

    this.http
      .get<any>(`${this.apiUrl}/vacaciones`)
      .pipe(catchError(() => of([])))
      .subscribe({
        next: (res) => {
          const rawLista = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.registros)
                ? res.registros
                : Array.isArray(res?.solicitudes)
                  ? res.solicitudes
                  : [];

          const lista: SolicitudVacacionProceso[] = rawLista
            .map((item: any) => this.normalizarItem(item))
            .filter((item: SolicitudVacacionProceso) =>
              this.perteneceAlUsuarioActual(item)
            );
          this.solicitudes.set(lista);

          if (this.solicitudIdDesdeUrl) {
            const match = lista.find(
              (s: SolicitudVacacionProceso) =>
                Number(s.id) === this.solicitudIdDesdeUrl
            );
            if (match) {
              this.solicitudSeleccionada.set(match);
            } else {
              this.seleccionarPorIdSiExiste(this.solicitudIdDesdeUrl);
            }
          } else if (lista.length > 0) {
            const actualSel = this.solicitudSeleccionada();
            const actualizadaSel = actualSel
              ? lista.find(
                  (item: SolicitudVacacionProceso) =>
                    Number(item.id) === Number(actualSel.id)
                )
              : undefined;
            this.solicitudSeleccionada.set(actualizadaSel ?? lista[0]);
          } else {
            this.solicitudSeleccionada.set(null);
          }

          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.errorMensaje.set(
            'No se pudieron cargar las solicitudes desde el servidor.'
          );
        },
      });
  }

  seleccionarSolicitud(item: SolicitudVacacionProceso): void {
    this.solicitudSeleccionada.set(item);
    this.mostrarPanelEvidencia.set(false);
    this.estadoFeedback.set('');
    this.errorMensaje.set('');

    const idNum = Number(item.id);
    if (Number.isInteger(idNum) && idNum > 0) {
      this.seleccionarPorIdSiExiste(idNum);
    }
  }

  alternarPanelEvidencia(): void {
    this.errorMensaje.set('');
    this.estadoFeedback.set('');
    this.mostrarPanelEvidencia.update((v) => !v);
  }

  onArchivoEvidenciaSeleccionado(event: Event): void {
    this.errorMensaje.set('');
    const input = event.target as HTMLInputElement;
    const archivo = input?.files?.[0];
    if (!archivo) {
      this.evidenciaArchivoNombre = '';
      this.evidenciaArchivoTipo = '';
      this.evidenciaBase64 = null;
      return;
    }

    const maxBytes = 3 * 1024 * 1024;
    if (archivo.size > maxBytes) {
      input.value = '';
      this.evidenciaArchivoNombre = '';
      this.evidenciaArchivoTipo = '';
      this.evidenciaBase64 = null;
      this.errorMensaje.set(
        'El documento supera el límite de 3 MB. Selecciona un archivo más ligero.'
      );
      return;
    }

    this.evidenciaArchivoNombre = archivo.name;
    this.evidenciaArchivoTipo = archivo.type || 'application/octet-stream';
    if (!this.evidenciaNombre.trim()) {
      this.evidenciaNombre = archivo.name;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.evidenciaBase64 =
        typeof reader.result === 'string' ? reader.result : null;
    };
    reader.onerror = () => {
      this.errorMensaje.set('No se pudo leer el documento seleccionado.');
    };
    reader.readAsDataURL(archivo);
  }

  enviarEvidenciaAGestionHumana(): void {
    const actual = this.solicitudSeleccionada();
    const id = Number(actual?.id ?? 0);
    if (!actual || !id) return;

    const u: any = this.usuario();
    const remitente =
      u?.nombre_completo ||
      u?.nombre ||
      actual.nombre_colaborador ||
      'Colaborador';

    const nombreFinal =
      this.evidenciaNombre.trim() || this.evidenciaArchivoNombre || null;

    this.enviandoEvidencia.set(true);
    this.errorMensaje.set('');
    this.estadoFeedback.set('');

    this.http
      .post<any>(`${this.apiUrl}/vacaciones/${id}/evidencia`, {
        evidencia_nombre: nombreFinal,
        evidencia_url: this.evidenciaUrl.trim() || null,
        evidencia_base64: this.evidenciaBase64,
        observaciones: this.evidenciaObservaciones.trim() || null,
        sin_evidencia:
          this.sinEvidenciaAdjunta && !nombreFinal && !this.evidenciaBase64,
        enviado_por: remitente,
      })
      .subscribe({
        next: (res) => {
          const regBackend = res?.registro ?? {};
          const actualizada: SolicitudVacacionProceso = {
            ...actual,
            estado_jefe: 'Aprobado',
            estado_evidencia: 'Enviada',
            estado_gh: 'Pendiente',
            estado: 'En revisión',
            etapa_actual: 4,
            observaciones: regBackend?.observaciones ?? actual.observaciones,
          };

          this.solicitudSeleccionada.set(actualizada);
          this.solicitudes.update((prev) =>
            prev.map((s) => (Number(s.id) === id ? actualizada : s))
          );
          this.evidenciaNombre = '';
          this.evidenciaUrl = '';
          this.evidenciaObservaciones = '';
          this.evidenciaArchivoNombre = '';
          this.evidenciaArchivoTipo = '';
          this.evidenciaBase64 = null;
          this.sinEvidenciaAdjunta = false;
          this.mostrarPanelEvidencia.set(false);
          this.enviandoEvidencia.set(false);
          this.estadoFeedback.set(
            'Documento y evidencia enviados. La solicitud ya pasó a Gestión Humana para su aprobación final.'
          );
        },
        error: (err) => {
          this.enviandoEvidencia.set(false);
          this.errorMensaje.set(
            err?.error?.message ||
              'No se pudo enviar la evidencia hacia Gestión Humana.'
          );
        },
      });
  }

  aprobarComoJefeInmediato(): void {
    const actual = this.solicitudSeleccionada();
    const id = Number(actual?.id ?? 0);
    if (!actual || !id) return;

    const u: any = this.usuario();
    const aprobador =
      u?.nombre_completo ||
      u?.nombre ||
      actual.jefe_inmediato ||
      'Jefe Inmediato';

    this.procesandoAprobacion.set(true);
    this.estadoFeedback.set('');
    this.errorMensaje.set('');

    this.http
      .post<any>(`${this.apiUrl}/vacaciones/${id}/aprobar-jefe`, {
        aprobado_por: aprobador,
        observaciones: this.observacionesAprobacion.trim() || undefined,
        firma_texto: this.firmaTextoAprobacion.trim() || aprobador,
      })
      .subscribe({
        next: () => {
          const actualizada: SolicitudVacacionProceso = {
            ...actual,
            estado_jefe: 'Aprobado',
            estado_evidencia: 'Pendiente',
            estado_gh: 'Pendiente',
            estado: actual.estado === 'Aprobada' ? 'Aprobada' : 'En revisión',
            etapa_actual: 3,
            observaciones:
              this.observacionesAprobacion.trim() || actual.observaciones,
          };

          this.solicitudSeleccionada.set(actualizada);
          this.solicitudes.update((prev) =>
            prev.map((s) => (Number(s.id) === id ? actualizada : s))
          );
          this.observacionesAprobacion = '';
          this.firmaTextoAprobacion = '';
          this.procesandoAprobacion.set(false);
          this.estadoFeedback.set(
            'Aprobada por Jefe Inmediato. Regresa al colaborador para subir evidencia si aplica.'
          );
        },
        error: () => {
          this.procesandoAprobacion.set(false);
          this.errorMensaje.set(
            'No se pudo registrar la aprobación del Jefe Inmediato.'
          );
        },
      });
  }

  aprobarComoGestionHumana(): void {
    const actual = this.solicitudSeleccionada();
    const id = Number(actual?.id ?? 0);
    if (!actual || !id) return;

    const u: any = this.usuario();
    const aprobador = u?.nombre_completo || u?.nombre || 'Gestión Humana';

    this.procesandoAprobacion.set(true);
    this.estadoFeedback.set('');
    this.errorMensaje.set('');

    this.http
      .post<any>(`${this.apiUrl}/vacaciones/${id}/aprobar-gh`, {
        aprobado_por: aprobador,
        observaciones: this.observacionesAprobacion.trim() || undefined,
        firma_texto: this.firmaTextoAprobacion.trim() || aprobador,
      })
      .subscribe({
        next: () => {
          const actualizada: SolicitudVacacionProceso = {
            ...actual,
            estado_jefe: 'Aprobado',
            estado_evidencia: 'Enviada',
            estado_gh: 'Aprobado',
            estado: 'Aprobada',
            etapa_actual: 4,
            observaciones:
              this.observacionesAprobacion.trim() || actual.observaciones,
          };

          this.solicitudSeleccionada.set(actualizada);
          this.solicitudes.update((prev) =>
            prev.map((s) => (Number(s.id) === id ? actualizada : s))
          );
          this.observacionesAprobacion = '';
          this.firmaTextoAprobacion = '';
          this.procesandoAprobacion.set(false);
          this.estadoFeedback.set(
            'Solicitud aprobada definitivamente por Gestión Humana.'
          );
        },
        error: () => {
          this.procesandoAprobacion.set(false);
          this.errorMensaje.set(
            'No se pudo registrar la aprobación de Gestión Humana.'
          );
        },
      });
  }
}