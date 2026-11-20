# Configuración de retiros

El proyecto no tenía horario de atención configurado. El selector de checkout usa una configuración sencilla: retiros de lunes a sábado en la zona `America/El_Salvador`; no se inventa una hora de atención.

El administrador técnico puede modificar la configuración en `backend/.env` y reiniciar el backend:

```env
ZONA_RETIRO=America/El_Salvador
DIAS_RETIRO=1,2,3,4,5,6
```

`DIAS_RETIRO` usa los números de JavaScript para los días de semana: domingo `0`, lunes `1` … sábado `6`. Por ejemplo, `1,2,3,4,5` permite retiros de lunes a viernes. El checkout consulta el calendario al backend y el backend vuelve a validar la fecha al confirmar el pedido. El calendario muestra los siguientes 90 días permitidos.

Antes de iniciar el nuevo checkout, ejecutar manualmente `backend/database/pedidos_reservas_retiros.sql` en la base correcta. Este agente no ejecutó el script en SQL Server.
