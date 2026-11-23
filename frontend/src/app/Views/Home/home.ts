import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.services'; // Ajusta la ruta si es distinta

interface ModuloAcceso {
  titulo: string;
  descripcion: string;
  ruta: string;
  etiqueta: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.authService.usuarioActual;

  readonly modulos: ModuloAcceso[] = [
    {
      titulo: 'Proceso de Vacaciones',
      descripcion: 'Consulta el estado, seguimiento y periodos de vacaciones disponibles.',
      ruta: '/procesovacaciones',
      etiqueta: '01 · Seguimiento'
    },
    {
      titulo: 'Solicitar Vacaciones',
      descripcion: 'Registra y envía nuevas solicitudes de vacaciones de forma ágil.',
      ruta: '/solicitarvacaciones',
      etiqueta: '02 · Solicitudes'
    },
    {
      titulo: 'Empleados',
      descripcion: 'Consulta y administración del inventario de colaboradores y sedes.',
      ruta: '/empleados',
      etiqueta: '03 · Personal'
    }
  ];

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}