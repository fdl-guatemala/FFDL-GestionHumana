import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.services";
import { NotificacionesCampanaComponent } from "../NotificacionCampana/notificaciones-campana";

interface ModuloAcceso {
  titulo: string;
  descripcion: string;
  ruta: string;
  etiqueta: string;
  soloRrhh?: boolean;
  soloAprobadores?: boolean;
}

export interface NotificacionAusenciaItem {
  id: number;
  solicitud_id?: number | null;
  titulo?: string;
  mensaje: string;
  destinatario_tipo?: string;
  destinatario_codigo?: string | null;
  estado_aprobacion?: string;
  leida?: boolean | number;
  fecha_creacion?: string;
}

const JEFES_INMEDIATOS_NORMALIZADOS = [
  "gloria esperanza del carmen zarazua sesam",
  "iliana siomara salazar galindo de albizures",
  "gerson abel cruz ruche",
  "jose eligio xinico upun",
  "eva maritza gomez osorio de aroche",
  "marco tulio perez garcia",
  "melgin carol barrios mendoza",
  "wilfredo grande enriquez",
];

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, NotificacionesCampanaComponent],
  templateUrl: "./home.html",
  styleUrl: "./home.css",
})
export class HomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  private readonly apiNotificacionesUrl = "http://localhost:3000/api/notificaciones";

  readonly usuario = this.authService.usuarioActual;
  readonly notificaciones = signal<NotificacionAusenciaItem[]>([]);
  readonly cargandoNotificaciones = signal<boolean>(false);
  readonly errorNotificaciones = signal<string>("");

  private readonly todosLosModulos: ModuloAcceso[] = [
    {
      titulo: "Proceso de Vacaciones",
      descripcion: "Consulta el estado, seguimiento y periodos de vacaciones disponibles.",
      ruta: "/procesovacaciones",
      etiqueta: "01 · Seguimiento",
    },
    {
      titulo: "Solicitar Vacaciones",
      descripcion: "Registra y envía nuevas solicitudes de vacaciones de forma ágil.",
      ruta: "/solicitarvacaciones",
      etiqueta: "02 · Solicitudes",
    },
    {
      titulo: "Empleados",
      descripcion: "Consulta y administración del inventario de colaboradores y sedes.",
      ruta: "/empleados",
      etiqueta: "03 · Personal",
    },
    {
      titulo: "Agregar Nuevo Empleado",
      descripcion: "Registra un nuevo colaborador y guarda sus datos en la base de datos.",
      ruta: "/agregar",
      etiqueta: "04 · Recursos Humanos",
      soloRrhh: true,
    },
    {
      titulo: "Aprobar Solicitudes",
      descripcion: "Revisa y aprueba las solicitudes de vacaciones de tus colaboradores asignados.",
      ruta: "/aprobarsolicitudes",
      etiqueta: "05 · Aprobaciones",
      soloAprobadores: true,
    },
  ];

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(lic\.?|licda\.?|ing\.?|dr\.?|dra\.?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private extraerCandidatosUsuario(): Record<string, unknown>[] {
    const raw = this.usuario() as unknown;
    if (!raw || typeof raw !== "object") return [];

    const fuente = raw as Record<string, unknown>;
    return [
      fuente,
      typeof fuente["usuario"] === "object" && fuente["usuario"] !== null
        ? (fuente["usuario"] as Record<string, unknown>)
        : null,
      typeof fuente["empleado"] === "object" && fuente["empleado"] !== null
        ? (fuente["empleado"] as Record<string, unknown>)
        : null,
    ].filter((obj): obj is Record<string, unknown> => obj !== null);
  }

  readonly nombreUsuario = computed(() => {
    for (const u of this.extraerCandidatosUsuario()) {
      const nombre =
        u["nombre_completo"] ??
        u["nombreCompleto"] ??
        u["nombre"] ??
        u["nombre_empleados"] ??
        u["usuario"] ??
        u["correo"];
      if (nombre !== undefined && nombre !== null && String(nombre).trim() !== "") {
        return String(nombre).trim();
      }
    }
    return "Colaborador";
  });

  private obtenerTextoRolYPuesto(u: Record<string, unknown>): string {
    return this.normalizarTexto(
      [
        u["rol"],
        u["rol_tipo"],
        u["tipo_usuario"],
        u["rol_nombre"],
        u["puesto"],
        u["cargo"],
        u["departamento"],
        u["area"],
      ]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v))
        .join(" ")
    );
  }

  // Solo administradoras / Gestión Humana ven "Agregar Nuevo Empleado"
  readonly esRrhh = computed(() => {
    const candidatos = this.extraerCandidatosUsuario();

    for (const u of candidatos) {
      if (
        u["es_admin"] === true ||
        u["es_admin"] === 1 ||
        u["admin"] === true ||
        u["admin"] === 1
      ) {
        return true;
      }

      const rolYPuesto = this.obtenerTextoRolYPuesto(u);
      if (
        rolYPuesto.includes("rrhh") ||
        rolYPuesto.includes("recursos humanos") ||
        rolYPuesto.includes("gestion humana") ||
        rolYPuesto.includes("talento humano") ||
        rolYPuesto === "gh" ||
        rolYPuesto.includes("admin")
      ) {
        return true;
      }

      const nombreNorm = this.normalizarTexto(
        u["nombre_completo"] ??
          u["nombreCompleto"] ??
          u["nombre"] ??
          u["nombre_empleados"] ??
          ""
      );
      const codigoStr = String(
        u["codigo_empleado"] ?? u["codigoEmpleado"] ?? u["codigo"] ?? ""
      ).trim();

      if (
        codigoStr === "406" ||
        codigoStr === "404" ||
        nombreNorm.includes("claudia marivel boror") ||
        nombreNorm.includes("iliana siomara salazar")
      ) {
        return true;
      }
    }

    return false;
  });

  // Jefes inmediatos ven "Aprobar Solicitudes"
  readonly esJefeInmediato = computed(() => {
    const candidatos = this.extraerCandidatosUsuario();

    for (const u of candidatos) {
      const nombreNorm = this.normalizarTexto(
        u["nombre_completo"] ??
          u["nombreCompleto"] ??
          u["nombre"] ??
          u["nombre_empleados"] ??
          ""
      );

      if (
        nombreNorm &&
        JEFES_INMEDIATOS_NORMALIZADOS.some(
          (jefe) => nombreNorm === jefe || nombreNorm.includes(jefe)
        )
      ) {
        return true;
      }

      const rolYPuesto = this.obtenerTextoRolYPuesto(u);
      if (
        rolYPuesto.includes("jefe") ||
        rolYPuesto.includes("gerente") ||
        rolYPuesto.includes("supervisor")
      ) {
        return true;
      }
    }

    return false;
  });

  // Jefes inmediatos y Gestión Humana (incluyendo a Claudia) ven "Aprobar Solicitudes"
  readonly puedeAprobarSolicitudes = computed(() => {
    return this.esRrhh() || this.esJefeInmediato();
  });

  readonly codigoUsuario = computed(() => {
    for (const u of this.extraerCandidatosUsuario()) {
      const codigo = u["codigo_empleado"] ?? u["codigoEmpleado"] ?? u["codigo"];
      if (codigo !== undefined && codigo !== null && String(codigo).trim() !== "") {
        return String(codigo).trim();
      }
    }
    return "";
  });

  readonly empleadoIdUsuario = computed(() => {
    for (const u of this.extraerCandidatosUsuario()) {
      const id = u["empleado_id"] ?? u["empleadoId"] ?? u["id"];
      if (id !== undefined && id !== null && String(id).trim() !== "") {
        return String(id).trim();
      }
    }
    return "";
  });

  readonly rolTipo = computed<"empleado" | "jefe_inmediato" | "gestion_humana">(() => {
    if (this.esRrhh()) {
      return "gestion_humana";
    }
    if (this.esJefeInmediato()) {
      return "jefe_inmediato";
    }
    return "empleado";
  });

  readonly modulos = computed(() =>
    this.todosLosModulos.filter((modulo) => {
      if (modulo.soloRrhh && !this.esRrhh()) return false;
      if (modulo.soloAprobadores && !this.puedeAprobarSolicitudes()) return false;
      return true;
    })
  );

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  cargarNotificaciones(): void {
    this.cargandoNotificaciones.set(true);
    this.errorNotificaciones.set("");

    let params = new HttpParams();
    const rol = this.rolTipo();
    const codigo = this.codigoUsuario();
    const nombre = this.nombreUsuario();
    const empleadoId = this.empleadoIdUsuario();

    params = params.set("rolTipo", rol);
    if (codigo) params = params.set("codigo", codigo);
    if (nombre) params = params.set("nombre", nombre);
    if (empleadoId) params = params.set("empleadoId", empleadoId);

    this.http.get<NotificacionAusenciaItem[]>(this.apiNotificacionesUrl, { params }).subscribe({
      next: (data) => {
        this.notificaciones.set(Array.isArray(data) ? data : []);
        this.cargandoNotificaciones.set(false);
      },
      error: (err) => {
        console.error("[HomeComponent] Error al cargar notificaciones:", err);
        this.errorNotificaciones.set("No se pudieron cargar las notificaciones.");
        this.cargandoNotificaciones.set(false);
      },
    });
  }

  marcarLeida(notif: NotificacionAusenciaItem): void {
    if (!notif?.id) return;
    this.http.patch(`${this.apiNotificacionesUrl}/${notif.id}/leer`, {}).subscribe({
      next: () => this.cargarNotificaciones(),
      error: (err) => console.error("[HomeComponent] Error al marcar leída:", err),
    });
  }

  resolverNotificacion(notif: NotificacionAusenciaItem, estado: "aprobado" | "rechazado"): void {
    if (!notif?.id) return;
    this.http
      .patch(`${this.apiNotificacionesUrl}/${notif.id}/resolver`, { estado })
      .subscribe({
        next: () => this.cargarNotificaciones(),
        error: (err) => console.error("[HomeComponent] Error al resolver notificación:", err),
      });
  }

  estaEnRuta(ruta: string): boolean {
    return this.router.url.startsWith(ruta);
  }

  abrirModulo(ruta: string): void {
    this.router.navigate([ruta]);
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }
}