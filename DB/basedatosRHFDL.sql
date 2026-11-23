create database if not exists fdl_Guatemala;
use fdl_Guatemala;

-- 1. CREACIÓN DE TABLAS
DROP TABLE IF EXISTS registro_vacaciones CASCADE;
DROP TABLE IF EXISTS periodos_vacaciones CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT
);

CREATE TABLE empleados (
    id SERIAL PRIMARY KEY,
    codigo_empleado VARCHAR(20) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    jefe_inmediato VARCHAR(150),
    lugar VARCHAR(100) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    fecha_ingreso_prueba DATE,
    fecha_egreso DATE,
    estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id) ON DELETE CASCADE,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol_id INT REFERENCES roles(id),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE periodos_vacaciones (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id) ON DELETE CASCADE,
    fecha_inicio_periodo DATE NOT NULL,
    fecha_fin_periodo DATE NOT NULL,
    dias_disponibles DECIMAL(5,2) DEFAULT 0.00
);

CREATE TABLE registro_vacaciones (
    id SERIAL PRIMARY KEY,
    empleado_id INT REFERENCES empleados(id) ON DELETE CASCADE,
    periodo_id INT REFERENCES periodos_vacaciones(id) ON DELETE CASCADE,
    fecha_disfrute VARCHAR(50) NOT NULL,
    dias_tomados DECIMAL(4,2) NOT NULL,
    estado_constancia VARCHAR(100),
    observaciones TEXT
);