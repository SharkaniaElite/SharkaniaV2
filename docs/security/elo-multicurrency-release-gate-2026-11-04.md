# SHARKANIA — barrera de compatibilidad ELO multimoneda y orden de despliegue (4 nov 2026)

> **NO-GO para el corte global ELO.** Evidencia obtenida mediante consultas **SELECT agregadas** a la base productiva; no hubo escrituras. Todos los cambios de código siguen en el PR #64 **draft**, con los flags nuevos apagados. Estas cifras son un snapshot, no una garantía futura: volver a ejecutar `docs/security/elo-currency-readonly-preflight-2026-11-04.sql` antes de solicitar un despliegue.

## Evidencia de la base real

| Moneda | Torneos | Con resultados publicados |
| --- | ---: | ---: |
| CLP | 1.158 | 148 |
| EUR | 73 | 73 |
| USD | 53 | 26 |
| **Total** | **1.284** | **247** |

- **221 de 247** torneos publicados (aprox. **89,5 %**) son **CLP/EUR**, que `publish_tournament_results_guarded` rechaza conservadoramente.
- De **32 ligas** con torneos, **0 combinan monedas**, tanto considerando todas las fechas como solo las publicadas. **30** ligas tienen resultados publicados. Esto es una propiedad del inventario actual, no una restricción de esquema.
- **1.781 jugadores** tienen filas de resultados publicados; **263 jugadores** aparecen en **más de una moneda** (20.432 filas de resultados publicadas).
- Verificación estructural de 1.284 torneos: **0** publicados sin resultados, **0** no publicados con filas de resultados, **0** publicados con distinto número de `elo_history` y `tournament_results`. Estos totales NO prueban que premios, ELO, perfil unificado o estadísticas monetarias sean correctos individualmente.
- El inventario anterior de 32 ligas mostró 0 ligas sin `is_primary` y 0 con múltiples principales; existe índice único `idx_leagues_slug`. Verificar nuevamente antes de migración.

## Bloqueo funcional: no basta con quitar el rechazo CLP/EUR

La implementación SQL de `calculate_tournament_elo_guarded(uuid)` multiplica el factor K por una función de **`tournaments.buy_in` numérico bruto**:

```sql
v_k := (CASE WHEN v_result.total_tournaments < 30 THEN 40 ELSE 20 END)::numeric
  * (1::numeric + log(10::numeric,v_buy_in+1::numeric)*0.1::numeric)
  * (1::numeric + log(10::numeric,v_n::numeric)*0.15::numeric);
```

El valor 10 CLP, 10 USD o 10 EUR NO representa el mismo costo, pero en esta fórmula produce el mismo componente K. A la inversa, un buy-in de 10.000 CLP y uno de 10 USD producen factores diferentes incluso si la escala económica fuese comparable. **No hay conversión explícita por moneda/fecha.** No inventar tasas FX ni adoptar una equivalencia histórica retroactiva sin investigación y decisión de negocio.

El motor actual añade además `prize_won + bounties_won` a `players.total_prize_won` y `buy_in * buy_ins_count` a `players.total_buy_ins_spent`, ambos **numéricos sin divisa asociada**. Esto puede mezclar unidades en las **263 fichas multimoneda**. No interpretar esos acumulados como un saldo en USD ni corregirlos automáticamente sin una conciliación y un plan de compatibilidad con la UI.

## Despliegue recomendado: dividir en dos gates independientes

### Release A: seguridad de ligas, sin activar ELO

Aprobar por separado el cierre de autovinculación/auto-promoción y edición de ligas ajenas. La propuesta `league-membership-guarded-cutover-2026-11-04.proposal.sql` y el formulario `save_league_guarded` ya aprobaron el **QA transaccional de 64 tablas** según el log del operador; PostgreSQL sintético + HTTP PostgREST y JWT de prueba también pasaron en CI. Sin embargo, **no se ha probado el formulario completo desde navegador conectado a Supabase Auth real**.

Previo a la autorización:
1. Ejecutar prueba E2E de crear, editar, clonar, asociar y eliminar ligas usando cuentas legítimas con distintos roles en una instancia completa no productiva. Validar roles club principal vs participante y superadmin, además de errores visibles para el usuario.
2. Auditar y reemplazar rutas directas que escriban `league_clubs`/`league_rooms` y comprobar que el resto de botones de administración no queden inoperantes tras REVOKE. Definir el flujo formal de invitación/aceptación entre **dos administradores diferentes**; de momento, la RPC solo acepta un actor que administre ambas partes o superadmin.
3. Registrar backup verificado/restaurable, snapshot de policies y privileges, recuentos y fecha de despliegue; revisión de migración real respecto del esquema vigente y de entidades relacionadas.
4. Preparar rollback que **NO restaure permisos vulnerables**; si falla el flujo nuevo, detener la edición de ligas temporalmente y mantener lecturas públicas.
5. Revisar y aprobar explícitamente el despliegue. **No fusionar PR #64 ni ejecutar el SQL propuesto directamente en producción.** Idealmente aislar los cambios de ligas del PR grande antes de la publicación.

### Release B: motor ELO protegido para CLP/USD/EUR

**No activar** `VITE_ELO_GUARDED_RPC` ni `VITE_TOURNAMENT_PUBLISH_RPC` mientras se cumpla cualquiera de estos puntos:
- Falta regla aprobada para normalización de buy-ins que haga comparable el factor K a través de monedas o una política explícita para un ELO independiente del valor monetario, con análisis de impacto sobre rankings existentes.
- Se mantienen acumulados monetarios de jugadores/perfiles sin unidad, o no existe un nuevo registro por `(player_id,currency)` que preserve importes originales y pueda reconstruirse históricamente desde resultados, buy-ins y bounties.
- No se ha reconciliado la historia ELO y los agregados existentes frente a los cálculos nuevos en **modo sombra**, sin modificaciones productivas.
- No existen garantías de concurrencia e idempotencia duradera de republicación, pruebas E2E de panel con Auth real, y reglas acordadas para torneos intermedios.
- No se ha realizado un ensayo de backup, restauración, flags y rollback sin reapertura de GRANT inseguros.

### Opciones para decidir, no supuestos implementados

- **A: K independiente del importe monetario.** Elimina dependencia FX, pero puede cambiar la ponderación histórica de resultados según buy-in. Requiere backtest y autorización.
- **B: K con buy-in estandarizado a una unidad de referencia.** Necesita política de tipos de cambio históricos por fecha y posibles excepciones para clubes/torneos; más trazabilidad y costo de mantenimiento.
- **C: K por categorías normalizadas dentro de cada moneda/mercado.** No requiere FX, pero exige definir tramos y documentar comparabilidad.

En los tres casos, **premios y buy-ins deben contabilizarse por divisa**; ninguno justifica sumar CLP, USD y EUR en una columna sin unidad. Guardar monto original + moneda de origen siempre; no reescribir premios históricos.

## Verificaciones ejecutadas y no ejecutadas

**Confirmado:** QA local reversible de RPC de ligas y guardado integral de formulario, tests sintéticos PostgreSQL/PostgREST/JWT, cinco comprobaciones CI anteriores, y consulta de solo lectura a producción.

**Pendiente:** análisis económico/histórico de las opciones de ELO, validación por moneda y ficha, backtesting y versionado de resultados, HTTP real de entorno Supabase íntegro, revisión de permisos coordinados, backup/restauración, revisión del release A y aprobación humana para cualquier cambio productivo.

**Decisión actual:** liberar **ninguna** migración todavía. Priorizar Release A de seguridad cuando pase E2E y exista aprobación; mantener Release B **NO-GO** hasta resolver multimoneda y reconciliación.
