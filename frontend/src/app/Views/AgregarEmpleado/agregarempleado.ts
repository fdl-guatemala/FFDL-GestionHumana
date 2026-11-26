import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

interface NuevoEmpleadoForm {
  codigo_empleado: string;
  nombre_completo: string;
  puesto: string;
  jefe_inmediato: string;
  lugar: string;
  fecha_ingreso: string;
  fecha_ingreso_prueba: string;
  estado: string;
  password: string;
  rol_id: number | null;
}

interface RespuestaEliminarCodigo {
  eliminado?: boolean;
  message?: string;
  codigo_empleado?: string;
  nombre_completo?: string;
}

@Component({
  selector: 'app-agregar-empleado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './agregarempleado.html',
  styleUrl: './agregarempleado.css',
})
export class AgregarEmpleadoComponent {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly apiUrl = 'http://localhost:3000/api';

  private fechaHoy(): string {
    return new Date().toISOString().split('T')[0];
  }

  private crearFormularioVacio(): NuevoEmpleadoForm {
    return {
      codigo_empleado: '',
      nombre_completo: '',
      puesto: '',
      jefe_inmediato: '',
      lugar: '',
      fecha_ingreso: this.fechaHoy(),
      fecha_ingreso_prueba: '',
      estado: 'Activo',
      password: '',
      rol_id: null,
    };
  }

  empleado: NuevoEmpleadoForm = this.crearFormularioVacio();

  guardando = false;
  mensajeError = '';
  mensajeExito = '';

  codigoBuscar = '';
  mensajeBuscarError = '';

  codigoEliminar = '';
  eliminando = false;
  mensajeEliminarError = '';
  mensajeEliminarExito = '';

  buscarEmpleadoPorCodigo(): void {
    this.mensajeBuscarError = '';

    const codigo = this.codigoBuscar.trim();
    if (!codigo) {
      this.mensajeBuscarError = 'Ingresa el código del empleado que deseas buscar.';
      this.cdr.detectChanges();
      return;
    }

    this.router.navigate(['/empleados'], {
      queryParams: { codigo },
    });
  }

  guardarEmpleado(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    if (
      !this.empleado.codigo_empleado.trim() ||
      !this.empleado.nombre_completo.trim() ||
      !this.empleado.puesto.trim() ||
      !this.empleado.lugar.trim() ||
      !this.empleado.fecha_ingreso.trim() ||
      !this.empleado.password.trim()
    ) {
      this.mensajeError =
        'Completa código, nombre completo, puesto, sede/lugar, fecha de ingreso y contraseña.';
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      codigo_empleado: this.empleado.codigo_empleado.trim(),
      nombre_completo: this.empleado.nombre_completo.trim(),
      puesto: this.empleado.puesto.trim(),
      jefe_inmediato: this.empleado.jefe_inmediato.trim() || null,
      lugar: this.empleado.lugar.trim(),
      fecha_ingreso: this.empleado.fecha_ingreso,
      fecha_ingreso_prueba: this.empleado.fecha_ingreso_prueba || null,
      estado: this.empleado.estado || 'Activo',
      password: this.empleado.password,
      rol_id: this.empleado.rol_id,
    };

    this.guardando = true;
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/empleados`, payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mensajeExito = 'Se guardaron los datos en la base de datos.';
        this.empleado = this.crearFormularioVacio();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardando = false;
        this.mensajeError =
          err?.error?.message ||
          err?.error?.mensaje ||
          'No se pudieron guardar los datos en la base de datos.';
        this.cdr.detectChanges();
      },
    });
  }

  eliminarPorCodigo(): void {
    this.mensajeEliminarError = '';
    this.mensajeEliminarExito = '';

    const codigo = this.codigoEliminar.trim();
    if (!codigo) {
      this.mensajeEliminarError =
        'Ingresa el código del empleado que deseas eliminar.';
      this.cdr.detectChanges();
      return;
    }

    const confirmar = window.confirm(
      `¿Seguro que deseas eliminar al empleado con código "${codigo}"? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    this.eliminando = true;
    this.cdr.detectChanges();

    this.http
      .delete<RespuestaEliminarCodigo>(
        `${this.apiUrl}/empleados/codigo/${encodeURIComponent(codigo)}`
      )
      .subscribe({
        next: (resp) => {
          this.eliminando = false;
          const codigoEliminado = resp?.codigo_empleado || codigo;
          const nombrePersona = resp?.nombre_completo?.trim();

          this.mensajeEliminarExito = nombrePersona
            ? `Fue eliminado el código ${codigoEliminado} correspondiente a ${nombrePersona}.`
            : `Fue eliminado el código ${codigoEliminado}.`;

          this.codigoEliminar = '';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.eliminando = false;
          this.mensajeEliminarError =
            err?.error?.message ||
            err?.error?.mensaje ||
            'No se pudo eliminar el empleado con ese código.';
          this.cdr.detectChanges();
        },
      });
  }
}