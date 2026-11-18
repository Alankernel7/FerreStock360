IF OBJECT_ID('dbo.notificaciones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.notificaciones (
    id_notificacion BIGINT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_notificaciones PRIMARY KEY,
    tipo NVARCHAR(40) NOT NULL,
    titulo NVARCHAR(150) NOT NULL,
    descripcion NVARCHAR(500) NOT NULL,
    id_producto INT NULL,
    id_movimiento INT NULL,
    leida BIT NOT NULL CONSTRAINT DF_notificaciones_leida DEFAULT (0),
    fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_notificaciones_fecha DEFAULT (SYSDATETIME()),
    fecha_lectura DATETIME2(0) NULL,
    estado_stock NVARCHAR(20) NULL,
    CONSTRAINT FK_notificaciones_movimientos FOREIGN KEY (id_movimiento)
      REFERENCES dbo.movimientos_inventario(id_movimiento),
    CONSTRAINT CK_notificaciones_tipo CHECK (tipo IN (
      'stock_bajo', 'producto_agotado', 'entrada_inventario', 'salida_inventario'
    )),
    CONSTRAINT CK_notificaciones_referencias CHECK (
      (tipo IN ('stock_bajo', 'producto_agotado') AND id_producto IS NOT NULL
        AND id_movimiento IS NULL AND estado_stock IS NOT NULL
        AND estado_stock IN ('activa', 'resuelta'))
      OR
      (tipo IN ('entrada_inventario', 'salida_inventario') AND id_producto IS NOT NULL
        AND id_movimiento IS NOT NULL AND estado_stock IS NULL)
    )
  );
END;

-- Mantiene el historial aunque se elimine un producto; el ID y la descripción
-- quedan como referencia histórica y no interfieren con el módulo Productos.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('dbo.notificaciones') AND name = 'FK_notificaciones_productos')
  ALTER TABLE dbo.notificaciones DROP CONSTRAINT FK_notificaciones_productos;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.notificaciones') AND name = 'UX_notificaciones_stock_activa')
  CREATE UNIQUE INDEX UX_notificaciones_stock_activa
    ON dbo.notificaciones(id_producto, tipo)
    WHERE estado_stock = 'activa';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.notificaciones') AND name = 'UX_notificaciones_movimiento')
  CREATE UNIQUE INDEX UX_notificaciones_movimiento
    ON dbo.notificaciones(id_movimiento)
    WHERE id_movimiento IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.notificaciones') AND name = 'IX_notificaciones_fecha')
  CREATE INDEX IX_notificaciones_fecha
    ON dbo.notificaciones(fecha_creacion DESC, id_notificacion DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.notificaciones') AND name = 'IX_notificaciones_no_leidas')
  CREATE INDEX IX_notificaciones_no_leidas
    ON dbo.notificaciones(leida, fecha_creacion DESC)
    WHERE leida = 0;
