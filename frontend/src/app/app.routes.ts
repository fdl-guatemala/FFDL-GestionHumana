import { Routes } from '@angular/router';
import { LoginComponent } from './Views/Login/login';
import { RegistroComponent } from './Views/Registro/registro';
import { HomeComponent } from './Views/Home/home';
import { SolicitarVacacionesComponent } from './Views/SolisitarVacasiones/solicitarvacaciones';
import { ProcesoVacacionesComponent } from './Views/ProcesoVacaciones/procesovacaciones';
import { EmpleadosComponent } from './Views/Empleados/empleados';
import { AgregarEmpleadoComponent } from './Views/AgregarEmpleado/agregarempleado';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: "registro", component: RegistroComponent},
  { path: "home", component: HomeComponent},
  { path: "solicitarvacaciones", component: SolicitarVacacionesComponent},
  { path: "procesovacaciones", component: ProcesoVacacionesComponent},
  { path: "empleados", component: EmpleadosComponent},
  { path: "agregar", component: AgregarEmpleadoComponent}
];