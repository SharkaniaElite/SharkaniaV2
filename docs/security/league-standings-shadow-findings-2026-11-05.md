# SHARKANIA — clasificaciones: comparación sombra de solo lectura (5 noviembre 2026)

**Estado: diagnóstico verificado; NO GO para migración ni recálculo productivo.** Relacionado con PR #65, Release A de seguridad de ligas. No incluye ELO Release B, Stats Espía ni operaciones de escritura.

## Entregable reproducible

`docs/security/league-standings-shadow-2026-11-05.readonly.sql` calcula una clasificación *candidata* para cada liga a partir de `tournament_results` y `tournaments` sin modificar ninguna fila. Devuelve **únicamente métricas agregadas por slug de liga** (sin identificadores ni información personal de jugadores). Se ejecutó el 5/11 mediante una consulta `WITH ... SELECT` contra Supabase productivo, sin DML ni DDL.

Se mantiene la regla de puntuación actual: sumatoria de las mejores `best_dates_to_count` fechas (o todas si es NULL), participaciones totales, mejor puesto absoluto y mesas finales (posiciones 1–9). Para la simulación se añaden desempates estables `start_datetime`, `tournament_id`, `result_id` y `player_id`, **sin pretender que ese nuevo orden ya esté aprobado para posiciones oficiales**.

## Hallazgos verificados en esa lectura

- Resultados de liga de origen: **20.646** en **33 ligas**. No se encontraron `buy_ins_count` nulos o no positivos, posiciones no positivas, `start_datetime` faltantes ni puntos negativos en esta muestra.
- **31/33 ligas:** ninguna diferencia entre puntos actuales y puntos calculados para jugadores con fuente. Las dos excepciones son `mega-liga-luxowin-septiembre` (**37** posiciones con diferencias) y `circuito-chileno-de-poker-agosto-2026` (**69**).
- **51 posiciones históricas sin resultado asociado a la misma liga:** Luxowin septiembre (**27**, todas con 1 participación registrada, tres con puntos positivos); Circuito Chileno agosto (**24**, todas con puntos positivos y CCP, pero 0 participaciones registradas). No se concluye que estén equivocadas o que puedan borrarse.
- Las diferencias en `rank_position` se calculan contra un desempate *nuevo y estable*, por lo que **no equivalen necesariamente a errores**: puede haber empates históricos o un orden anterior válido.
- `all_reentries` suma todos los `buy_ins_count` de resultados por jugador, incluidos resultados sin CCP. El parche heredado cuenta solo resultados con CCP y por eso genera numerosas diferencias. **`total_buy_ins_spent` no debe interpretarse automáticamente como monto de dinero**.
- No aparecen posiciones nuevas calculadas sin fila actual en esta comparación (las filas históricas sin fuente se cuentan por separado).
- El primer CCP disponible por orden cronológico es solo una sugerencia; el **club bloqueado vigente debe conservarse** hasta definir la regla de negocio y el procedimiento de conciliación.

## Contrato de seguridad antes del nuevo recálculo

1. **Autorizar en servidor** con `auth.uid()` y la membresía `is_primary=true`: únicamente admin del club organizador principal o superadmin. Rechazar anónimo, jugador y admin participante. Nunca confiar en un `club_id` enviado por el navegador.
2. **Bloquear por liga** durante el cálculo; insertar/actualizar por `(league_id,player_id)` sin borrar registros existentes ni cambiar `league_standings.id` de los sobrevivientes. Resolver previamente cómo preservar las 51 filas sin origen y qué hacer ante nuevos resultados, eliminados o movimientos entre ligas.
3. **No alterar silenciosamente CCP ni reentradas.** Aprobar semántica de club inicial bloqueado, vacíos/espacios y compra inicial + reentradas con/sin CCP; probarlo con ejemplos sintéticos y las excepciones históricas.
4. **Cierre coordinado:** migración versionada con revocación de DML directo sobre `league_standings`, políticas permisivas heredadas y `EXECUTE` de `recalculate_league_standings`. Nuevo RPC con `SECURITY DEFINER SET search_path=''` solo si la necesidad de privilegio está justificada, `REVOKE EXECUTE FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`, y validación de propiedad dentro de la función. Verificar definiciones, propietarios, dependencias y rutas heredadas.
5. **No habilitar subida/edición de torneos** simplemente por tener un RPC seguro de posiciones. Los flujos actuales involucran otros pasos de resultados y ELO fuera de la transacción. Mantener sus bloqueos bajo `VITE_LEAGUE_GUARDED_RPC` hasta orquestar el corte completo.
6. **QA aislado**: PostgreSQL 17 + Supabase Auth/REST real, fixtures de ligas sin fuente, empates, mejores N, 0/1 reentradas, diferencia CCP, permisos A/B/superadmin y rollback ante errores. Confirmar backup restaurable y paridad real de roles/ACL antes de cualquier despliegue.

## Acciones no realizadas

- **No** se aplicó SQL de escritura, migración, RLS, GRANT/REVOKE ni scripts sobre datos productivos.
- **No** se fusionaron PR ni se activaron flags.
- Esta consulta sombra **no es el código definitivo de reemplazo**, y las diferencias solo indican casos para investigar, no correcciones automáticas.

Siguiente condición para avanzar a una RPC real: acordar reglas de conservación histórica y reentradas, completar auditoría de las rutas heredadas, generar el plan de migración y rollback, probarlo en preproducción equivalente y solicitar aprobación explícita del propietario.
