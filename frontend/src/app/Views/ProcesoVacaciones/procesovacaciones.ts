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
  styleUrl: './procesovacaciones.css',
})
export class ProcesoVacacionesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private readonly apiUrl = 'http://localhost:3000/api';
  private readonly storageAprobadosJefeKey = 'ffdl_aprobadas_jefe_ids';
  private readonly storageAprobadasGhKey = 'ffdl_aprobadas_gh_ids';
  readonly usuario = this.authService.usuarioActual;

  readonly solicitudes = signal<SolicitudVacacionProceso[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly procesandoAprobacion = signal<boolean>(false);
  readonly errorMensaje = signal<string>('');
  readonly estadoFeedback = signal<string>('');
  readonly filtroEstado = signal<string>('TODAS');
  readonly busqueda = signal<string>('');
  readonly solicitudSeleccionada = signal<SolicitudVacacionProceso | null>(null);

  observacionesAprobacion = '';
  firmaTextoAprobacion = '';

  private solicitudIdDesdeUrl: number | null = null;

  private obtenerIdsAprobadosJefeLocal(): Set<string> {
    try {
      const raw = localStorage.getItem(this.storageAprobadosJefeKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((v) => String(v).trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private marcarAprobadaJefeLocal(id: number | string): void {
    const ids = this.obtenerIdsAprobadosJefeLocal();
    ids.add(String(id).trim());
    try {
      localStorage.setItem(this.storageAprobadosJefeKey, JSON.stringify([...ids]));
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  private obtenerIdsAprobadasGhLocal(): Set<string> {
    try {
      const raw = localStorage.getItem(this.storageAprobadasGhKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((v) => String(v).trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private marcarAprobadaGhLocal(id: number | string): void {
    const ids = this.obtenerIdsAprobadasGhLocal();
    ids.add(String(id).trim());
    try {
      localStorage.setItem(this.storageAprobadasGhKey, JSON.stringify([...ids]));
    } catch {
      // Ignorar error de almacenamiento
    }
  }

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
    const jefeYaAprobo = det.estado_jefe === 'Aprobado';

    return this.esUsuarioGestionHumana() && jefeYaAprobo;
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
          titulo: 'Gestión Humana',
          subtitulo: 'Validación final y registro',
          mensaje:
            'Gestión Humana validará tus días disponibles y finalizará el proceso.',
          estadoPaso: 'pendiente',
        },
      ];
    }

    const jefeAprobado =
      det.estado_jefe === 'Aprobado' || det.estado === 'Aprobada';

    const jefeRechazado =
      det.estado_jefe === 'Rechazado' ||
      (det.estado === 'Rechazada' && det.estado_gh !== 'Rechazado');

    const ghAprobado =
      det.estado_gh === 'Aprobado' || det.estado === 'Aprobada';

    const ghRechazado =
      det.estado_gh === 'Rechazado' ||
      (det.estado === 'Rechazada' && jefeAprobado);

    const paso1: PasoLineaTiempo = {
      numero: 1,
      titulo: 'Llenado de formulario',
      subtitulo: `Enviado el ${det.fecha_solicitud || 'recientemente'}`,
      mensaje: `${nombreEmpleado} ha llenado el formulario y fue enviado a ${nombreJefe}.`,
      estadoPaso: 'completado',
    };

    let paso2: PasoLineaTiempo;
    if (jefeRechazado) {
      paso2 = {
        numero: 2,
        titulo: 'Jefe inmediato',
        subtitulo: 'Solicitud no autorizada',
        mensaje: `${nombreJefe} ha rechazado la solicitud. Revisa las observaciones para más detalle.`,
        estadoPaso: 'rechazado',
      };
    } else if (jefeAprobado) {
      paso2 = {
        numero: 2,
        titulo: 'Jefe inmediato',
        subtitulo: 'Vo. Bo. aprobado',
        mensaje: `${nombreJefe} aprobó la solicitud y la envió a Gestión Humana para su validación final.`,
        estadoPaso: 'completado',
      };
    } else {
      paso2 = {
        numero: 2,
        titulo: 'Jefe inmediato',
        subtitulo: 'En espera de Vo. Bo.',
        mensaje: `La solicitud está en manos de ${nombreJefe} pendiente de revisión y visto bueno.`,
        estadoPaso: 'actual',
      };
    }

    let paso3: PasoLineaTiempo;
    if (jefeRechazado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Proceso detenido',
        mensaje:
          'La solicitud no llegó a Gestión Humana debido a que fue rechazada en la etapa anterior.',
        estadoPaso: 'pendiente',
      };
    } else if (ghRechazado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Observada / Rechazada',
        mensaje: `Gestión Humana ha rechazado la solicitud de ${nombreEmpleado}. Consulta las observaciones.`,
        estadoPaso: 'rechazado',
      };
    } else if (ghAprobado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Proceso finalizado',
        mensaje: `¡Listo, ${nombreEmpleado}! Gestión Humana aprobó y registró las vacaciones correctamente.`,
        estadoPaso: 'completado',
      };
    } else if (jefeAprobado) {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'En validación',
        mensaje: `Gestión Humana recibió el Vo. Bo. de ${nombreJefe} y está verificando los días disponibles.`,
        estadoPaso: 'actual',
      };
    } else {
      paso3 = {
        numero: 3,
        titulo: 'Gestión Humana',
        subtitulo: 'Pendiente',
        mensaje:
          'En espera de que el jefe inmediato envíe la autorización a Gestión Humana.',
        estadoPaso: 'pendiente',
      };
    }

    return [paso1, paso2, paso3];
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
        const partesI = new Set(nombreItem.split(' ').filter((p) => p.length >= 3));
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
      raw?.linea_proceso?.etapa_actual ?? ''
    ).toUpperCase();
    const fechaBase = String(
      raw?.fecha_solicitud ?? raw?.fecha_disfrute ?? ''
    ).slice(0, 10);

    const idResuelto = raw?.id ?? raw?.solicitud_id;
    const idStr = idResuelto !== undefined ? String(idResuelto).trim() : '';
    const aprobadaJefeLocal =
      Boolean(idStr) && this.obtenerIdsAprobadosJefeLocal().has(idStr);
    const aprobadaGhLocal =
      Boolean(idStr) && this.obtenerIdsAprobadasGhLocal().has(idStr);

    const estadoRaw = String(raw?.estado ?? '').trim();
    const estadoJefeRaw = String(raw?.estado_jefe ?? '').trim();
    const estadoGhRaw = String(raw?.estado_gh ?? '').trim();

    let estadoJefe: SolicitudVacacionProceso['estado_jefe'] =
      estadoJefeRaw === 'Aprobado' || estadoJefeRaw === 'Rechazado'
        ? estadoJefeRaw
        : lineaEtapa === 'PENDIENTE_GH' ||
            lineaEtapa === 'GESTION_HUMANA' ||
            lineaEtapa === 'APROBADA' ||
            aprobadaJefeLocal ||
            aprobadaGhLocal
          ? 'Aprobado'
          : 'Pendiente';

    let estadoGh: SolicitudVacacionProceso['estado_gh'] =
      estadoGhRaw === 'Aprobado' || estadoGhRaw === 'Rechazado'
        ? estadoGhRaw
        : lineaEtapa === 'APROBADA' || aprobadaGhLocal
          ? 'Aprobado'
          : 'Pendiente';

    let estado: SolicitudVacacionProceso['estado'] = 'Pendiente';

    if (
      lineaEtapa === 'RECHAZADA' ||
      estadoRaw === 'Rechazada' ||
      estadoRaw === 'Rechazado' ||
      estadoJefe === 'Rechazado' ||
      estadoGh === 'Rechazado'
    ) {
      estado = 'Rechazada';
    } else if (
      estadoRaw === 'Aprobada' ||
      estadoGhRaw === 'Aprobado' ||
      (lineaEtapa === 'APROBADA' && estadoGh === 'Aprobado')
    ) {
      estado = 'Aprobada';
      estadoJefe = 'Aprobado';
      estadoGh = 'Aprobado';
    } else if (
      estadoJefe === 'Aprobado' ||
      lineaEtapa === 'PENDIENTE_GH' ||
      lineaEtapa === 'GESTION_HUMANA'
    ) {
      estado = 'En revisión';
      estadoJefe = 'Aprobado';
    } else {
      estado = 'Pendiente';
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
      etapa_actual:
        estado === 'Aprobada' ? 3 : estadoJefe === 'Aprobado' ? 2 : 1,
      estado_jefe: estadoJefe,
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
    this.estadoFeedback.set('');

    const idNum = Number(item.id);
    if (Number.isInteger(idNum) && idNum > 0) {
      this.seleccionarPorIdSiExiste(idNum);
    }
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
          this.marcarAprobadaJefeLocal(id);
          const actualizada: SolicitudVacacionProceso = {
            ...actual,
            estado_jefe: 'Aprobado',
            estado: actual.estado === 'Aprobada' ? 'Aprobada' : 'En revisión',
            etapa_actual: 2,
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
            'Solicitud aprobada por Jefe Inmediato y enviada a Gestión Humana (paso 3).'
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
    const aprobador =
      u?.nombre_completo || u?.nombre || 'Gestión Humana';

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
          this.marcarAprobadaGhLocal(id);
          const actualizada: SolicitudVacacionProceso = {
            ...actual,
            estado_jefe: 'Aprobado',
            estado_gh: 'Aprobado',
            estado: 'Aprobada',
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