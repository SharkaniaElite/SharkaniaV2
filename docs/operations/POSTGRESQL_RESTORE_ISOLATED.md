# Ensayo aislado de restauración PostgreSQL 17

Este procedimiento automatiza la recuperación lógica previa al corte del [issue #98](https://github.com/SharkaniaElite/SharkaniaV2/issues/98). El ensayo sintético cubre el camino desde un archivo cifrado hasta una base consultable, con una instancia de origen y otra de destino independientes. Las suites históricas de ELO conservan su evidencia.

## Ejecución reproducible

En un equipo Linux con Bash, GnuPG, Python 3 para las aserciones de QA y Docker local, desde la raíz del repositorio:

```bash
docker pull "$(bash scripts/recovery/pg17-restore.sh image)"
bash tests/pg17-isolated-restore.sh
```

Ese comando prueba el camino de control con `postgres:17.11-bookworm`. La prueba con Supabase y la precarga para el equipo privado se describen más abajo. Los contenedores arrancan con `--pull=never`. La prueba y CI utilizan exclusivamente las fixtures del repositorio.

El origen usa `pg_dump --format=custom --schema=public` y cifra el flujo con GPG. El destino coteja SHA-256, requiere que GPG termine correctamente antes de inspeccionar el archivo y restaura pre-data, data y post-data en transacciones independientes. Un fallo termina el ensayo y elimina el destino descartable. La preparación de dependencias externas a `public` se ejecuta antes de pre-data. El runner separa del catálogo la creación de `public` y recompone su permiso base de PostgreSQL 17 antes de aplicar las ACL del archivo. Las referencias mínimas de Auth se derivan entre data y post-data, antes de instalar las claves foráneas. El perfil coteja propietarios y privilegios.

Las aserciones comprueban lecturas y sumas, texto UTF-8, secuencia de identidad, PK, FK, unicidad, CHECK, índice secundario, roles NOLOGIN, propietarios, ACL, privilegios por defecto, RLS y una función que depende de `pgcrypto`. La identidad de Auth es simulada con una sola columna y una función de fixture. El caso de clave incorrecta exige código 1 y comprueba que ninguna fase SQL se ejecute. El preflight rechaza el uso del modo privado en CI.

El runner omite el entrypoint de ambas imágenes, crea su propio clúster con los binarios de PostgreSQL 17.11 y comprueba loopback como única interfaz, ausencia de rutas IPv4, red Docker `none`, cero puertos publicados y socket local con TCP apagado. Inicia PostgreSQL sin bibliotecas precargadas y con workers de fondo y replicación lógica desactivados. `pg_cron` y `pg_net` deben quedar sin instalar dentro del clúster aunque la imagen incluya sus paquetes. El contenedor se ejecuta como usuario sin privilegios ni capacidades, con raíz de solo lectura y un único montaje de datos en tmpfs. El cifrado de prueba, el directorio de GPG, los logs SQL y el archivo descifrado viven en memoria. Se verifica la ausencia de swap y de los contenedores y directorios temporales al terminar. El contenedor se autodestruye si se agota su límite de 30 minutos. Si el proceso anfitrión muere sin ejecutar su manejador de salida, el apagado completo del medio Live elimina su tmpfs. El único artefacto que permanece en Docker es la imagen base pública precargada.

Trate el resultado como **PASS** cuando el comando de pruebas devuelve 0 y imprime `PASS recovery acceptance tests`. Una etapa rechazada imprime `FAIL <etapa>`, un código distinto de cero y el estado de limpieza. Mantenga **UNKNOWN** para los controles que solo pueden verificarse en la máquina final o con una copia autorizada. En el modo privado la salida contiene nombres de etapas, código y duración. Las filas, el catálogo del archivo, las claves y los diagnósticos SQL detallados permanecen fuera de la salida.

## Preparación de la imagen Supabase

`postgres:17.11-bookworm` aporta la versión del motor y herramientas estándar. `public.ecr.aws/supabase/postgres:17.11.0.011` empaqueta extensiones de Supabase y usa rutas de binarios, scripts de inicialización y una configuración de arranque propias. La prueba de compatibilidad usa el artefacto público de Supabase en Docker Hub, fijado por digest de registro en CI. La identidad de la exportación privada de ECR se verifica por separado. [Dockerfile de la versión Supabase](https://github.com/supabase/postgres/blob/17.11.0.011/Dockerfile-17)

Prepare los recursos públicos antes de desconectar Internet. En el equipo privado use un Docker rootless cuyo directorio de datos esté en tmpfs y cuyo socket Unix sea local. Calcule el espacio con la imagen descomprimida, el sistema Live, los temporales del daemon, el archivo y la base con su WAL. Para el tar público ya exportado, coteje su SHA-256 con el registro independiente de la exportación y el ID `sha256:…` de la imagen para la arquitectura elegida. El ID se obtiene con `docker image inspect --format '{{.Id}}' REFERENCIA` al registrar el artefacto oficial. El digest del manifiesto de registro identifica la publicación y el ID identifica la configuración de la imagen cargada. Un tar de `docker save` se valida también cuando Docker pierde la referencia al digest de registro al importarlo.

```bash
bash scripts/recovery/pg17-restore.sh load-supabase "$TAR_IMAGEN_PUBLICA" "$SHA256_TAR" "$ID_IMAGEN_SUPABASE"
bash tests/pg17-isolated-restore.sh --supabase-image-id "$ID_IMAGEN_SUPABASE"
bash scripts/recovery/pg17-restore.sh --supabase-image-id "$ID_IMAGEN_SUPABASE" preflight
```

`load-supabase` comprueba el hash antes de importar el tar y coteja el ID de lo que Docker cargó. El runner usa ese ID local con `--pull=never`. Si la imagen comparte el Ventoy con el respaldo, puede cargar el **tar público** una vez aislado y desde el volumen de solo lectura. El equipo debe tener las herramientas preparadas previamente y la importación funciona sin acceso al registro.

## Construcción y revisión del perfil privado

En una sesión PostgreSQL 17 de solo lectura previamente autorizada y en el equipo del operador, capture el inventario mediante el siguiente comando. Use un servicio libpq ya configurado por el operador para el catálogo autorizado, o una copia local autorizada del catálogo. Mantenga la salida en un destino privado protegido.

```bash
umask 077
psql -XqAt --no-password --set=ON_ERROR_STOP=1 --dbname="service=$SERVICIO_SOLO_LECTURA" \
  --file=scripts/recovery/catalog.sql > "$DIRECTORIO_PRIVADO/catalogo.json"
```

La consulta usa una transacción `REPEATABLE READ READ ONLY` y solo lee catálogos. Enumera tablas, vistas, columnas, tipos, índices, rutinas, restricciones, RLS, triggers, propietarios, roles, ACL, ACL por defecto, extensiones y dependencias registradas fuera de `public`. Las FK hacia Auth llevan el mapeo ordenado de columnas. Las definiciones de rutinas, vistas y expresiones se identifican por huellas. Los recuentos de referencia son 64 tablas, 2 vistas, 140 índices, 201 rutinas, 184 restricciones, 7 FK hacia Auth y 9 extensiones. Úselos para detectar una diferencia de captura o alcance. La aceptación requiere cotejar los objetos, las versiones y las dependencias identificadas.

| Archivo privado | Contenido y aceptación |
|---|---|
| `extensions.tsv` | Pares `nombre<TAB>versión` requeridos para el ensayo, derivados de `extensions` y de las dependencias revisadas. El preflight coteja las versiones disponibles en la imagen antes de descifrar. Documente por separado las extensiones excluidas de ejecución, en especial cron, net y servicios que utilicen secretos. |
| `pre-data.sql` | Roles locales mínimos `NOLOGIN`, propietarios, versiones de extensiones aprobadas, tipos y esquemas auxiliares. Revise configuraciones de funciones, FDW, suscripciones y triggers. Mantenga cron y net sin instalar. Una dependencia obligatoria de servicios externos detiene el ensayo. |
| `after-data.sql` | Referencias mínimas de FK derivadas de las columnas restauradas, con sus tipos y orden del catálogo. Use identidades simuladas y excluya cuentas, sesiones o credenciales reales. |
| `verify.sql` | Aserciones de inventario por identidad, firmas, propietarios, ACL, restricciones validadas, RLS y comprobaciones agregadas acordadas. Compare versión, encoding, locale, proveedor y collation. Documente cada diferencia aceptada, incluida la simulación de roles y Auth. |

El operador debe revisar localmente referencias dinámicas y cuerpos de funciones cuando el catálogo estructural sea insuficiente. El archivo privado y las definiciones revisadas permanecen fuera de GitHub, Codex y CI. Confirme que el inventario corresponde al punto del archivo o documente cada diferencia de fecha. Registre SHA-256 de los cuatro archivos del perfil una vez aprobados y coteje ese registro inmediatamente antes del ensayo privado. La ejecución de QA prueba la consulta y su mapeo de FK contra datos sintéticos. El clúster actual usa UTF-8 y locale `C`. Si el catálogo exige otra configuración de collation o locale, valide una adaptación del clúster antes de autorizar la importación.

## Entorno concreto para un ensayo privado

Use un equipo propio arrancado en frío con Ubuntu Live o Debian Live sin persistencia. Desconecte físicamente la red, apague Wi-Fi y deje desmontados los discos internos. Arranque con `nohibernate`, sin swap y sin colector de volcados. Verifique que la capa de escritura del Live y el almacenamiento de Docker estén en tmpfs. El socket rootless puede estar en `/run/user/UID/docker.sock`.

**Ventoy único.** Dos medios separan físicamente arranque y custodia y siguen siendo la opción directa cuando ya hay un USB libre para el ISO y las herramientas públicas. Un solo Ventoy es candidato si se demuestra un arranque sin persistencia, sin automontaje con escritura del volumen de datos y con la partición de datos protegida a nivel de dispositivo de bloque antes de acceder a archivos. Compruebe el dispositivo correcto con `lsblk -o NAME,TYPE,RO,FSTYPE,MOUNTPOINTS` y todos sus montajes con `findmnt`. El runner exige `RO=1` en el dispositivo del archivo y un montaje `ro`, además de rechazar montajes de bloque con escritura. Un ISO en modo `toram`/Memdisk puede desacoplar el acceso al ISO si la combinación específica lo soporta. Pruebe ese arranque y sus garantías con material desechable antes de abrir el respaldo. Si el Live autoaccede con escritura al volumen, aborte ese camino. [Casper de Ubuntu](https://manpages.ubuntu.com/manpages/noble/man7/casper.7.html) · [Memdisk de Ventoy](https://www.ventoy.net/en/doc_memdisk.html) · [Persistencia en Ventoy](https://www.ventoy.net/en/plugin_persistence.html)

**Sin reiniciar el equipo principal.** Un segundo equipo propio ya disponible permite ejecutar el arranque frío sin reiniciar el principal y sin coste de servicio. Una VM local sin NIC, discos de escritura, carpetas compartidas, portapapeles ni estados guardados es solo candidata. El anfitrión debe demostrar que la memoria del invitado queda fuera de swap, hibernación y volcados, que no se crean snapshots o checkpoints y que el pendrive permanece protegido en solo lectura desde su primer acceso, también en el anfitrión. Un invitado Live no demuestra esos controles del anfitrión. Con la configuración reportada de Windows y Ventoy, esa vía queda NO GO hasta un ensayo verificable. [Checkpoints de Hyper-V](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/choose-between-standard-or-production-checkpoints-in-hyper-v) · [Volcados de Windows](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/configure-system-failure-and-recovery-options)

Ejecute el preflight y el ensayo sintético en el equipo elegido con el ID precargado. El preflight exige arranque Live, almacenamiento volátil, Docker rootless, loopback como única interfaz activa y un clúster local aislado. Para probar además el manifiesto de extensiones antes de procesar datos, pase el directorio de perfil como último parámetro de `preflight`.

## Requisitos pendientes para la copia del 22 de noviembre

1. Validar el preflight y el ensayo sintético **en el equipo privado elegido**. Comprobar también que los discos internos sigan desmontados, que el medio de arranque carezca de persistencia y que haya RAM suficiente para archivo, base, WAL y Docker.
2. Acordar quién ejecuta el ensayo, qué datos puede procesar, custodia del medio y el apagado final. Mantener el archivo cifrado en un dispositivo de bloque y montaje de solo lectura. Conservar los SHA-256 de referencia por un canal local independiente.
3. Verificar la exportación pública por SHA-256 e ID y revisar el perfil del catálogo según los pasos anteriores. Confirmar que las nueve extensiones están identificadas y que cada una tiene una decisión de versión, instalación aislada, simulación o exclusión.
4. Una vez satisfechos esos requisitos, el operador puede ejecutar `bash scripts/recovery/pg17-restore.sh --supabase-image-id "$ID_IMAGEN_SUPABASE" offline ARCHIVO SHA256 PERFIL_REVISADO` en su terminal aislada. El runner comprueba el medio, la imagen y las extensiones requeridas antes de pedir la frase GPG sin eco. Acepta un archivo GPG simétrico con volcado custom de `public`. Una incompatibilidad bloquea el ensayo con FAIL. Registre únicamente etapa, duración, código de salida, paridad agregada y limpieza. Apague el sistema Live al terminar.
5. Evaluar por separado la cobertura de cuentas y sesiones de Auth, objetos físicos de Storage y Vault. Cerrar la condición de recuperación del lanzamiento con un punto cercano a la congelación de escrituras y un RPO/RTO medido. La copia del 22 de noviembre y el perfil real quedan **UNKNOWN** hasta ejecutar y verificar ese ensayo. La restauración de QA no activa la migración ELO v2.

[Restauración lógica en Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) · [Archivo y secciones de PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgrestore.html)
