# Ensayo aislado de restauración PostgreSQL 17

Este procedimiento automatiza la recuperación lógica previa al corte del [issue #98](https://github.com/SharkaniaElite/SharkaniaV2/issues/98). El ensayo sintético cubre el camino desde un archivo cifrado hasta una base consultable, con una instancia de origen y otra de destino independientes. Las suites históricas de ELO conservan su evidencia.

## Ejecución reproducible

En un equipo Linux con Bash, GnuPG y Docker local, desde la raíz del repositorio:

```bash
docker pull "$(bash scripts/recovery/pg17-restore.sh image)"
bash tests/pg17-isolated-restore.sh
```

La descarga de la imagen es un paso de preparación. La imagen fijada por digest contiene PostgreSQL 17.11. Los contenedores arrancan con `--pull=never`. La prueba y CI utilizan exclusivamente las fixtures del repositorio.

El origen usa `pg_dump --format=custom --schema=public` y cifra el flujo con GPG. El destino coteja SHA-256, requiere que GPG termine correctamente antes de inspeccionar el archivo y restaura pre-data, data y post-data en transacciones independientes. Un fallo termina el ensayo y elimina el destino descartable. La preparación de dependencias externas a `public` se ejecuta antes de pre-data. El runner separa del catálogo la creación de `public` y recompone su permiso base de PostgreSQL 17 antes de aplicar las ACL del archivo. Las referencias mínimas de Auth se derivan entre data y post-data, antes de instalar las claves foráneas. El perfil coteja propietarios y privilegios.

Las aserciones comprueban lecturas y sumas, texto UTF-8, secuencia de identidad, PK, FK, unicidad, CHECK, índice secundario, roles NOLOGIN, propietarios, ACL, privilegios por defecto, RLS y una función que depende de `pgcrypto`. La identidad de Auth es simulada con una sola columna y una función de fixture. El caso de clave incorrecta exige código 1 y comprueba que ninguna fase SQL se ejecute. El preflight rechaza el uso del modo privado en CI.

El runner comprueba loopback como única interfaz, ausencia de rutas IPv4, red Docker `none`, cero puertos publicados, socket local de PostgreSQL, TCP apagado y ausencia de `pg_cron` y `pg_net` activos en el clúster. El contenedor se ejecuta como usuario sin privilegios ni capacidades, con raíz de solo lectura y un único montaje de datos en tmpfs. El cifrado de prueba, el directorio de GPG, los logs SQL y el archivo descifrado viven en memoria. Se verifica la ausencia de swap y de los contenedores y directorios temporales al terminar. El contenedor se autodestruye si se agota su límite de 30 minutos. Si el proceso anfitrión se mata sin ejecutar su manejador de salida, el apagado completo del medio Live elimina su tmpfs. El único artefacto que permanece en Docker es la imagen base genérica precargada.

Trate el resultado como **PASS** cuando el comando de pruebas devuelve 0 y imprime `PASS recovery acceptance tests`. Una etapa rechazada imprime `FAIL <etapa>`, un código distinto de cero y el estado de limpieza. Mantenga **UNKNOWN** para los controles que solo pueden verificarse en la máquina final o con una copia autorizada. En el modo privado la salida contiene nombres de etapas, código y duración. Las filas, el catálogo del archivo, las claves y los diagnósticos SQL detallados permanecen fuera de la salida.

## Entorno concreto para un ensayo privado

Use un equipo propio arrancado desde otro medio disponible con Ubuntu Live o Debian Live sin persistencia. Prepare Docker rootless, GnuPG, el código revisado y la imagen fijada en ese arranque, antes de conectar el pendrive de respaldo. El almacenamiento del daemon Docker debe ser un tmpfs y el socket local puede estar en `/run/user/UID/docker.sock`. Desconecte físicamente la red, apague Wi-Fi y deje desmontados los discos internos. Arranque con `nohibernate`, sin swap y sin un colector de volcados de memoria. Verifique que la raíz tenga su capa de escritura en un tmpfs. Este procedimiento utiliza el equipo y medios existentes, sin aprovisionar servicios.

Con el pendrive de respaldo todavía separado, ejecute `bash scripts/recovery/pg17-restore.sh preflight` desde una terminal local y después el ensayo sintético. El preflight exige un arranque Live, almacenamiento volátil, rootless Docker, ausencia de interfaces activas aparte de loopback y un clúster local que satisfaga las comprobaciones. Codex Cloud permite la prueba sintética. Las garantías de custodia física, memoria del anfitrión, snapshots y destrucción exigidas para datos reales deben comprobarse en el equipo propio.

## Requisitos pendientes para la copia del 22 de noviembre

1. Validar el preflight y el ensayo sintético **en el equipo privado elegido**. Comprobar también que los discos internos sigan desmontados, que el medio de arranque carezca de persistencia y que haya RAM suficiente para archivo, base, WAL y Docker.
2. Acordar quién ejecuta el ensayo, qué datos puede procesar, custodia del medio y el apagado final. Mantener el pendrive cifrado y montarlo de solo lectura en el mismo equipo aislado. Conservar el SHA-256 de referencia por un canal local independiente.
3. Revisar un perfil específico para el archivo, conservado fuera de Git y CI si contiene metadatos sensibles. `pre-data.sql` debe crear los roles NOLOGIN, propietarios, esquemas y extensiones requeridos. `after-data.sql` debe materializar solo las referencias mínimas necesarias para las FK hacia esquemas excluidos. `verify.sql` debe afirmar los recuentos, firmas, restricciones, índices, propietarios, ACL, ACL por defecto y dependencias esperadas, con salida agregada. Revisar compatibilidad de collations, módulos y funciones de Supabase. El perfil sintético sirve de ejemplo. Si una dependencia requiere iniciar cron, red o un servicio externo, conservar el bloqueo.
4. Una vez satisfechos esos requisitos, el operador puede ejecutar `bash scripts/recovery/pg17-restore.sh offline ARCHIVO SHA256 PERFIL_REVISADO` en su terminal aislada. El runner exige el medio de solo lectura, comprueba el hash antes de pedir la frase GPG sin eco, y acepta un archivo GPG simétrico con volcado custom de `public`. Una incompatibilidad se registra como FAIL y se corrige con el perfil o la imagen revisada, sin relajar los controles. Registrar únicamente etapa, duración, código de salida, paridad agregada y limpieza. Apagar el sistema Live al terminar.
5. Evaluar por separado la cobertura de cuentas y sesiones de Auth, objetos físicos de Storage y Vault. Cerrar la condición de recuperación del lanzamiento con un punto cercano a la congelación de escrituras y un RPO/RTO medido. La copia del 22 de noviembre y el perfil real quedan **UNKNOWN** hasta ejecutar y verificar ese ensayo. La restauración de QA no activa la migración ELO v2.

[Restauración lógica en Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) · [Archivo y secciones de PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgrestore.html)
