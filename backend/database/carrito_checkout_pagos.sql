/*
  FerreStock360 - carrito, pedidos y pagos académicos.
  Validado contra dbo.usuarios(id_usuario), dbo.productos(id_producto, nombre,
  codigo, precio DECIMAL(10,2), stock_actual, estado, imagen_1, imagen_2).
  Crear únicamente tablas nuevas; no altera tablas existentes. Ejecutar manualmente
  en la base Azure SQL correcta. Es seguro volver a ejecutarlo.
*/
IF OBJECT_ID(N'dbo.carritos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.carritos (
    id_carrito INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_carritos PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_carritos_fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_carritos_usuario UNIQUE (id_usuario),
    CONSTRAINT FK_carritos_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
  );
END;
GO

IF OBJECT_ID(N'dbo.carrito_detalles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.carrito_detalles (
    id_detalle INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_carrito_detalles PRIMARY KEY,
    id_carrito INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    fecha_actualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_carrito_detalles_fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_carrito_detalles_producto UNIQUE (id_carrito, id_producto),
    CONSTRAINT CK_carrito_detalles_cantidad CHECK (cantidad > 0),
    CONSTRAINT FK_carrito_detalles_carritos FOREIGN KEY (id_carrito) REFERENCES dbo.carritos(id_carrito) ON DELETE CASCADE,
    CONSTRAINT FK_carrito_detalles_productos FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto)
  );
END;
GO

IF OBJECT_ID(N'dbo.pedidos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pedidos (
    id_pedido INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pedidos PRIMARY KEY,
    codigo_pedido NVARCHAR(32) NULL,
    id_usuario INT NOT NULL,
    clave_idempotencia UNIQUEIDENTIFIER NOT NULL,
    fecha_pedido DATETIME2(0) NOT NULL CONSTRAINT DF_pedidos_fecha DEFAULT SYSUTCDATETIME(),
    fecha_retiro DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago NVARCHAR(30) NOT NULL,
    estado_pedido NVARCHAR(40) NOT NULL,
    CONSTRAINT UQ_pedidos_idempotencia UNIQUE (id_usuario, clave_idempotencia),
    CONSTRAINT CK_pedidos_importes CHECK (subtotal >= 0 AND total >= 0 AND subtotal = total),
    CONSTRAINT CK_pedidos_metodo CHECK (metodo_pago IN (N'efectivo', N'tarjeta')),
    CONSTRAINT CK_pedidos_estado CHECK (estado_pedido IN (N'reservado', N'pendiente_retiro', N'entregado', N'cancelado', N'vencido', N'rechazado')),
    CONSTRAINT FK_pedidos_usuarios FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
  );
END;
GO

IF OBJECT_ID(N'dbo.pedido_detalles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pedido_detalles (
    id_detalle INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pedido_detalles PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,
    nombre_producto NVARCHAR(300) NOT NULL,
    codigo_producto NVARCHAR(100) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    cantidad INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    imagen_url VARCHAR(MAX) NULL,
    CONSTRAINT CK_pedido_detalles_importes CHECK (precio_unitario >= 0 AND cantidad > 0 AND subtotal >= 0),
    CONSTRAINT FK_pedido_detalles_pedidos FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido) ON DELETE CASCADE,
    CONSTRAINT FK_pedido_detalles_productos FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto)
  );
END;
GO

IF OBJECT_ID(N'dbo.pagos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pagos (
    id_pago INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pagos PRIMARY KEY,
    id_pedido INT NOT NULL,
    metodo NVARCHAR(30) NOT NULL,
    estado NVARCHAR(40) NOT NULL,
    referencia_demo NVARCHAR(4) NULL,
    fecha_operacion DATETIME2(0) NOT NULL CONSTRAINT DF_pagos_fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_pagos_pedido UNIQUE (id_pedido),
    CONSTRAINT CK_pagos_metodo CHECK (metodo IN (N'efectivo', N'tarjeta')),
    CONSTRAINT CK_pagos_estado CHECK (estado IN (N'pendiente', N'aprobado', N'rechazado', N'cancelado')),
    CONSTRAINT FK_pagos_pedidos FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pedidos_usuario_fecha' AND object_id = OBJECT_ID(N'dbo.pedidos'))
  CREATE INDEX IX_pedidos_usuario_fecha ON dbo.pedidos(id_usuario, fecha_pedido DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_pedidos_codigo' AND object_id = OBJECT_ID(N'dbo.pedidos'))
  CREATE UNIQUE INDEX UX_pedidos_codigo ON dbo.pedidos(codigo_pedido) WHERE codigo_pedido IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pedido_detalles_pedido' AND object_id = OBJECT_ID(N'dbo.pedido_detalles'))
  CREATE INDEX IX_pedido_detalles_pedido ON dbo.pedido_detalles(id_pedido);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pagos_estado_fecha' AND object_id = OBJECT_ID(N'dbo.pagos'))
  CREATE INDEX IX_pagos_estado_fecha ON dbo.pagos(estado, fecha_operacion DESC);
GO

/* Reglas del flujo:
   - efectivo: pedido reservado con pago pendiente; conserva una reserva persistente
     de inventario hasta el pago/retiro o hasta que venza/cancele.
   - tarjeta simulada: una aprobación deja el pedido pendiente de retiro y un rechazo
     no confirma la compra y conserva la reserva temporal del carrito.
   - el stock físico y el movimiento de salida se actualizan una sola vez al entregar.
   Los datos PAN/CVV nunca se guardan; referencia_demo contiene solo los últimos
   cuatro dígitos de la tarjeta académica usada en la simulación.
*/
