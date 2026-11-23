/* FerreStock360: notificaciones persistentes para cambios de estado de pedidos.
   Ejecutar manualmente después de notificaciones.sql y pedidos_reservas_retiros.sql.
   Este script conserva notificaciones existentes y no modifica el ciclo técnico
   de estados ni ningún pedido, pago, reserva o movimiento.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF @@TRANCOUNT <> 0
  THROW 51102, 'Hay una transacción abierta en esta sesión. Revísela antes de ejecutar la migración.', 1;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.notificaciones', N'U') IS NULL
    THROW 51100, 'Ejecute primero database/notificaciones.sql.', 1;
  IF OBJECT_ID(N'dbo.pedidos', N'U') IS NULL OR OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
    THROW 51101, 'Se requieren dbo.pedidos y dbo.usuarios antes de esta migración.', 1;

  IF COL_LENGTH(N'dbo.notificaciones', N'id_usuario') IS NULL
    ALTER TABLE dbo.notificaciones ADD id_usuario INT NULL;
  IF COL_LENGTH(N'dbo.notificaciones', N'id_pedido') IS NULL
    ALTER TABLE dbo.notificaciones ADD id_pedido INT NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'dbo.notificaciones') AND name=N'FK_notificaciones_usuarios')
    ALTER TABLE dbo.notificaciones WITH CHECK ADD CONSTRAINT FK_notificaciones_usuarios
      FOREIGN KEY (id_usuario) REFERENCES dbo.usuarios(id_usuario);
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'dbo.notificaciones') AND name=N'FK_notificaciones_pedidos')
    ALTER TABLE dbo.notificaciones WITH CHECK ADD CONSTRAINT FK_notificaciones_pedidos
      FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido);

  IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.notificaciones') AND name=N'CK_notificaciones_tipo')
    ALTER TABLE dbo.notificaciones DROP CONSTRAINT CK_notificaciones_tipo;
  ALTER TABLE dbo.notificaciones WITH CHECK ADD CONSTRAINT CK_notificaciones_tipo CHECK (tipo IN (
    N'stock_bajo',N'producto_agotado',N'entrada_inventario',N'salida_inventario',
    N'pedido_pendiente',N'pedido_pagado',N'pedido_cancelado'
  ));

  /* Ejecutar dinámicamente porque SQL Server compila las referencias a las
     columnas nuevas antes de procesar los ALTER TABLE de este mismo lote. */
  EXEC sys.sp_executesql N'
    IF EXISTS (SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id=OBJECT_ID(N''dbo.notificaciones'') AND name=N''CK_notificaciones_referencias'')
      ALTER TABLE dbo.notificaciones DROP CONSTRAINT CK_notificaciones_referencias;
    ALTER TABLE dbo.notificaciones WITH CHECK ADD CONSTRAINT CK_notificaciones_referencias CHECK (
      (tipo IN (N''stock_bajo'',N''producto_agotado'') AND id_producto IS NOT NULL AND id_movimiento IS NULL
        AND id_pedido IS NULL AND id_usuario IS NULL AND estado_stock IS NOT NULL AND estado_stock IN (N''activa'',N''resuelta''))
      OR (tipo IN (N''entrada_inventario'',N''salida_inventario'') AND id_producto IS NOT NULL
        AND id_movimiento IS NOT NULL AND id_pedido IS NULL AND id_usuario IS NULL AND estado_stock IS NULL)
      OR (tipo IN (N''pedido_pendiente'',N''pedido_pagado'',N''pedido_cancelado'') AND id_pedido IS NOT NULL
        AND id_usuario IS NOT NULL AND id_producto IS NULL AND id_movimiento IS NULL AND estado_stock IS NULL)
    );
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.notificaciones'') AND name=N''IX_notificaciones_usuario_fecha'')
      CREATE INDEX IX_notificaciones_usuario_fecha ON dbo.notificaciones(id_usuario,fecha_creacion DESC,id_notificacion DESC)
        WHERE id_usuario IS NOT NULL;
  ';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

/* Comprobación manual posterior */
SELECT name,definition FROM sys.check_constraints
WHERE parent_object_id=OBJECT_ID(N'dbo.notificaciones')
ORDER BY name;
SELECT name,is_unique,filter_definition FROM sys.indexes
WHERE object_id=OBJECT_ID(N'dbo.notificaciones') AND name=N'IX_notificaciones_usuario_fecha';
