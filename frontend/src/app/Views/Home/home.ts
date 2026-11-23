import { Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.services";

interface ModuloAcceso {
  titulo: string;
  descripcion: string;
  ruta: string;
  etiqueta: string;
  soloRrhh?: boolean;
}

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./home.html",
  styleUrl: "./home.css",
})
export class HomeComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.authService.usuarioActual;

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
  ];

  readonly esRrhh = computed(() => {
    const raw = this.usuario() as unknown;
    if (!raw || typeof raw !== "object") return false;

    const fuente = raw as Record<string, unknown>;
    const candidatos = [
      fuente,
      typeof fuente["usuario"] === "object" && fuente["usuario"] !== null
        ? (fuente["usuario"] as Record<string, unknown>)
        : null,
      typeof fuente["empleado"] === "object" && fuente["empleado"] !== null
        ? (fuente["empleado"] as Record<string, unknown>)
        : null,
    ].filter((obj): obj is Record<string, unknown> => obj !== null);

    for (const u of candidatos) {
      if (
        u["es_admin"] === true ||
        u["es_admin"] === 1 ||
        u["admin"] === true ||
        u["admin"] === 1
      ) {
        return true;
      }

      const texto = Object.values(u)
        .filter((v): v is string | number | boolean =>
          typeof v === "string" || typeof v === "number" || typeof v === "boolean"
        )
        .map((v) => String(v))
        .join(" ")
        .toLowerCase();

      if (
        texto.includes("rrhh") ||
        texto.includes("recursos humanos") ||
        texto.includes("humanas") ||
        texto.includes("admin") ||
        texto.includes("claudia") ||
        texto.includes("iliana")
      ) {
        return true;
      }
    }

    return false;
  });

  readonly modulos = computed(() =>
    this.todosLosModulos.filter((modulo) => !modulo.soloRrhh || this.esRrhh())
  );

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