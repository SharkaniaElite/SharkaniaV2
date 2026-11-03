# Liga SHARKANIA — preparación operativa para jueves 5 noviembre 2026

**Registro:** 3 de noviembre de 2026. **Estado:** plan de salida, no autorización de deploy. **Proyecto:** SHARKANIA WEB (GitHub PR #64 en borrador).

## 1. Datos contrastados (Supabase solo lectura)

- Liga existente `liga-sharkania-noviembre-2026`, estado `upcoming`, del **5 al 26 de noviembre**.
- **4 fechas:** jueves **5, 12, 19 y 26**, **21:00 hora de Chile** (America/Santiago). Torneos con buy-in USD 3,30, pozo garantizado de USD 100 y registro tardío de 60 minutos, según la ficha del organizador.
- `rules_url` de liga = `https://sharkania.com/ignition`. Cada torneo tiene `custom_link=NULL`; las cuatro fechas tienen sala asociada con nombre actual **`Ignition Póker`**.
- `total_dates=4` y `best_dates_to_count=4`. `scoring_system_id` figura vacío; el recálculo observado no hace referencia directa a ese campo, pero debe confirmarse el criterio de puntos y el primer resultado antes de dar por cerrado el ranking.
- Perfiles vinculados a Ignition a fecha de inspección: **113 `verified` y 76 `pending`**; 8 de los pendientes se actualizaron desde el 1 de noviembre. Son perfiles históricos asociados a Ignition, **no inscripciones confirmadas exclusivamente a esta liga**. No extraer ni difundir su información personal.
- La ruta de detalle `/leagues/liga-sharkania-noviembre-2026` y la ruta `/ignition` están declaradas en el router. La primera ficha no fue comprobada con un navegador E2E real; que exista la ruta no demuestra el funcionamiento del formulario ni el SEO.
- **Corrección solo en Preview:** los enlaces informativos de fichas de torneos de sala `Ignition Póker`/ `Ignition Poker` remiten a `/ignition` cuando no existe `custom_link`, en lugar de dirigir a un club genérico. Añadido `tests/sharkania-november-league-links.test.mjs`.

## 2. Decisión de publicación

**Publicar el rediseño Arena completo antes del jueves: NO-GO**, mientras no estén resueltos Stats Espía RLS/RPC públicos, flujo Auth/Turnstile y compras en QA separado, SEO/UX y reversión. Un CI verde es necesario pero insuficiente.

**Ruta viable para el inicio de la liga:** conservar la web actual **ya operativa**, revisar manualmente sus rutas y la cola de vinculación Ignition, y publicar únicamente correcciones de alcance pequeño que superen QA, con autorización explícita y rollback. Ningún cambio de Supabase productivo ni merge del PR #64 implícito.

## 3. Checklist mínimo de la web actual para el jueves

- [ ] Abrir página de liga desde móvil y escritorio, confirmar H1, cuatro fechas, hora **21:00 CL**, fecha próxima y enlaces de navegación.
- [ ] Abrir `/ignition`; comprobar que el formulario muestra Turnstile y que el estado de vinculación se visualiza correctamente con una cuenta propia existente (no crear identidades sintéticas en producción).
- [ ] Revisar en el panel de admin solicitudes `pending`, su antigüedad y el circuito de validación; no aprobar automáticamente perfiles ni inferir su legitimidad.
- [ ] Confirmar que la navegación desde Calendario/fecha 1 llega a información de Ignition y no a una ficha de club equivocada.
- [ ] Comprobar que el ranking se actualiza después de publicar resultados; aplicar pruebas del cálculo ELO en entorno aislado antes de cualquier cambio del motor.
- [ ] Verificar rutas `/leagues`, `/calendar`, `/ranking`, `/ignition` y detalle de primera fecha en 390px y 1440px; confirmar login/recuperación y enlaces importantes.
- [ ] Confirmar normativas, términos del organizador, elegibilidad +18, premios y existencia real de las salas antes de publicar materiales de captación.
- [ ] Registrar commit de producción previo, preparar reversión y aprobar expresamente cualquier despliegue.

## 4. Plan comunicacional de contingencia (sujeto a validación legal)

**Riesgo regulatorio crítico:** la SCJ de Chile informa que la explotación comercial de plataformas de juegos de azar online no cuenta con autorización general en el país, y Subtel ejecuta bloqueos de dominios. Meta exige permiso escrito previo y cumplimiento legal para anuncios de apuestas o póker con valor monetario como entrada y premio. **No activar Ads de esta liga o piezas que promuevan inscripción pagada sin asesoría jurídica y la autorización expresa de la plataforma.** No dirigir publicidad a menores.

- **Martes 3:** completar QA de calendario, liga, navegación y panel de vinculación; preparar guía factual de ranking y fechas para comunidad existente, sin promesas de ganancias.
- **Miércoles 4:** validar revisión legal/comercial y publicar, cuando sea procedente, contenido informativo sobre el calendario, puntuación, perfiles y seguimiento ELO en canales de la comunidad con consentimiento.
- **Jueves 5:** verificar estado de la web, datos del calendario y enlaces; atender soporte de acceso/identidad; documentar que el ranking permanece vacío hasta cargar resultados; seguimiento de incidencias.
- **Después de la fecha 1:** actualización verificada del ranking y contenido editorial de resultados, respetando permisos de publicación y privacidad.

**Medición segura:** vistas de la ficha, clics a información de torneo, formularios iniciados/completados (solo datos agregados y con consentimiento), solicitudes pendientes/verificadas, consultas de soporte, usuarios que siguieron el ranking, errores de acceso. No atribuir resultados a Ads no autorizados.

## 5. Pendientes de ingeniería que NO se deben mezclar con la operación del jueves

- Prueba real en un proyecto Supabase QA con Auth y Turnstile aislados.
- Cierre de accesos heredados de Stats Espía; los SQL guardados pasaron PostgreSQL sintético pero no están desplegados.
- Migración del ELO de cliente a transacción server-side (propuesta probada con casos adversariales, no desplegada).
- Revisión accesibilidad y navegación de todo el rediseño Arena y aprobación humana.
- SharkTV fuera de este alcance, según instrucción del propietario.

**Sin cambios de producción, sin ramas Supabase pagadas, sin anuncios iniciados.**
