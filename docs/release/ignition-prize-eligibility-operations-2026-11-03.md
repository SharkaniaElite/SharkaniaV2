# Liga SHARKANIA / Ignition — control de elegibilidad para premios adicionales

**Estado:** procedimiento operativo para revisión. **No implica que exista adjudicación automática ni autoriza pagos.**  
**Alcance:** liga noviembre 2026, premios del ranking mensual y bounty de cada fecha. Los premios ordinarios de los torneos se rigen por Ignition Poker.  
**Cambio en este PR:** comunicación y pruebas de interfaz en Preview. **Sin cambios SQL ni modificaciones de perfiles o pagos reales.**

## Regla anunciada al participante

> Solo quienes se registraron a la Liga SHARKANIA a través del sitio SHARKANIA y tienen su nickname de Ignition correctamente vinculado pueden optar al bounty de cada fecha y a los premios adicionales de fin de mes.
>
> Los jugadores ya inscritos en SHARKANIA en una edición anterior no deben crear otra cuenta ni presentar una segunda solicitud de vinculación. Deben entrar a su panel y consultar su estado.
>
> Jugar el torneo en Ignition por sí solo no otorga el derecho a esos premios adicionales; no se alteran por ello los premios regulares del torneo.

Evitar comunicar «ganador confirmado» o «premio asegurado» simplemente porque alguien aparece en el ranking ELO, en las posiciones de la liga o porque su solicitud de vinculación está pendiente.

## Comprobación operativa previa a adjudicar cada bounty

1. Registrar el resultado y comprobar en la fuente oficial del torneo quién consiguió el bounty, sin asumir que ganar una mano basta para definirlo.
2. Comprobar en el registro administrativo de SHARKANIA que la inscripción procede de SHARKANIA, incluso si es una inscripción de una edición anterior.
3. Comprobar en el **registro de perfiles controlado por el servidor**, no solo en datos editables del navegador, que el nickname corresponde al participante y su estado de vinculación está **verificado**. Revisar casos duplicados o pendientes con el equipo, sin adjudicarlos automáticamente.
4. Confirmar correspondencia exacta entre el jugador de Ignition y el registro del torneo; documentar cualquier diferencia de nickname y la resolución administrativa.
5. Solo después, validar las condiciones particulares del bounty publicadas para esa fecha y registrar la decisión y su evidencia por el canal administrativo autorizado.

## Comprobación antes de premios del ranking de fin de mes

1. Confirmar cierre de las cuatro fechas y datos oficiales cargados, incluida la corrección de reentradas o resultados duplicados.
2. Calcular la clasificación aplicando las reglas de la liga. **No utilizar directamente el ranking como padrón de ganadores habilitados**: las funciones actuales de cálculo de standings solo agrupan `tournament_results` por liga y jugador; no verifican `profiles.ignition_status` ni el origen del registro.
3. Para cada aspirante al premio, repetir la revisión de inscripción, vinculación verificada e identidad del jugador; preservar inscripciones de ediciones anteriores válidas.
4. Si hay una solicitud pendiente, registrar el caso para revisión humana. No pedir a ese jugador que cree otra cuenta ni convertir la solicitud en «verificada» desde el frontend.
5. Antes de comunicar adjudicaciones, comprobar las condiciones, desempates y documentación de premios aprobados por el organizador.

## Riesgos y controles técnicos pendientes

- El campo `profiles.ignition_league_player` por sí solo **no demuestra autorización**. Los metadatos del usuario y el estado que muestra React **no constituyen una regla de seguridad de backend**.
- `recalculate_league_standings` y `update_league_standings` no aplican, según la revisión de solo lectura, un filtro de elegibilidad para premios. No modificar estas funciones genéricas: afectan también a otras ligas.
- No se confirmó una función exclusiva que adjudique automáticamente el bounty ni un registro final de elegibilidad. Hasta incorporar y probar un control privilegiado de servidor, **la adjudicación exige revisión administrativa**.
- Los ajustes RLS/Stats Espía y la validación real de autenticación/Turnstile siguen siendo bloqueos para fusionar Arena. La revisión de premios no sustituye esos tests.
- Nunca editar por SQL los estados de jugadores o adjudicar pagos desde un script de QA. No compartir listados de participantes, correos ni tokens en GitHub.

## QA de comunicación y flujo

- [x] Página `/ignition`: explica premios adicionales exclusivos, distingue pozo regular y ofrece descarga mediante enlace SHARKANIA.
- [x] `/leagues/liga-sharkania-noviembre-2026`: advierte que participar en Ignition no basta y no pide reinscripción a participantes antiguos.
- [x] Panel de jugador: diferencia estado verificado de solicitud pendiente.
- [x] Inicio de sesión de participante antiguo: no vuelve a vincular ni cambia el estado ya guardado.
- [ ] Validación real con una cuenta de prueba verificada, una pendiente y una sin inscripción, en entorno Supabase aislado.
- [ ] Prueba con resultados oficiales de una fecha y revisión de elegibilidad de bounty.
- [ ] Validación de adjudicación mensual, con casos de participantes nuevos y de ediciones anteriores.

**Política de lanzamiento:** no prometer que el sistema adjudica premios de manera automática mientras estas pruebas no estén completadas. Este documento es una lista operativa, no una autorización legal ni un cambio en producción.
