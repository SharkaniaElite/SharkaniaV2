# SHARKANIA — Protección P1 de miembros, propietario y salas de ligas (QA)

**7 de noviembre de 2026.** Propuesta complementaria a PR #79 (RLS de clasificaciones aplicada en Supabase productivo) y al PR #65 (rediseño de operaciones de ligas y resultados). **NO desplegada; requiere aprobación independiente.**

## Diagnóstico comprobado por SELECT sobre producción

Las reglas actuales de `public.league_clubs` permiten a un administrador de cualquier club:
- Insertar una membresía de su club en una liga existente aunque no administre el organizador principal.
- Actualizar su propia membresía, incluso `is_primary` o la liga asociada.
- Eliminar su relación, incluso si era la única principal (el índice de PR #79 solo evita **más de un** principal, no **cero**).

La regla actual de `public.leagues` permite UPDATE/DELETE a un administrador de **cualquier club vinculado**, no únicamente al organizador principal; también permite INSERT a cualquier usuario con `auth.uid()` no nulo. Por ello, la autoinscripción secundaria es una vía para intentar modificar ligas de terceros.

La RLS de `public.league_rooms` permite INSERT/DELETE a cualquier cuenta autenticada con `auth.uid()` no nulo, independientemente de la liga. Esto posibilita intentos de alterar la lista de salas de ligas ajenas.

Estado de datos durante la auditoría: **34 ligas, 41 relaciones liga–club y 34 asociaciones de salas**, sin ligas faltantes de principal. No se hizo ninguna escritura productiva.

## Propuesta temporal y económica, QA-only

`docs/security/league-membership-ownership-p1-2026-11-07.qa-only.sql` sustituye las **8 políticas de escritura permisivas** (3 `league_clubs`, 3 `leagues`, 2 `league_rooms`) por **8 políticas con autorización específica**.

- `league_clubs`: superadministrador puede gestionar membresías. Un administrador normal solo puede **insertar su propio club como principal**, para mantener el paso actual de creación de ligas. No puede autoincluirse como secundario, borrar/editar su membresía, promoverse o desmarcar al único principal.
- `leagues`: solo superadministradores o administradores de un club reconocido pueden crear. Solo superadministradores o el administrador principal real pueden editar/eliminar una liga.
- `league_rooms`: solo superadministrador o administrador principal de la liga puede insertar/eliminar las salas asociadas, como hace el formulario actual.
- Mantiene SELECT público de ligas, relaciones y salas; las operaciones existentes sobre rankings permanecen intactas.
- **No crea índices ni funciones nuevas** y reutiliza el índice parcial `league_clubs_one_primary_per_league_guarded` ya instalado en la corrección P0. Predicados de autorización se basan en conjuntos pequeños de `league_clubs`, evitando consultar membresías por cada fila de la clasificación.
- Hace preflight que **falla cerrado** si faltan la RLS o el índice P0, cambian las ocho políticas esperadas o aparece una política de escritura desconocida.

## Compatibilidad y límites que impiden aplicar aún a producción

1. El formulario actual `src/components/admin/league-form.tsx` hace **tres solicitudes HTTP separadas**: inserta la liga, crea su asociación primaria, y luego registra las salas. Las reglas P1 preservan estas operaciones individuales para el administrador autorizado, **pero un error entre pasos todavía deja una liga sin terminar**. PR #65 propone un RPC atómico para resolverlo.
2. `duplicateLeague()` en `src/lib/api/leagues.ts` copia todas las membresías de una liga mediante una inserción agrupada **sin comprobar el error del INSERT**. Si se clona una liga de varios clubes con la nueva RLS, no se autoriza incluir clubes secundarios arbitrariamente: la clonación puede dejar una liga sin vínculos o incompleta. **Bloqueo de producción explícito:** integrar antes el RPC `duplicate_league_guarded` propuesto en PR #65 o corregir la UI/copia de forma atómica y verificable; no publicar P1 por sí sola.
3. La creación de una liga nueva por un administrador de club aún puede dejar un intervalo sin propietario. La RLS no prueba que el propietario de la liga recién creada sea quien añade la primera membresía. La solución completa necesita **una sola transacción backend** con autoría verificada, como en PR #65.
4. El superadministrador aún puede dejar la liga sin principal mediante reparación manual. Para mantener siempre exactamente uno hace falta una operación de transferencia supervisada, no imponer un trigger por fila que añada costos a todos los INSERT.
5. La política de `league_rooms` no sustituye el borrado/reinserción actual del formulario: el futuro RPC debe aplicar una **diferencia de conjuntos** para evitar escrituras/WAL si las salas no cambiaron.
6. La propuesta no bloquea todas las rutas de `tournaments`, ELO, históricos ni las RPC `SECURITY DEFINER` heredadas: siguen pendientes en PR #65.

## Validaciones QA

- `tests/fixtures/sharkania-p1-league-membership-rls-qa.sql`, incorporado en la transacción de prueba de RLS del PR #79. Reproduce previamente la autoinscripción y la edición ajena bajo las políticas antiguas; valida después jugador, secundario, principal, superadmin, creación normal, actualización de salas y SELECT público; **ROLLBACK total**.
- `tests/league-membership-ownership-p1-contract.test.mjs` obliga a mantener los ocho reemplazos, el preflight, la unicidad compartida y el contrato del formulario actual.
- `tests/fixtures/sharkania-p1-league-real-auth-setup.sql` extiende los datos ficticios locales y `tests/fixtures/sharkania-p0-rls-real-auth-qa.mjs` comprueba la nueva restricción por HTTP con cuentas GoTrue genuinas, sin credenciales de Sharkania real.
- **No ejecutar ninguna prueba de escritura sobre producción.** Estas pruebas no validan aún la clonación real de múltiples clubes y el flujo de transferencias.

## Criterio de salida

**NO GO producción** hasta corregir la clonación de ligas compartidas y la creación multietapa mediante RPC seguro, verificar las pantallas actuales, cerrar rutas directas de escritura en coordinación con PR #65, aprobar específicamente el cambio, comprobar respaldo y volver a hacer preflight de RLS/indices. Tampoco fusionar P1 antes de sincronizar la migración aplicada de PR #79 con `main`.

**Impacto productivo de esta etapa: cero.** Proyecto Supabase y web permanecen inalterados.
