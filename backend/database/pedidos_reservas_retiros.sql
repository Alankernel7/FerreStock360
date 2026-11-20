/*
  FerreStock360: fecha de retiro, compromisos de reserva e historial de pedidos.

  Ejecutar manualmente en la base FerreStock360. Este script no borra filas ni
  cambia productos, categorías, carritos, detalles, pagos ni pedidos existentes.
  A los pedidos históricos se les asigna como fecha de retiro su fecha_pedido.
  Las reservas históricas quedan con id_pedido NULL; no se infiere una relación.

  Se aborta antes de modificar nada si ya hay pagos/pedidos históricos con
  transferencia. La base revisada no contiene ninguno; abortar en otra base
  preserva sus registros y sus restricciones para revisión manual.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.pedidos', N'U') IS NULL
    THROW 51000, 'No existe dbo.pedidos; no se aplicó la migración.', 1;
  IF OBJECT_ID(N'dbo.pagos', N'U') IS NULL
    THROW 51001, 'No existe dbo.pagos; no se aplicó la migración.', 1;
  IF OBJECT_ID(N'dbo.reservas_inventario', N'U') IS NULL
    THROW 51002, 'No existe dbo.reservas_inventario; no se aplicó la migración.', 1;
  IF OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
    THROW 51003, 'No existe dbo.usuarios; no se aplicó la migración.', 1;

  IF EXISTS (SELECT 1 FROM dbo.pedidos WHERE metodo_pago=N'transferencia')
     OR EXISTS (SELECT 1 FROM dbo.pagos WHERE metodo=N'transferencia')
    THROW 51004, 'Hay registros históricos con transferencia. No se modificó ninguna restricción; revíselos antes de migrar.', 1;

  /* Agregar fecha_retiro en una instrucción independiente. Las referencias a
     esa columna se ejecutan dinámicamente después del ALTER, para que SQL Server
     no compile el UPDATE contra la definición anterior de dbo.pedidos (Msg 207). */
  IF COL_LENGTH(N'dbo.pedidos', N'fecha_retiro') IS NULL
    ALTER TABLE dbo.pedidos ADD fecha_retiro DATE NULL;

  EXEC sys.sp_executesql N'
    UPDATE dbo.pedidos
    SET fecha_retiro = CONVERT(DATE, fecha_pedido)
    WHERE fecha_retiro IS NULL;';

  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id=OBJECT_ID(N'dbo.pedidos') AND name=N'fecha_retiro' AND is_nullable=1
  )
    EXEC sys.sp_executesql N'ALTER TABLE dbo.pedidos ALTER COLUMN fecha_retiro DATE NOT NULL;';

  IF COL_LENGTH(N'dbo.pedidos', N'fecha_cancelacion') IS NULL
    ALTER TABLE dbo.pedidos ADD fecha_cancelacion DATETIME2(0) NULL;
  IF COL_LENGTH(N'dbo.pedidos', N'motivo_cancelacion') IS NULL
    ALTER TABLE dbo.pedidos ADD motivo_cancelacion NVARCHAR(500) NULL;
  IF COL_LENGTH(N'dbo.pedidos', N'fecha_entrega') IS NULL
    ALTER TABLE dbo.pedidos ADD fecha_entrega DATETIME2(0) NULL;

  /* El FK solo se agrega a la nueva columna vacía; no se asocian reservas viejas. */
  IF COL_LENGTH(N'dbo.reservas_inventario', N'id_pedido') IS NULL
    ALTER TABLE dbo.reservas_inventario ADD id_pedido INT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id=OBJECT_ID(N'dbo.reservas_inventario')
      AND name=N'FK_reservas_pedidos'
  )
    EXEC sys.sp_executesql N'
      ALTER TABLE dbo.reservas_inventario WITH CHECK
        ADD CONSTRAINT FK_reservas_pedidos
        FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido);';

  /* fecha_expiracion es clave de dos índices y está en CK_reservas_fechas.
     Se retiran esas dependencias dentro de la transacción, se cambia NULL y se
     reconstruyen con las mismas columnas/INCLUDE que tiene el esquema real. */
  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'CK_reservas_fechas'
  )
    ALTER TABLE dbo.reservas_inventario DROP CONSTRAINT CK_reservas_fechas;

  IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'IX_reservas_producto_disponibilidad'
  )
    DROP INDEX IX_reservas_producto_disponibilidad ON dbo.reservas_inventario;
  IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'IX_reservas_carrito_estado'
  )
    DROP INDEX IX_reservas_carrito_estado ON dbo.reservas_inventario;

  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id=OBJECT_ID(N'dbo.reservas_inventario')
      AND name=N'fecha_expiracion' AND is_nullable=0
  )
    ALTER TABLE dbo.reservas_inventario ALTER COLUMN fecha_expiracion DATETIME2(0) NULL;

  /* Reemplazos explícitos de CHECK conocidos en el esquema real. Los estados
     históricos permitidos por las restricciones actuales siguen permitidos. */
  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID(N'dbo.pedidos') AND name=N'CK_pedidos_estado'
  )
    ALTER TABLE dbo.pedidos DROP CONSTRAINT CK_pedidos_estado;
  ALTER TABLE dbo.pedidos WITH CHECK ADD CONSTRAINT CK_pedidos_estado
    CHECK (estado_pedido IN (
      N'pendiente_pago',N'confirmado',N'rechazado',N'reservado',
      N'pendiente_retiro',N'entregado',N'cancelado',N'vencido'
    ));

  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID(N'dbo.pagos') AND name=N'CK_pagos_estado'
  )
    ALTER TABLE dbo.pagos DROP CONSTRAINT CK_pagos_estado;
  ALTER TABLE dbo.pagos WITH CHECK ADD CONSTRAINT CK_pagos_estado
    CHECK (estado IN (
      N'pendiente_efectivo',N'pendiente_verificacion',N'pendiente',
      N'aprobado',N'rechazado',N'cancelado'
    ));

  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID(N'dbo.pedidos') AND name=N'CK_pedidos_metodo'
  )
    ALTER TABLE dbo.pedidos DROP CONSTRAINT CK_pedidos_metodo;
  ALTER TABLE dbo.pedidos WITH CHECK ADD CONSTRAINT CK_pedidos_metodo
    CHECK (metodo_pago IN (N'efectivo',N'tarjeta'));

  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID(N'dbo.pagos') AND name=N'CK_pagos_metodo'
  )
    ALTER TABLE dbo.pagos DROP CONSTRAINT CK_pagos_metodo;
  ALTER TABLE dbo.pagos WITH CHECK ADD CONSTRAINT CK_pagos_metodo
    CHECK (metodo IN (N'efectivo',N'tarjeta'));

  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'CK_reservas_estado'
  )
    ALTER TABLE dbo.reservas_inventario DROP CONSTRAINT CK_reservas_estado;
  ALTER TABLE dbo.reservas_inventario WITH CHECK ADD CONSTRAINT CK_reservas_estado
    CHECK (estado IN (N'activa',N'confirmada',N'consumida',N'liberada',N'vencida',N'cancelada'));

  ALTER TABLE dbo.reservas_inventario WITH CHECK ADD CONSTRAINT CK_reservas_fechas
    CHECK (
      (fecha_expiracion IS NOT NULL AND fecha_expiracion > fecha_creacion)
      OR (fecha_expiracion IS NULL AND estado IN (N'confirmada',N'consumida',N'cancelada',N'vencida'))
    );

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'IX_reservas_producto_disponibilidad'
  )
    CREATE INDEX IX_reservas_producto_disponibilidad
      ON dbo.reservas_inventario(id_producto,estado,fecha_expiracion)
      INCLUDE (cantidad,id_carrito);
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'IX_reservas_carrito_estado'
  )
    CREATE INDEX IX_reservas_carrito_estado
      ON dbo.reservas_inventario(id_carrito,estado,fecha_expiracion)
      INCLUDE (id_producto,cantidad);
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.reservas_inventario') AND name=N'IX_reservas_pedido_estado'
  )
    EXEC sys.sp_executesql N'
      CREATE INDEX IX_reservas_pedido_estado
        ON dbo.reservas_inventario(id_pedido,estado) INCLUDE (id_producto,cantidad);';

  IF OBJECT_ID(N'dbo.historial_pedidos', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.historial_pedidos (
      id_historial BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_historial_pedidos PRIMARY KEY,
      id_pedido INT NOT NULL,
      id_usuario INT NULL,
      estado_anterior NVARCHAR(40) NULL,
      estado_nuevo NVARCHAR(40) NOT NULL,
      estado_pago_anterior NVARCHAR(40) NULL,
      estado_pago_nuevo NVARCHAR(40) NULL,
      motivo NVARCHAR(500) NULL,
      fecha_cambio DATETIME2(0) NOT NULL CONSTRAINT DF_historial_pedidos_fecha DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_historial_pedidos_pedido FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido),
      CONSTRAINT FK_historial_pedidos_usuario FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario)
    );
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.historial_pedidos') AND name=N'IX_historial_pedidos_pedido_fecha'
  )
    EXEC sys.sp_executesql N'
      CREATE INDEX IX_historial_pedidos_pedido_fecha
        ON dbo.historial_pedidos(id_pedido,fecha_cambio DESC);';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

/* Consultas de verificación posteriores a la ejecución manual. */
SELECT OBJECT_NAME(c.object_id) AS tabla,c.name AS columna,
       TYPE_NAME(c.user_type_id) AS tipo,c.is_nullable
FROM sys.columns c
WHERE c.object_id IN (
  OBJECT_ID(N'dbo.pedidos'),OBJECT_ID(N'dbo.reservas_inventario'),
  OBJECT_ID(N'dbo.historial_pedidos')
)
ORDER BY tabla,c.column_id;

SELECT OBJECT_NAME(parent_object_id) AS tabla,name AS restriccion,definition
FROM sys.check_constraints
WHERE parent_object_id IN (
  OBJECT_ID(N'dbo.pedidos'),OBJECT_ID(N'dbo.pagos'),
  OBJECT_ID(N'dbo.reservas_inventario')
)
ORDER BY tabla,name;

SELECT OBJECT_NAME(parent_object_id) AS tabla,name AS llave_foranea,
       OBJECT_NAME(referenced_object_id) AS tabla_referenciada
FROM sys.foreign_keys
WHERE name IN (N'FK_reservas_pedidos',N'FK_historial_pedidos_pedido',N'FK_historial_pedidos_usuario')
ORDER BY tabla,name;

SELECT OBJECT_NAME(object_id) AS tabla,name AS indice,is_unique,filter_definition
FROM sys.indexes
WHERE object_id IN (OBJECT_ID(N'dbo.reservas_inventario'),OBJECT_ID(N'dbo.historial_pedidos'))
  AND name IN (
    N'IX_reservas_producto_disponibilidad',N'IX_reservas_carrito_estado',
    N'IX_reservas_pedido_estado',N'IX_historial_pedidos_pedido_fecha'
  )
ORDER BY tabla,name;

SELECT
  (SELECT COUNT(*) FROM dbo.pedidos WHERE metodo_pago=N'transferencia') AS pedidos_historicos_transferencia,
  (SELECT COUNT(*) FROM dbo.pagos WHERE metodo=N'transferencia') AS pagos_historicos_transferencia;
