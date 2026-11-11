-- ============================================
-- FerreStock360
-- Esquema para Azure SQL Database
-- ============================================


-- ============================================
-- Tabla: roles
-- ============================================

IF OBJECT_ID('dbo.roles', 'U') IS NULL
BEGIN
    CREATE TABLE roles (
        id_rol INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(50) NOT NULL UNIQUE,
        descripcion NVARCHAR(200) NULL
    );
END;


-- ============================================
-- Tabla: usuarios
-- ============================================

IF OBJECT_ID('dbo.usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE usuarios (
        id_usuario INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        id_rol INT NOT NULL,
        estado BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_usuarios_roles
            FOREIGN KEY (id_rol)
            REFERENCES roles(id_rol)
    );
END;


-- ============================================
-- Tabla: categorias
-- ============================================

IF OBJECT_ID('dbo.categorias', 'U') IS NULL
BEGIN
    CREATE TABLE categorias (
        id_categoria INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(100) NOT NULL UNIQUE,
        descripcion NVARCHAR(200) NULL
    );
END;


-- ============================================
-- Tabla: productos
-- ============================================

IF OBJECT_ID('dbo.productos', 'U') IS NULL
BEGIN
    CREATE TABLE productos (
        id_producto INT PRIMARY KEY IDENTITY(1,1),
        nombre NVARCHAR(150) NOT NULL,
        descripcion NVARCHAR(500) NULL,
        codigo NVARCHAR(50) NOT NULL UNIQUE,
        precio DECIMAL(10,2) NOT NULL,
        imagen_url NVARCHAR(500) NULL,
        stock_actual INT NOT NULL DEFAULT 0,
        stock_minimo INT NOT NULL DEFAULT 5,
        id_categoria INT NOT NULL,
        estado BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_productos_categorias
            FOREIGN KEY (id_categoria)
            REFERENCES categorias(id_categoria)
    );
END;


-- ============================================
-- Tabla: movimientos_inventario
-- ============================================

IF OBJECT_ID('dbo.movimientos_inventario', 'U') IS NULL
BEGIN
    CREATE TABLE movimientos_inventario (
        id_movimiento INT PRIMARY KEY IDENTITY(1,1),
        id_producto INT NOT NULL,
        id_usuario INT NOT NULL,
        tipo_movimiento NVARCHAR(20) NOT NULL,
        cantidad INT NOT NULL,
        motivo NVARCHAR(300) NULL,
        fecha_movimiento DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_movimientos_productos
            FOREIGN KEY (id_producto)
            REFERENCES productos(id_producto),

        CONSTRAINT FK_movimientos_usuarios
            FOREIGN KEY (id_usuario)
            REFERENCES usuarios(id_usuario),

        CONSTRAINT CK_tipo_movimiento
            CHECK (tipo_movimiento IN ('entrada', 'salida'))
    );
END;


-- ============================================
-- Tabla: alertas_stock
-- ============================================

IF OBJECT_ID('dbo.alertas_stock', 'U') IS NULL
BEGIN
    CREATE TABLE alertas_stock (
        id_alerta INT PRIMARY KEY IDENTITY(1,1),
        id_producto INT NOT NULL,
        tipo_alerta NVARCHAR(50) NOT NULL,
        mensaje NVARCHAR(300) NOT NULL,
        estado NVARCHAR(20) NOT NULL DEFAULT 'pendiente',
        fecha_alerta DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_alertas_productos
            FOREIGN KEY (id_producto)
            REFERENCES productos(id_producto),

        CONSTRAINT CK_estado_alerta
            CHECK (estado IN ('pendiente', 'resuelta'))
    );
END;


-- ============================================
-- Roles del sistema
-- ============================================

IF NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE nombre = 'admin'
)
BEGIN
    INSERT INTO roles (nombre, descripcion)
    VALUES (
        'admin',
        'Administrador del sistema'
    );
END;


IF NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE nombre = 'empleado'
)
BEGIN
    INSERT INTO roles (nombre, descripcion)
    VALUES (
        'empleado',
        'Empleado de la ferretería'
    );
END;