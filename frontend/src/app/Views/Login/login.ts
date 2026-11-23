import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  codigo_empleado = '';
  contrasena = '';
  readonly cargando = signal(false);
  readonly errorMsg = signal('');

  iniciarSesion(): void {
    this.errorMsg.set('');

    const codigoLimpio = this.codigo_empleado.trim();
    const claveLimpia = this.contrasena;

    if (!codigoLimpio || !claveLimpia.trim()) {
      this.errorMsg.set('Debes ingresar tu usuario o código y contraseña.');
      return;
    }

    this.cargando.set(true);

    this.authService.login(codigoLimpio, claveLimpia).subscribe({
      next: () => {
        this.cargando.set(false);
        this.contrasena = '';
        void this.router.navigate(['/home']);
      },
      error: (err) => {
        this.cargando.set(false);
        const mensajeBackend =
          err?.error?.message ??
          err?.error?.error ??
          (err?.status === 500
            ? 'Error interno del servidor al iniciar sesión. Revisa la consola del backend.'
            : 'Credenciales inválidas o usuario inactivo.');
        this.errorMsg.set(String(mensajeBackend));
      },
    });
  }
}