-- ============================================
-- Base de datos: FerreStock360
-- Sistema de inventario para ferretería
-- ============================================

-- Crear la base de datos
-- posteriormente el backend utilizará esta base de datos
-- la conexión se configurará en backend/src/config/
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'FerreStock360')
BEGIN
    CREATE DATABASE FerreStock360;
END
GO

USE FerreStock360;
GO

-- ============================================
-- Tabla: roles
-- almacena los roles del sistema (admin, empleado)
-- ============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
BEGIN
    CREATE TABLE roles (
        id_rol INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(50) NOT NULL UNIQUE,
        descripcion NVARCHAR(200) NULL
    );
END
GO

-- ============================================
-- Tabla: usuarios
-- almacena los usuarios del sistema
-- cada usuario tiene un rol asignado
-- ============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='usuarios' AND xtype='U')
BEGIN
    CREATE TABLE usuarios (
        id_usuario INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        id_rol INT NOT NULL,
        estado BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_usuarios_roles FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
    );
END
GO

-- ============================================
-- Tabla: categorias
-- agrupa los productos por categoría
-- ============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='categorias' AND xtype='U')
BEGIN
    CREATE TABLE categorias (
        id_categoria INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(100) NOT NULL UNIQUE,
        descripcion NVARCHAR(200) NULL
    );
END
GO

-- ============================================
-- Tabla: productos
-- catálogo de productos de la ferretería
-- cada producto pertenece a una categoría
-- ============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='productos' AND xtype='U')
BEGIN
    CREATE TABLE productos (
        id_producto INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(150) NOT NULL,
        descripcion NVARCHAR(500) NULL,
        codigo NVARCHAR(50) NOT NULL UNIQUE,
        precio DECIMAL(10,2) NOT NULL,
        stock_actual INT NOT NULL DEFAULT 0,
        stock_minimo INT NOT NULL DEFAULT 5,
        id_categoria INT NOT NULL,
        estado BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_productos_categorias FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
    );
END
GO

-- ============================================
-- Tabla: movimientos_inventario
-- registra entradas y salidas de productos
-- cada movimiento indica quién lo hizo y de qué producto
-- ============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='movimientos_inventario' AND xtype='U')
BEGIN
    CREATE TABLE movimientos_inventario (
        id_movimiento INT PRIMARY KEY IDENTITY(1,1),
        id_producto INT NOT NULL,
        id_usuario INT NOT NULL,
        tipo_movimiento NVARCHAR(20) NOT NULL,
        cantidad INT NOT NULL,
        motivo NVARCHAR(300) NULL,
        fecha_movimiento DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_movimientos_productos FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
        CONSTRAINT FK_movimientos_usuarios FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
        CONSTRAINT CK_tipo_movimiento CHECK (tipo_movimiento IN ('entrada', 'salida'))
    );
END
GO

-- ============================================
-- Tabla: alertas_stock
-- almacena alertas cuando el stock es bajo
-- se genera una alerta por cada producto bajo mínimo
-- ============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='alertas_stock' AND xtype='U')
BEGIN
    CREATE TABLE alertas_stock (
        id_alerta INT PRIMARY KEY IDENTITY(1,1),
        id_producto INT NOT NULL,
        tipo_alerta NVARCHAR(50) NOT NULL,
        mensaje NVARCHAR(300) NOT NULL,
        estado NVARCHAR(20) NOT NULL DEFAULT 'pendiente',
        fecha_alerta DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_alertas_productos FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
        CONSTRAINT CK_estado_alerta CHECK (estado IN ('pendiente', 'resuelta'))
    );
END
GO

-- ============================================
-- Datos iniciales: roles por defecto
-- ============================================
IF NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'admin')
BEGIN
    INSERT INTO roles (nombre, descripcion) VALUES ('admin', 'Administrador del sistema');
END
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'empleado')
BEGIN
    INSERT INTO roles (nombre, descripcion) VALUES ('empleado', 'Empleado de la ferretería');
END
GO

PRINT 'Base de datos FerreStock360 creada correctamente.';
GO
