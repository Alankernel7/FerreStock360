/*
  Reservas temporales de inventario para FerreStock360.
  Usa las tablas ya instaladas: dbo.carritos(id_carrito),
  dbo.productos(id_producto, stock_actual). stock_actual continúa siendo stock físico.
  Este archivo crea únicamente dbo.reservas_inventario e índices asociados;
  se puede ejecutar varias veces. Ejecutarlo manualmente en la base correcta.

  Una reserva por carrito/producto puede estar activa a la vez. Al vencer, consumir
  o liberar una reserva, su fila se conserva como historial y se puede crear otra.
*/
IF OBJECT_ID(N'dbo.reservas_inventario', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.reservas_inventario (
    id_reserva BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_reservas_inventario PRIMARY KEY,
    id_carrito INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_reservas_fecha_creacion DEFAULT SYSUTCDATETIME(),
    fecha_expiracion DATETIME2(0) NOT NULL,
    estado NVARCHAR(20) NOT NULL CONSTRAINT DF_reservas_estado DEFAULT N'activa',
    CONSTRAINT CK_reservas_cantidad CHECK (cantidad > 0),
    CONSTRAINT CK_reservas_estado CHECK (estado IN (N'activa', N'consumida', N'liberada', N'vencida')),
    CONSTRAINT CK_reservas_fechas CHECK (fecha_expiracion > fecha_creacion),
    CONSTRAINT FK_reservas_carritos FOREIGN KEY (id_carrito) REFERENCES dbo.carritos(id_carrito) ON DELETE CASCADE,
    CONSTRAINT FK_reservas_productos FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_reservas_carrito_producto_activa' AND object_id = OBJECT_ID(N'dbo.reservas_inventario'))
  CREATE UNIQUE INDEX UX_reservas_carrito_producto_activa
    ON dbo.reservas_inventario(id_carrito, id_producto)
    WHERE estado = N'activa';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_reservas_producto_disponibilidad' AND object_id = OBJECT_ID(N'dbo.reservas_inventario'))
  CREATE INDEX IX_reservas_producto_disponibilidad
    ON dbo.reservas_inventario(id_producto, estado, fecha_expiracion)
    INCLUDE (cantidad, id_carrito);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_reservas_carrito_estado' AND object_id = OBJECT_ID(N'dbo.reservas_inventario'))
  CREATE INDEX IX_reservas_carrito_estado
    ON dbo.reservas_inventario(id_carrito, estado, fecha_expiracion)
    INCLUDE (id_producto, cantidad);
GO

/* Consultas de verificación posteriores a ejecutar el script. */
SELECT t.name AS tabla, c.name AS columna, ty.name AS tipo_dato,
       c.is_nullable AS permite_null
FROM sys.tables t
INNER JOIN sys.columns c ON c.object_id = t.object_id
INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.object_id = OBJECT_ID(N'dbo.reservas_inventario')
ORDER BY c.column_id;

SELECT i.name AS indice, i.is_unique AS es_unico, i.filter_definition AS filtro
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID(N'dbo.reservas_inventario')
  AND i.name IS NOT NULL
ORDER BY i.name;
