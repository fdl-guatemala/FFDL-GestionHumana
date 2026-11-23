import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

export interface UsuarioSesion {
  id: number;
  empleado_id: number;
  codigo_empleado: string;
  rol_id: number | null;
  activo: number | boolean;
  nombre_completo?: string;
  nombre_empleado?: string;
  nombre_empleados?: string;
  puesto?: string;
  sucursal?: string;
  lugar?: string;
  jefe_inmediato?: string;
  nombre_jefe_inmediato?: string;
  roles: number[];
}

export interface RegistroPayload {
  sucursal: string;
  correo: string;
  password: string;
}

export interface RegistroResponse {
  message?: string;
  usuario?: UsuarioSesion;
}

interface LoginResponse {
  usuario: UsuarioSesion;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly esNavegador = isPlatformBrowser(this.platformId);

  private readonly storageKey = 'gh_usuario_sesion';
  private readonly apiUrl = 'http://localhost:3000/api';

  readonly usuarioActual = signal<UsuarioSesion | null>(this.leerSesion());

  private leerSesion(): UsuarioSesion | null {
    if (!this.esNavegador) return null;

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioSesion;
    } catch {
      return null;
    }
  }

  login(codigo_empleado: string, password: string) {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/usuarios/login`, {
        codigo_empleado,
        password,
      })
      .pipe(
        tap((res) => {
          if (this.esNavegador) {
            localStorage.setItem(this.storageKey, JSON.stringify(res.usuario));
          }
          this.usuarioActual.set(res.usuario);
        })
      );
  }

  registrar(data: RegistroPayload) {
    return this.http.post<RegistroResponse>(`${this.apiUrl}/usuarios/register`, data);
  }

  logout(): void {
    if (this.esNavegador) {
      localStorage.removeItem(this.storageKey);
    }
    this.usuarioActual.set(null);
  }

  estaAutenticado(): boolean {
    return this.usuarioActual() !== null;
  }
}