import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { catchError, of } from "rxjs";
import { AuthService } from "../../core/services/auth.services";

export interface SolicitudAprobacionItem {
  id: number | string;
  codigo_empleado?: string;
  empleado_id?: number | string;
  nombre_colaborador: string;
  cargo?: string;
  sucursal?: string;
  jefe_inmediato?: string;
  directo_a_rrhh?: boolean;
  fecha_solicitud: string;
  rango_o_fechas: string;
  dias_horas: string;
  motivo: string;
  estado_jefe: "Pendiente" | "Aprobado" | "Rechazado";
  estado_gh: "Pendiente" | "Aprobado" | "Rechazado";
  estado: "Pendiente" | "En revisión" | "Aprobada" | "Rechazada";
  observaciones?: string;
  motivo_rechazo?: string;
  linea_proceso?: any;
}

interface RegistroJerarquia {
  nombre: string;
  puesto: string;
  jefeInmediato: string;
  directoARrhh?: boolean;
}

const JERARQUIA_EMPLEADOS: RegistroJerarquia[] = [
  {
    nombre: "Gloria Esperanza del Carmen Zarazúa Sesam",
    puesto: "Gerente General",
    jefeInmediato: "Consejo",
    directoARrhh: true,
  },
  {
    nombre: "Joel Isaí Choy Camey",
    puesto: "Auditor Interno",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "Luis Fernando García Díaz",
    puesto: "Jefe de Contabilidad",
    jefeInmediato: "Gerson Abel Cruz Ruche",
  },
  {
    nombre: "Iliana Siomara Salazar Galindo de Albízures",
    puesto: "Gerente de Gestión Humana",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "Gerson Abel Cruz Ruche",
    puesto: "Gerente de Administración y Finanzas",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "Claudia Marivel Boror Ticún",
    puesto: "Oficial de Gestión Humana",
    jefeInmediato: "Iliana Siomara Salazar Galindo de Albízures",
  },
  {
    nombre: "Rosa Andrea Pellecer",
    puesto: "Oficial de Egresos y Activos",
    jefeInmediato: "Gerson Abel Cruz Ruche",
  },
  {
    nombre: "Byron René de León Morales",
    puesto: "Oficial de Ingresos y Compras",
    jefeInmediato: "Gerson Abel Cruz Ruche",
  },
  {
    nombre: "José Eligio Xinico Upún",
    puesto: "Gerente de Negocios",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "Mario Mixrain Revolorio Rodas",
    puesto: "Asesor Legal",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "Eva Maritza Gómez Osorio de Aroche",
    puesto: "Jefe de Operaciones",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "Mildred Marilú Salazar Leal",
    puesto: "Oficial de Operaciones",
    jefeInmediato: "Eva Maritza Gómez Osorio de Aroche",
  },
  {
    nombre: "Samy Josue Ruiz Monzón",
    puesto: "Oficial de Soporte Técnico",
    jefeInmediato: "Gloria Esperanza del Carmen Zarazúa Sesam",
  },
  {
    nombre: "María Fernanda Siquibache Hernandez",
    puesto: "Oficial de Atención al Cliente",
    jefeInmediato: "Iliana Siomara Salazar Galindo de Albízures",
  },
  {
    nombre: "Carlos Xol Chub",
    puesto: "Conserje",
    jefeInmediato: "Gerson Abel Cruz Ruche",
  },
  {
    nombre: "Marco Tulio Perez Garcia",
    puesto: "Gerente de Sucursal",
    jefeInmediato: "José Eligio Xinico Upún",
  },
  {
    nombre: "Yolanda Yohana Gómez Valle",
    puesto: "Oficial de Atención al Cliente",
    jefeInmediato: "Marco Tulio Perez Garcia",
  },
  {
    nombre: "Edith Irlanda Rosales Vásquez de Carranza",
    puesto: "Conserje",
    jefeInmediato: "Marco Tulio Perez Garcia",
  },
  {
    nombre: "Melgin Carol Barrios Mendoza",
    puesto: "Gerente de Sucursal",
    jefeInmediato: "José Eligio Xinico Upún",
  },
  {
    nombre: "Rocío Raquel Reyes de León",
    puesto: "Oficial de Atención al Cliente",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Verónica De La Cruz Ramos de Pérez",
    puesto: "Conserje",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Helio Noelí Agustín González",
    puesto: "Supervisor",
    jefeInmediato: "José Eligio Xinico Upún",
  },
  {
    nombre: "Yulissa Magaly Hernández Bámac de de León",
    puesto: "Oficial de Operaciones",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Wilfredo Grande Enriquez",
    puesto: "Gerente de Sucursal",
    jefeInmediato: "José Eligio Xinico Upún",
  },
  {
    nombre: "Ada Yesenia Sánchez López",
    puesto: "Oficial de Atención al Cliente",
    jefeInmediato: "Wilfredo Grande Enriquez",
  },
  {
    nombre: "Daniela Alejandra Sapón Macario",
    puesto: "Conserje",
    jefeInmediato: "Wilfredo Grande Enriquez",
  },
  {
    nombre: "David Elel Morales",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Marco Tulio Perez Garcia",
  },
  {
    nombre: "Jennifer Lizbeth Patzán Ramirez",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Marco Tulio Perez Garcia",
  },
  {
    nombre: "Axel Adonías Tum Olcot",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Marco Tulio Perez Garcia",
  },
  {
    nombre: "Ervin Rossi Alemán Rivera",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Marco Tulio Perez Garcia",
  },
  {
    nombre: "Gamaliel Arístides Orozco García",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Carlos Miguel López Yax",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Romulo Geovanni Batz Xúm",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Brandon Gabriel Gutierrez Flores",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Melgin Carol Barrios Mendoza",
  },
  {
    nombre: "Osvin Evelio Galicia Sian",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Wilfredo Grande Enriquez",
  },
  {
    nombre: "Kevin Fernando Perez Mijangos",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Wilfredo Grande Enriquez",
  },
  {
    nombre: "Diego Manuel Castillo Soto",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Wilfredo Grande Enriquez",
  },
  {
    nombre: "Elmer Roberto Chay Manzano",
    puesto: "Oficial de Crédito",
    jefeInmediato: "Wilfredo Grande Enriquez",
  },
];

@Component({
  selector: "app-aprobar-solicitudes",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./aprobar-solicitudes.html",
  styleUrl: "./aprobar-solicitudes.css",
})
export class AprobarSolicitudesComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  private readonly apiBaseUrl = "http://localhost:3000/api";
  private readonly storageAprobadosJefeKey = "ffdl_aprobadas_jefe_ids";
  private readonly storageAprobadasGhKey = "ffdl_aprobadas_gh_ids";
  private readonly storageRechazadasKey = "ffdl_rechazadas_ids";
  readonly usuario = this.authService.usuarioActual;

  readonly solicitudes = signal<SolicitudAprobacionItem[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly procesando = signal<boolean>(false);
  readonly solicitudEnFicha = signal<SolicitudAprobacionItem | null>(null);
  readonly mostrarCuadroRechazo = signal<boolean>(false);
  readonly mensajeExito = signal<string>("");
  readonly mensajeError = signal<string>("");

  firmaTexto = "";
  observacionesTexto = "";
  motivoRechazoTexto = "";

  private obtenerIdsLocal(key: string): Set<string> {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((v) => String(v).trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private obtenerIdsAprobadosJefeLocal(): Set<string> {
    return this.obtenerIdsLocal(this.storageAprobadosJefeKey);
  }

  private obtenerIdsAprobadasGhLocal(): Set<string> {
    return this.obtenerIdsLocal(this.storageAprobadasGhKey);
  }

  private obtenerIdsRechazadasLocal(): Set<string> {
    return this.obtenerIdsLocal(this.storageRechazadasKey);
  }

  private marcarIdLocal(key: string, id: number | string): void {
    const ids = this.obtenerIdsLocal(key);
    ids.add(String(id).trim());
    try {
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch {
      // Ignorar error de almacenamiento
    }
  }

  private marcarAprobadaJefeLocal(id: number | string): void {
    this.marcarIdLocal(this.storageAprobadosJefeKey, id);
  }

  private marcarAprobadaGhLocal(id: number | string): void {
    this.marcarIdLocal(this.storageAprobadasGhKey, id);
  }

  private marcarRechazadaLocal(id: number | string): void {
    this.marcarIdLocal(this.storageRechazadasKey, id);
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(lic\.?|licda\.?|ing\.?|dr\.?|dra\.?)\b/gi, " ")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
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
    return "Aprobador";
  });

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

      const rolYPuesto = this.normalizarTexto(
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
    }

    const nombres = this.obtenerNombresUsuarioNormalizados();
    return nombres.some(
      (n) =>
        n.includes("iliana siomara salazar") ||
        n.includes("claudia marivel boror") ||
        n.includes("gloria esperanza del carmen zarazua")
    );
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

  private obtenerNombresUsuarioNormalizados(): string[] {
    const nombres: string[] = [];
    for (const u of this.extraerCandidatosUsuario()) {
      for (const campo of [
        u["nombre_completo"],
        u["nombreCompleto"],
        u["nombre"],
        u["nombre_empleados"],
        u["nombre_empleado"],
      ]) {
        const norm = this.normalizarTexto(campo);
        if (norm && !nombres.includes(norm)) {
          nombres.push(norm);
        }
      }
    }
    const principal = this.normalizarTexto(this.nombreUsuario());
    if (principal && !nombres.includes(principal)) {
      nombres.unshift(principal);
    }
    return nombres;
  }

  ngOnInit(): void {
    this.cargarSolicitudes();
  }

  private buscarRegistroJerarquia(nombreColabNorm: string): RegistroJerarquia | undefined {
    if (!nombreColabNorm) return undefined;

    const exacto = JERARQUIA_EMPLEADOS.find(
      (r) => this.normalizarTexto(r.nombre) === nombreColabNorm
    );
    if (exacto) return exacto;

    const porInclusion = JERARQUIA_EMPLEADOS.find((r) => {
      const rNorm = this.normalizarTexto(r.nombre);
      return (
        (rNorm.length >= 6 && nombreColabNorm.includes(rNorm)) ||
        (nombreColabNorm.length >= 6 && rNorm.includes(nombreColabNorm))
      );
    });
    if (porInclusion) return porInclusion;

    const palabrasColab = nombreColabNorm.split(" ").filter((p) => p.length >= 3);
    if (palabrasColab.length >= 2) {
      return JERARQUIA_EMPLEADOS.find((r) => {
        const rNorm = this.normalizarTexto(r.nombre);
        const coincidencias = palabrasColab.filter((p) => rNorm.includes(p)).length;
        return coincidencias >= 2;
      });
    }

    return undefined;
  }

  private resolverJefePorJerarquia(
    jefeBackend: string,
    codigoEmp: string,
    nombreColabNorm: string
  ): { jefe: string; puesto: string; directoARrhh: boolean } {
    const match = this.buscarRegistroJerarquia(nombreColabNorm);

    if (match) {
      if (match.directoARrhh) {
        return {
          jefe: jefeBackend || "Gloria Esperanza del Carmen Zarazúa Sesam",
          puesto: match.puesto,
          directoARrhh: true,
        };
      }
      return {
        jefe: jefeBackend || match.jefeInmediato,
        puesto: match.puesto,
        directoARrhh: false,
      };
    }

    if (
      codigoEmp === "410" ||
      (nombreColabNorm.includes("eva") && nombreColabNorm.includes("maritza"))
    ) {
      return {
        jefe: jefeBackend || "Gloria Esperanza del Carmen Zarazúa Sesam",
        puesto: "Jefe de Operaciones",
        directoARrhh: false,
      };
    }

    return {
      jefe: jefeBackend,
      puesto: "",
      directoARrhh: false,
    };
  }

  private coincideConJefeAsignado(item: SolicitudAprobacionItem): boolean {
    const jefeItemNorm = this.normalizarTexto(item.jefe_inmediato ?? "");
    const nombreColabNorm = this.normalizarTexto(item.nombre_colaborador ?? "");
    const nombresUsuario = this.obtenerNombresUsuarioNormalizados();
    const codigoUsuarioNorm = this.normalizarTexto(this.codigoUsuario());
    const idUsuarioNorm = this.normalizarTexto(this.empleadoIdUsuario());

    const esPropiaSolicitud = nombresUsuario.some(
      (uNom) =>
        nombreColabNorm &&
        (nombreColabNorm === uNom ||
          (uNom.length >= 6 && nombreColabNorm.includes(uNom)) ||
          (nombreColabNorm.length >= 6 && uNom.includes(nombreColabNorm)))
    );

    if (esPropiaSolicitud) {
      return false;
    }

    const matchColab = this.buscarRegistroJerarquia(nombreColabNorm);
    const jefeEfectivoNorm = this.normalizarTexto(
      matchColab?.jefeInmediato || item.jefe_inmediato || ""
    );

    if (!jefeEfectivoNorm && !jefeItemNorm) return false;

    const candidatosUsuario = [
      ...nombresUsuario,
      codigoUsuarioNorm,
      idUsuarioNorm,
    ].filter((v) => v.length > 0);

    return candidatosUsuario.some((cand) => {
      for (const objetivo of [jefeEfectivoNorm, jefeItemNorm].filter(Boolean)) {
        if (objetivo === cand) return true;
        if (cand.length >= 4 && objetivo.includes(cand)) return true;
        if (objetivo.length >= 4 && cand.includes(objetivo)) return true;

        const palabrasUsuario = cand.split(" ").filter((p) => p.length >= 3);
        const coincidencias = palabrasUsuario.filter((p) =>
          objetivo.includes(p)
        );
        if (coincidencias.length >= 2) return true;
      }
      return false;
    });
  }

  private correspondeAlAprobadorActual(item: SolicitudAprobacionItem): boolean {
    if (item.estado === "Aprobada" || item.estado === "Rechazada") {
      return false;
    }

    const idStr = String(item.id ?? "").trim();
    if (
      idStr &&
      (this.obtenerIdsAprobadasGhLocal().has(idStr) ||
        this.obtenerIdsRechazadasLocal().has(idStr))
    ) {
      return false;
    }

    const aprobadaJefeLocal =
      Boolean(idStr) && this.obtenerIdsAprobadosJefeLocal().has(idStr);

    const jefeYaAprobo =
      item.directo_a_rrhh === true ||
      item.estado_jefe === "Aprobado" ||
      aprobadaJefeLocal;

    if (!jefeYaAprobo && this.coincideConJefeAsignado(item)) {
      return true;
    }

    const nombresUsuario = this.obtenerNombresUsuarioNormalizados();
    const nombreColabNorm = this.normalizarTexto(item.nombre_colaborador ?? "");
    const esPropiaSolicitud = nombresUsuario.some(
      (uNom) =>
        nombreColabNorm &&
        (nombreColabNorm === uNom ||
          (uNom.length >= 6 && nombreColabNorm.includes(uNom)) ||
          (nombreColabNorm.length >= 6 && uNom.includes(nombreColabNorm)))
    );

    if (
      this.esRrhh() &&
      !esPropiaSolicitud &&
      jefeYaAprobo &&
      item.estado_gh !== "Aprobado"
    ) {
      return true;
    }

    return false;
  }

  private normalizarLineaProceso(
    rawLinea: any,
    estadoJefe: SolicitudAprobacionItem["estado_jefe"],
    estadoGh: SolicitudAprobacionItem["estado_gh"],
    estado: SolicitudAprobacionItem["estado"]
  ): any {
    const pasosBase = Array.isArray(rawLinea?.pasos) ? rawLinea.pasos : [];
    const etapa = String(rawLinea?.etapa_actual ?? "").toUpperCase();

    const jefeListo =
      estadoJefe === "Aprobado" ||
      estado === "En revisión" ||
      estado === "Aprobada" ||
      etapa === "PENDIENTE_GH" ||
      etapa === "GESTION_HUMANA";

    const ghListo = estadoGh === "Aprobado" || estado === "Aprobada";

    return {
      ...(rawLinea && typeof rawLinea === "object" ? rawLinea : {}),
      etapa_actual:
        estado === "Aprobada"
          ? "APROBADA"
          : estado === "Rechazada"
            ? "RECHAZADA"
            : jefeListo
              ? "PENDIENTE_GH"
              : rawLinea?.etapa_actual || "PENDIENTE_JEFE",
      pasos: pasosBase.map((p: any, idx: number) => {
        const pasoNum = Number(p?.paso ?? idx + 1);
        const clave = String(p?.clave ?? "").toUpperCase();

        if (pasoNum === 1 || clave === "ENVIADA") {
          return { ...p, estado: "COMPLETADO" };
        }
        if (pasoNum === 2 || clave === "JEFE_INMEDIATO") {
          return {
            ...p,
            estado:
              estadoJefe === "Rechazado"
                ? "RECHAZADO"
                : jefeListo
                  ? "COMPLETADO"
                  : p?.estado || "EN_PROCESO",
          };
        }
        if (pasoNum === 3 || clave === "GESTION_HUMANA") {
          if (estadoGh === "Rechazado") {
            return { ...p, estado: "RECHAZADO" };
          }
          if (estado === "Aprobada") {
            return { ...p, estado: "COMPLETADO" };
          }
          return {
            ...p,
            estado: jefeListo ? "EN_PROCESO" : p?.estado || "PENDIENTE",
          };
        }
        if (pasoNum === 4 || clave === "APROBADA") {
          return { ...p, estado: ghListo ? "COMPLETADO" : "PENDIENTE" };
        }
        return p;
      }),
    };
  }

  private normalizarSolicitud(raw: any): SolicitudAprobacionItem {
    const lineaEtapa = String(raw?.linea_proceso?.etapa_actual ?? "").toUpperCase();
    const estadoRaw = String(raw?.estado ?? "").trim();
    const estadoJefeRaw = String(raw?.estado_jefe ?? "").trim();
    const estadoGhRaw = String(raw?.estado_gh ?? "").trim();

    const idResuelto = raw?.id ?? raw?.solicitud_id;
    const idStr = idResuelto !== undefined ? String(idResuelto).trim() : "";
    const aprobadaJefeLocal =
      Boolean(idStr) && this.obtenerIdsAprobadosJefeLocal().has(idStr);
    const aprobadaGhLocal =
      Boolean(idStr) && this.obtenerIdsAprobadasGhLocal().has(idStr);
    const rechazadaLocal =
      Boolean(idStr) && this.obtenerIdsRechazadasLocal().has(idStr);

    const jefeBackend = String(
      raw?.jefe_inmediato ??
        raw?.nombre_jefe_inmediato ??
        raw?.jefe ??
        raw?.nombre_jefe ??
        raw?.jefeInmediato ??
        raw?.nombreJefe ??
        raw?.encargado ??
        raw?.supervisor ??
        ""
    ).trim();

    const codigoEmp = String(raw?.codigo_empleado ?? raw?.empleado_id ?? "").trim();
    const nombreColaboradorResuelto =
      raw?.nombre_colaborador ??
      raw?.nombre_completo ??
      raw?.nombre_solicitante ??
      raw?.empleado_nombre ??
      `Empleado #${raw?.empleado_id ?? ""}`;
    const nombreEmpNorm = this.normalizarTexto(nombreColaboradorResuelto);

    const jerarquia = this.resolverJefePorJerarquia(
      jefeBackend,
      codigoEmp,
      nombreEmpNorm
    );

    let estado: SolicitudAprobacionItem["estado"] = "Pendiente";
    let estadoJefe: SolicitudAprobacionItem["estado_jefe"] =
      estadoJefeRaw === "Aprobado" || estadoJefeRaw === "Rechazado"
        ? estadoJefeRaw
        : jerarquia.directoARrhh || aprobadaGhLocal || aprobadaJefeLocal
          ? "Aprobado"
          : "Pendiente";
    let estadoGh: SolicitudAprobacionItem["estado_gh"] =
      estadoGhRaw === "Aprobado" || estadoGhRaw === "Rechazado"
        ? estadoGhRaw
        : aprobadaGhLocal
          ? "Aprobado"
          : "Pendiente";

    if (
      rechazadaLocal ||
      lineaEtapa === "RECHAZADA" ||
      estadoRaw === "Rechazada" ||
      estadoRaw === "Rechazado"
    ) {
      estado = "Rechazada";
    } else if (
      lineaEtapa === "APROBADA" ||
      estadoRaw === "Aprobada" ||
      estadoRaw === "Aprobado" ||
      estadoGhRaw === "Aprobado" ||
      aprobadaGhLocal
    ) {
      estado = "Aprobada";
      estadoJefe = "Aprobado";
      estadoGh = "Aprobado";
    } else if (
      jerarquia.directoARrhh ||
      estadoJefeRaw === "Aprobado" ||
      aprobadaJefeLocal
    ) {
      estado = "En revisión";
      estadoJefe = "Aprobado";
      estadoGh = "Pendiente";
    }

    const lineaNormalizada = this.normalizarLineaProceso(
      raw?.linea_proceso,
      estadoJefe,
      estadoGh,
      estado
    );

    return {
      id: idResuelto,
      codigo_empleado: codigoEmp,
      empleado_id: raw?.empleado_id,
      nombre_colaborador: nombreColaboradorResuelto,
      cargo: raw?.cargo ?? raw?.puesto ?? jerarquia.puesto,
      sucursal: raw?.sucursal ?? raw?.lugar ?? "",
      jefe_inmediato: jerarquia.jefe,
      directo_a_rrhh: jerarquia.directoARrhh,
      fecha_solicitud: String(raw?.fecha_solicitud ?? raw?.fecha_disfrute ?? "").slice(
        0,
        10
      ),
      rango_o_fechas:
        raw?.rango_o_fechas ??
        (raw?.fecha_disfrute ? String(raw.fecha_disfrute).slice(0, 10) : ""),
      dias_horas:
        raw?.dias_horas ??
        (raw?.dias_tomados !== undefined ? `${raw.dias_tomados} día(s)` : ""),
      motivo: raw?.motivo ?? raw?.observaciones ?? "Solicitud de permiso / vacaciones",
      estado_jefe: estadoJefe,
      estado_gh: estadoGh,
      estado,
      observaciones: raw?.observaciones ?? "",
      motivo_rechazo: raw?.motivo_rechazo ?? "",
      linea_proceso: lineaNormalizada,
    };
  }

  cargarSolicitudes(): void {
    this.cargando.set(true);
    this.mensajeError.set("");

    this.http
      .get<any>(`${this.apiBaseUrl}/vacaciones`)
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

          const filtradas = rawLista
            .map((r: any) => this.normalizarSolicitud(r))
            .filter((item: SolicitudAprobacionItem) =>
              this.correspondeAlAprobadorActual(item)
            );

          this.solicitudes.set(filtradas);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.mensajeError.set("No se pudieron cargar las solicitudes.");
        },
      });
  }

  abrirFicha(item: SolicitudAprobacionItem): void {
    this.solicitudEnFicha.set(item);
    this.mostrarCuadroRechazo.set(false);
    this.motivoRechazoTexto = item.motivo_rechazo ?? "";
    this.mensajeExito.set("");
    this.mensajeError.set("");
    this.firmaTexto = this.nombreUsuario();
    this.observacionesTexto = item.observaciones ?? "";
  }

  cerrarFicha(): void {
    this.solicitudEnFicha.set(null);
    this.mostrarCuadroRechazo.set(false);
    this.motivoRechazoTexto = "";
  }

  alternarCuadroRechazo(): void {
    this.mensajeError.set("");
    this.mostrarCuadroRechazo.update((v) => !v);
  }

  esEtapaGestionHumana(item: SolicitudAprobacionItem | null): boolean {
    if (!item) return false;
    const jefeYaAprobo =
      item.directo_a_rrhh === true || item.estado_jefe === "Aprobado";
    return this.esRrhh() && jefeYaAprobo;
  }

  aprobarYEnviarAGestionHumana(): void {
    const actual = this.solicitudEnFicha();
    const id = Number(actual?.id ?? 0);
    if (!actual || !id) return;

    const esGh = this.esEtapaGestionHumana(actual);

    const endpoint = esGh
      ? `${this.apiBaseUrl}/vacaciones/${id}/aprobar-gh`
      : `${this.apiBaseUrl}/vacaciones/${id}/aprobar-jefe`;

    const firmante = this.firmaTexto.trim() || this.nombreUsuario();

    this.procesando.set(true);
    this.mensajeExito.set("");
    this.mensajeError.set("");

    this.http
      .post<any>(endpoint, {
        aprobado_por: firmante,
        firma_texto: firmante,
        observaciones: this.observacionesTexto.trim() || undefined,
        estado: esGh ? "Aprobada" : "En revisión",
        estado_jefe: "Aprobado",
        estado_gh: esGh ? "Aprobado" : "Pendiente",
      })
      .subscribe({
        next: () => {
          if (esGh) {
            this.marcarAprobadaGhLocal(id);
          } else {
            this.marcarAprobadaJefeLocal(id);
          }
          this.solicitudes.update((prev) =>
            prev.filter((s) => Number(s.id) !== id)
          );
          this.solicitudEnFicha.set(null);
          this.mostrarCuadroRechazo.set(false);
          this.firmaTexto = "";
          this.observacionesTexto = "";
          this.motivoRechazoTexto = "";
          this.procesando.set(false);
          this.mensajeExito.set(
            esGh
              ? "Solicitud aprobada definitivamente por Gestión Humana."
              : "Aprobada por Jefa Inmediata y enviada a Gestión Humana para validación final."
          );
        },
        error: () => {
          this.procesando.set(false);
          this.mensajeError.set("No se pudo guardar la aprobación.");
        },
      });
  }

  confirmarRechazo(): void {
    const actual = this.solicitudEnFicha();
    const id = Number(actual?.id ?? 0);
    if (!actual || !id) return;

    const motivo = this.motivoRechazoTexto.trim();
    if (!motivo) {
      this.mensajeError.set(
        "Por favor escribe el motivo por el cual se rechaza la solicitud."
      );
      return;
    }

    const esGh = this.esEtapaGestionHumana(actual);
    const rechazadoPor = this.firmaTexto.trim() || this.nombreUsuario();

    this.procesando.set(true);
    this.mensajeExito.set("");
    this.mensajeError.set("");

    this.http
      .post<any>(`${this.apiBaseUrl}/vacaciones/${id}/rechazar`, {
        rechazado_por: rechazadoPor,
        motivo_rechazo: motivo,
        observaciones: motivo,
        estado: "Rechazada",
        estado_jefe: esGh ? actual.estado_jefe : "Rechazado",
        estado_gh: esGh ? "Rechazado" : actual.estado_gh,
      })
      .pipe(
        catchError(() =>
          this.http.patch<any>(`${this.apiBaseUrl}/vacaciones/${id}`, {
            estado: "Rechazada",
            motivo_rechazo: motivo,
            observaciones: motivo,
          })
        )
      )
      .subscribe({
        next: () => {
          this.marcarRechazadaLocal(id);
          this.solicitudes.update((prev) =>
            prev.filter((s) => Number(s.id) !== id)
          );
          this.solicitudEnFicha.set(null);
          this.mostrarCuadroRechazo.set(false);
          this.motivoRechazoTexto = "";
          this.firmaTexto = "";
          this.observacionesTexto = "";
          this.procesando.set(false);
          this.mensajeExito.set(
            `Solicitud #${id} rechazada. Motivo registrado: "${motivo}".`
          );
        },
        error: () => {
          this.procesando.set(false);
          this.mensajeError.set("No se pudo registrar el rechazo de la solicitud.");
        },
      });
  }
}