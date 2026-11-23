import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.services';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class RegistroComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  sucursales: string[] = [
    'Oficina Central en Guatemala',
    'Sucursal Mazatenango',
    'Sucursal Quetzaltenango',
    'Sucursal Chimaltenango'
  ];

  sucursal = '';
  correo = '';
  contrasena = '';
  confirmarContrasena = '';

  cargando = false;
  mensajeError = '';
  mensajeExito = '';

  registrarUsuario(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    const sucursalLimpia = this.sucursal.trim();
    const correoLimpio = this.correo.trim();

    if (!sucursalLimpia || !correoLimpio || !this.contrasena || !this.confirmarContrasena) {
      this.mensajeError = 'Por favor complete todos los campos obligatorios.';
      return;
    }

    if (this.contrasena.length < 6) {
      this.mensajeError = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.contrasena !== this.confirmarContrasena) {
      this.mensajeError = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;

    const payload = {
      sucursal: sucursalLimpia,
      correo: correoLimpio,
      password: this.contrasena
    };

    this.authService.registrar(payload).subscribe({
      next: (res) => {
        this.cargando = false;
        this.mensajeExito =
          res?.message ||
          'Solicitud enviada. Gestión Humana asignará y verificará su código.';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1800);
      },
      error: (err) => {
        this.cargando = false;
        this.mensajeError =
          err?.error?.message || err?.error?.error || 'No se pudo completar el registro.';
      }
    });
  }
}