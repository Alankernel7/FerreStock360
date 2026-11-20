/*
  FerreStock360: conserva admin (id_rol=1), asigna cliente a Alan y retira
  empleado cuando ya no tenga usuarios ni dependencias que lo referencien.

  Identidad confirmada en la base revisada: id_usuario=3, nombre=Alan Kenneth,
  actualmente asociado a empleado (id_rol=2). El script valida esa identidad
  y el rol antes de cambiar únicamente usuarios.id_rol. No toca contraseñas,
  correos ni otras columnas de usuarios, y no elimina usuarios.

  Ejecutar manualmente. Este archivo no se ha ejecutado contra SQL Server.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN TRY
  BEGIN TRANSACTION;

  IF DB_NAME() <> N'FerreStock360'
    THROW 51101, 'Selecciona la base FerreStock360 antes de migrar los roles.', 1;

  IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
    THROW 51102, 'No existe dbo.roles; no se aplico la migracion.', 1;
  IF OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
    THROW 51103, 'No existe dbo.usuarios; no se aplico la migracion.', 1;

  DECLARE @idAdmin INT;
  DECLARE @idCliente INT;
  DECLARE @idEmpleado INT;
  DECLARE @rolAlan INT;
  DECLARE @objRoles INT = OBJECT_ID(N'dbo.roles');
  DECLARE @objUsuarios INT = OBJECT_ID(N'dbo.usuarios');

  SELECT @idAdmin = id_rol
  FROM dbo.roles WITH (UPDLOCK, HOLDLOCK)
  WHERE nombre = N'admin';

  IF @idAdmin IS NULL OR @idAdmin <> 1
    THROW 51104, 'El rol admin debe existir con id_rol=1; se cancelo la migracion.', 1;
  IF EXISTS (SELECT 1 FROM dbo.roles WHERE id_rol=1 AND nombre<>N'admin')
    THROW 51105, 'id_rol=1 pertenece a otro rol; se cancelo la migracion.', 1;
  IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE id_usuario=1 AND id_rol=@idAdmin)
    THROW 51106, 'La cuenta administradora confirmada no coincide con id_usuario=1 y admin.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.roles
    WHERE nombre NOT IN (N'admin',N'empleado',N'cliente')
  )
    THROW 51107, 'Hay roles adicionales sin revisar; no se eliminara ningun rol.', 1;

  /* La cuenta se identifica con el id y nombre leidos de SQL Server. */
  SELECT @rolAlan = id_rol
  FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK)
  WHERE id_usuario=3 AND nombre=N'Alan Kenneth';

  IF @rolAlan IS NULL
    THROW 51108, 'No se encontro a Alan Kenneth con id_usuario=3; revisa la identidad antes de migrar.', 1;

  SELECT @idEmpleado = id_rol
  FROM dbo.roles WITH (UPDLOCK, HOLDLOCK)
  WHERE nombre=N'empleado';

  IF @idEmpleado IS NOT NULL AND @idEmpleado<>2
    THROW 51121, 'El rol empleado ya no tiene id_rol=2; revisa el esquema antes de migrar.', 1;

  /* No reasignar otras cuentas employee ni roles distintos del esperado. */
  IF @idEmpleado IS NOT NULL AND EXISTS (
    SELECT 1 FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK)
    WHERE id_rol=@idEmpleado AND id_usuario<>3
  )
    THROW 51109, 'Empleado tiene otras cuentas asociadas; no se cambiara ninguna automaticamente.', 1;

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    WHERE fk.parent_object_id=@objUsuarios
      AND fk.referenced_object_id=@objRoles
      AND fk.name=N'FK_usuarios_roles'
  )
    THROW 51110, 'No se encontro FK_usuarios_roles; revisa las relaciones antes de migrar.', 1;

  /* Solo se permite la relacion conocida usuarios.id_rol -> roles.id_rol. */
  IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys fk
    WHERE fk.referenced_object_id=@objRoles
      AND NOT (
        fk.parent_object_id=@objUsuarios
        AND fk.name=N'FK_usuarios_roles'
        AND (SELECT COUNT(*) FROM sys.foreign_key_columns fkc
             WHERE fkc.constraint_object_id=fk.object_id)=1
        AND EXISTS (
          SELECT 1
          FROM sys.foreign_key_columns fkc
          INNER JOIN sys.columns pc
            ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id
          INNER JOIN sys.columns rc
            ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id
          WHERE fkc.constraint_object_id=fk.object_id
            AND pc.name=N'id_rol' AND rc.name=N'id_rol'
        )
      )
  )
    THROW 51111, 'Hay otra clave foranea hacia roles; no se eliminara empleado.', 1;

  IF EXISTS (SELECT 1 FROM sys.triggers WHERE parent_id=@objRoles AND is_disabled=0)
    THROW 51112, 'dbo.roles tiene triggers activos; revisa sus efectos antes de migrar.', 1;

  IF EXISTS (
    SELECT 1 FROM sys.sql_expression_dependencies
    WHERE referenced_id=@objRoles AND referencing_id<>@objUsuarios
  )
    THROW 51113, 'Hay objetos SQL dependientes de dbo.roles; revisalos antes de migrar.', 1;

  SELECT @idCliente = id_rol
  FROM dbo.roles WITH (UPDLOCK, HOLDLOCK)
  WHERE nombre=N'cliente';

  IF @idCliente IS NULL
  BEGIN
    INSERT INTO dbo.roles (nombre, descripcion)
    VALUES (N'cliente', N'Cliente de la tienda en linea');
    SET @idCliente = CONVERT(INT, SCOPE_IDENTITY());
  END;

  IF @idCliente=1 OR @idCliente=@idEmpleado
    THROW 51114, 'El id del rol cliente entra en conflicto con otro rol.', 1;

  IF @rolAlan=@idEmpleado
  BEGIN
    UPDATE dbo.usuarios
    SET id_rol=@idCliente
    WHERE id_usuario=3 AND nombre=N'Alan Kenneth' AND id_rol=@idEmpleado;
  END
  ELSE IF @rolAlan<>@idCliente
    THROW 51115, 'Alan tiene un rol distinto de empleado o cliente; no se cambiara su cuenta.', 1;

  IF EXISTS (SELECT 1 FROM dbo.usuarios WHERE id_rol=@idEmpleado)
    THROW 51116, 'Empleado aun tiene usuarios asociados; no se eliminara.', 1;

  IF @idEmpleado IS NOT NULL
    DELETE FROM dbo.roles WHERE id_rol=@idEmpleado AND nombre=N'empleado';

  IF EXISTS (SELECT 1 FROM dbo.roles WHERE nombre NOT IN (N'admin',N'cliente'))
    THROW 51117, 'Quedan roles distintos de admin y cliente; se revierte la transaccion.', 1;
  IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE id_rol=1 AND nombre=N'admin')
    THROW 51118, 'La migracion no conservo admin con id_rol=1.', 1;
  IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE id_usuario=1 AND id_rol=1)
    THROW 51119, 'La migracion cambio la asignacion de la cuenta administradora.', 1;
  IF NOT EXISTS (
    SELECT 1 FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id_rol=u.id_rol
    WHERE u.id_usuario=3 AND u.nombre=N'Alan Kenneth' AND r.nombre=N'cliente'
  )
    THROW 51120, 'Alan no quedo asignado al rol cliente; se revierte la transaccion.', 1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

/* Validaciones de solo lectura para ejecutar despues de la migracion. */
SELECT r.id_rol,r.nombre,COUNT(u.id_usuario) AS usuarios_asignados
FROM dbo.roles r LEFT JOIN dbo.usuarios u ON u.id_rol=r.id_rol
GROUP BY r.id_rol,r.nombre ORDER BY r.id_rol;

SELECT u.id_usuario,u.nombre,u.id_rol,r.nombre AS rol
FROM dbo.usuarios u LEFT JOIN dbo.roles r ON r.id_rol=u.id_rol
WHERE u.id_usuario IN (1,3) ORDER BY u.id_usuario;

SELECT COUNT(*) AS roles_distintos_de_admin_cliente
FROM dbo.roles WHERE nombre NOT IN (N'admin',N'cliente');

SELECT fk.name AS foreign_key_name,OBJECT_NAME(fk.parent_object_id) AS tabla_origen,
       OBJECT_NAME(fk.referenced_object_id) AS tabla_destino
FROM sys.foreign_keys fk WHERE fk.referenced_object_id=OBJECT_ID(N'dbo.roles');
