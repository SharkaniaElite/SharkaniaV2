# SHARKANIA · Creación y clonación atómicas de ligas, sin escrituras innecesarias

**7 de noviembre de 2026.** Modificaciones exclusivamente en el PR #65 DRAFT. **No es una migración productiva ni una autorización para activar `VITE_LEAGUE_GUARDED_RPC`.**

## Motivo

El análisis de `main`, el catálogo de producción y la revisión del PR #80 revelaron dos bloqueos para restringir el acceso a membresías de clubes:

- El formulario histórico crea la liga, inserta el club organizador y actualiza la lista de salas en solicitudes PostgREST separadas. Un error intermedio puede dejar un objeto incompleto.
- La clonación histórica copia membresías secundarias con un INSERT de múltiples filas sin comprobar el error. Una futura política de ligas que impida inscribir clubes secundarios por cuenta propia puede producir una clonación parcial o silenciosamente incompleta.

**No resolver simplemente revocando DML en producción**, porque rompería estos flujos.

## Código QA existente aprovechado, no duplicado

`docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql` ya contenía:

- `save_league_guarded(uuid,uuid,text,text,jsonb,uuid[])`: creación o edición de metadatos, organizador y salas en una sola transacción por invocación RPC. Verifica propietario y campos permitidos.
- `duplicate_league_guarded(uuid,text,text)`: clona metadatos y salas de una liga existente con nuevo ID y slug; asocia **solo el club organizador principal**, sin dar afiliación automática a participantes secundarios. No copia torneos, resultados, clasificaciones ni pagos.
- `set_league_rooms_guarded(uuid,uuid[])`: reemplaza selección de salas dentro de una transacción.
- `create_league_guarded`, `add_league_club_guarded`, `delete_empty_league_guarded`: operaciones de responsabilidad individual con permisos verificables.

Todas las RPC están protegidas por permisos explícitos en la propuesta y **sin activar el flag en el frontend productivo**.

## Ajustes nuevos de integridad y recursos

1. **UPDATE de metadatos condicional:** `save_league_guarded` ahora compara todos los campos persistidos mediante `IS DISTINCT FROM` antes de actualizar. Una edición idéntica no crea una nueva tupla del registro, evita disparar el `updated_at` asociado a escrituras y reduce mantenimiento.
2. **Diferencia de conjuntos para salas:** `save_league_guarded` y `set_league_rooms_guarded` eliminan únicamente salas que desaparecieron de la selección e insertan solo las faltantes. Las relaciones que permanecen conservan su UUID y no se eliminan/reinsertan.
3. **Sin prelectura de slugs por red:** en modo protegido, el frontend realiza **una RPC normal** al crear o clonar; reintenta hasta 30 alternativas solo si la base informa una colisión de slug concreta (`PT409`/constraint UNIQUE), no para errores de permiso u otros conflictos. Así se eliminan hasta 30 `SELECT` HTTP preventivos antes de un alta normal. El índice único de `leagues.slug` y el bloqueo transaccional del servidor siguen siendo la autoridad.
4. **Paridad con ligas de demostración:** la clonación protegida conserva `is_demo` de la liga de origen. La fecha de creación/actualización, IDs y estadísticas históricas no se copian; permanece la configuración deportiva y el estado `upcoming`, como en el clon original.
5. **Advertencia explícita:** antes de clonar en modo protegido, la interfaz comunica que participantes secundarios e históricos NO se copiarán y exige confirmación. No hay advertencia nueva ni cambio en el flujo legado cuando el flag está apagado.

Estas mejoras eliminan escrituras **de datos** que no aportan cambios, pero **no suprimen el coste de leer y bloquear** la fila de la liga durante la transacción. No afirmar que una RPC sin cambios genere cero WAL general, porque PostgreSQL podría registrar bloqueos de filas.

## Pruebas incluidas en la suite PostgreSQL 17 efímera

- `tests/fixtures/sharkania-league-membership-qa-assert.sql`: creación atómica y edición con todos los campos admitidos, propietario y salas autorizadas, rechazo de permisos indebidos, slug duplicado, valores o salas inválidos.
- Nueva doble invocación **idéntica** de `save_league_guarded`: verifica que `ctid` de la liga y UUIDs de las relaciones permanezcan estables.
- Nueva prueba de diferencia de conjuntos: agregar y quitar una sala preserva el UUID de la sala común.
- Nueva prueba de **fallo tardío forzado** en la inserción de salas durante la clonación, tras haberse insertado la liga y club primario: al devolver error, no debe quedar liga incompleta.
- La clonación de una liga `is_demo=true` debe mantener `is_demo=true`.
- `tests/league-membership-guarded-contract.test.mjs` obliga a no reintroducir los `SELECT` preventivos en la rama protegida, preservar los filtros de escritura y mostrar el aviso de clonación.
- La batería GoTrue/PostgREST real en localhost, TypeScript y otras validaciones del PR siguen siendo condiciones de CI.

## Condiciones pendientes para producción

- PR #79 (corrección de standings ya aplicada) y PR #80 (RLS de membresía y salas todavía en QA) **no se deben mezclar automáticamente** con PR #65. Las ramas divergen y se requiere reconciliar contra `main`.
- Para impedir por completo nuevos registros huérfanos, deben revocarse DML directos de membresía y creación cuando las RPC atómicas y sus clientes estén listos **en la misma puesta en marcha**.
- Comprobar la paridad en un entorno Supabase con PostgreSQL Auth/PostgREST, incluida la clonación de ligas compartidas, permisos del organizador, superadmin y restricciones de secundarios, bajo fallas y colisiones.
- Probar la interfaz administrativa real (sin datos de jugadores de producción) y preservar las reglas de estado/fechas.
- No activar `VITE_LEAGUE_GUARDED_RPC`, no ejecutar este SQL sobre Supabase real ni fusionar PR #65 antes de una aprobación expresa de despliegue, backup verificado y rollback que no reabra políticas inseguras.

**Conclusión:** solución de integridad preparada en QA y con menor volumen de DML, sin impacto productivo.
