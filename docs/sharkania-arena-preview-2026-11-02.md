# SHARKANIA ARENA — prototipo de identidad y experiencia

Estado: **versión de prueba**, sin publicación en main y sin escrituras en Supabase.

## Tesis de producto
Sharkania debe reconocerse como una plataforma de póker competitivo, no como un agregador de enlaces comerciales.

## Jerarquía
1. Hero editorial fuerte: marca, propuesta de valor y dos acciones concretas.
2. Clasificación ELO real, obtenida mediante get_unified_ranking (sin números inventados).
3. Tres rutas de exploración: ranking, torneos y clubes.
4. Agenda del circuito obtenida de datos existentes, con carga diferida.
5. Noticias y promociones verificadas, con carga diferida e identificación comercial.
6. Comunidad y registro, sin prometer premios ni rentabilidad.

## Diseño
- Tipografía editorial contundente y sistema de paneles sobre negro azulado.
- Cyan como señal de acción y datos; dorado únicamente como acento de jerarquía competitiva.
- Tramas/ornamentos construidos con CSS; sin grandes imágenes de hero ni librerías de animación.
- Separación explícita de contenido deportivo/editorial y publicidad.
- Progresión clara de descubrimiento. En móvil, hero y ranking se apilan.

## Performance: hipótesis y validación
Base puntual Cloudflare Browser Rendering 390×844 previa al prototipo: 39 solicitudes, ~274 KB JS transferidos, ~917 KB JS decodificados, load ~2,90s, LCP ~1,22s; estos **no son datos p75** ni equivalen a una prueba móvil con CPU limitada.
- La portada Arena elimina cinco consultas de conteo en Home y el widget EmbedSocial de inicio.
- Evita el ticker y la consulta de banners en Home; se conservan en el resto de rutas.
- Solo consulta ELO al cargar. Agenda y publicaciones se solicitan con IntersectionObserver a 450px de cercanía.
- Mantiene globales analytics/autenticación por compatibilidad; optimizarlos requiere pruebas de atribución y privacidad, no suprimirlos a ciegas.
- Validar varias cargas en navegadores 320/390/1440; LCP, CLS y solicitudes; testar enlaces, errores y estados vacíos.

## Compatibilidad
- Nav/footer/auth/SEO existentes.
- No se alteran rutas públicas, sitemaps, RLS, Cloudflare Workers ni contenido.
- El prototipo reemplaza import del Home solamente en la rama. La portada vigente permanece en main.

## Criterios de aprobación
- El diseño debe verse propio y profesional en escritorio y móvil.
- Los jugadores mostrados deben corresponder a registros reales, no datos inventados.
- No debe haber overflow horizontal ni enlaces rotos.
- Las cuatro pruebas CI deben estar verdes.
- No fusionar a producción sin revisión visual y aprobación del propietario.

## Etapa 2 — extensión al interior del sitio (3 de noviembre de 2026)

Se mantiene todo en la misma rama de revisión del PR #64, sin merge a `main` ni cambios SQL.

### Sistema compartido
- `src/components/arena/arena-page-hero.tsx`: componente reutilizable para los directorios y rankings, con escena de póker por categoría, título editorial, métrica de datos reales y acción opcional.
- `src/styles/arena-interior.css`: sistema tipográfico y superficies unificadas, encabezados con fotografías ya existentes y capas de contraste, controles accesibles y adaptación móvil. Se carga desde `PageShell` con selectores acotados a la variante Arena.
- `PageShell variant="arena"`: conserva Navbar, Footer, soporte y verificación de edad global. No presenta banners comerciales ni ticker antes del contenido, como la portada Arena aprobada.

### Rutas de consulta renovadas
- `/ranking`: clasificación y filtros, paginación e Intelligence Hub intactos.
- `/ranking/:playerSlug`: identidad de perfil, ELO actual, estadísticas, gráfico ELO, alias y resultados intactos; no se alteran reglas de acceso a estadísticas.
- `/calendar`: agenda, pestañas Próximos/Historial, filtros, modal de torneos y paginación intactos.
- `/clubs`: listado y búsqueda, imágenes reales de los clubes y enlaces intactos.
- `/leagues`: temporadas activas/archivadas y sus estados intactos.

### Rutas de detalle renovadas
- `/tournament/:tournamentSlug`: estado en vivo, late registration, premios y resultados intactos.
- `/clubs/:clubSlug`: página del club, contactos, ligas y torneos intactos.
- `/leagues/:leagueSlug`: ligas, campeón, rankings, exportación y pestañas intactas.

### Rendimiento
Eliminadas de las cabeceras antiguas las consultas de `useSharkCoinsBalance` exclusivamente decorativas que se disparaban en Ranking, Calendario, Clubes y Ligas. Se conservan las consultas reales necesarias para resultados/estadísticas. El nuevo CSS de interiores usa las cinco fotografías WebP pequeñas ya presentes en `public/images/arena` y no requiere más recursos de imagen.

### Seguridad y QA
- No cambiar RLS, datos, autenticación, indexación, Workers ni permisos de Supabase.
- Revisar cuatro tests CI de último commit y build de Cloudflare Preview.
- Comprobar navegación desde Home a ranking, perfil, calendario, club, liga y torneo en escritorio y móvil.
- Verificar estados vacíos, fichas sin datos, filtros, SEO/URLs, tablas horizontales y accesibilidad.
- Mantener la renovación completa en borrador hasta evaluación humana.


## Etapa 3 — lectura de datos competitivos (3 nov 2026)

Se mantuvieron las consultas reales, URLs canónicas, paginación, filtros y lógica de ranking. Sin cambios en tablas SQL, RLS ni Supabase Storage.

- **Ranking:** tabla ELO de siete columnas en escritorio y tarjetas con puesto, avatar, nick, sala, ELO, torneos, cobros, ITM y victorias en móvil. Datos idénticos a los de la tabla original. Cabecera y filtros con labels, opción de restablecer y resumen de resultados. Los avatares con foto real siguen utilizando su origen; cuando faltan se dibuja una inicial en CSS, sin solicitudes a `ui-avatars.com`.
- **Perfil:** la curva ELO conserva la serie original y agrega el diferencial entre primer y último registro, con fecha y descripción accesible. Evita animaciones en cada actualización.
- **Historial:** las primeras dos filas permanecen visibles en cuentas sin Stats Espía, el resto no se inserta al DOM; usuarios con permiso conservan historial completo. El servicio de datos puede seguir ofreciendo información en la respuesta del navegador: confirmar autorizaciones servidor antes de considerar esta mejora como un endurecimiento de seguridad completo.
- **Torneos:** el encabezado de cada tarjeta enlaza de forma accesible al evento. Se eliminó la navegación por clic sobre todo el contenedor, que podía interceptar enlaces a clubes/ligas. Los contadores de eventos terminados dejan de generar intervalos por segundo. Controles y llamados a participar con redacción neutral.
- **Rendimiento y adaptación:** contenido móvil con `content-visibility: auto` para saltar el diseño de tarjetas fuera de pantalla, reglas de visibilidad explícitas y CSS acotado a `.arena-interior`.
- **Regresión:** ejecutar TypeScript, validadores SEO, limpieza y sitemap; probar anchos 320, 390 y 1440 px, enlaces a perfil, filtros de país/sala/nickname, detalles y bloqueo Stats Espía, así como nuevas consultas/transferencias en devtools.

No fusionar PR #64 hasta inspección visual y funcional de las rutas anteriores en preview.


## Etapa 4 — competiciones y revisión de permisos (3 nov 2026)

### Clasificación de ligas
- `LeagueStandingsTable`: tarjetas verticales móviles (puesto, nombre, club CCP, puntos, número de torneos, mejor posición y ELO); tabla de siete columnas completa en escritorio.
- `ClubStandingsTable`: tarjetas móviles para equipos y tabla en escritorio; se conserva el cálculo de puntos por mejores aportes existente.
- `ArenaLeagueDialog`: modal nativo `<dialog>` en un portal fuera de tablas con scroll, Escape, foco confinado/restaurado por navegador y botón de cierre accesible.
- Desglose de jugadores con carga/errores/estado vacío y control de respuestas tardías; club con `scoreHistory.slice().sort(...)` para no mutar el arreglo que React comparte.
- Tablas existentes, hooks, datos, RLS y consultas no fueron modificados por esta etapa.

### Auditoría read-only de Stats Espía: **RIESGO REAL / prioridad P0**
Inspección de metadatos `pg_policies`, `pg_proc` y `has_column_privilege` de Supabase sobre el proyecto de Sharkania:
- `players`, `tournament_results` y `elo_history` tienen RLS habilitado, **pero políticas SELECT para `public` con condición `true`**. Permiten leer todas sus filas por las políticas aplicables, no solo registros autorizados de Stats Espía.
- El rol `anon` tiene privilegio SELECT sobre `players.total_prize_won`, `players.total_buy_ins_spent`, `players.total_cashes`, `tournament_results.prize_won` y `tournament_results.buy_ins_count`.
- `get_unified_player_stats(p_slug)` y `get_unified_elo_history(p_slug)` están definidos como `SECURITY DEFINER` y cuentan con EXECUTE para `anon` y `authenticated`. La lectura está basada en metadatos; **no se ha demostrado que las funciones validen la suscripción** (la búsqueda superficial de controles no equivale a auditoría de función completa).
- `PlayerProfilePage` usa `useFeatureAccess("cosmetic_extended_stats")` para decidir qué mostrar; esconder columnas y filas desde React no equivale a restringir sus datos desde API.
- Los resultados públicos deportivos deben seguir siendo públicos; **no conviene eliminar indiscriminadamente las políticas SELECT** porque se romperían rankings, perfiles, torneos y contenido indexable.

**Plan de mitigación propuesto, no ejecutado:**
1. Inventariar todo uso de campos y RPC que necesita la vista pública; definir explícitamente métricas públicas frente a métricas premium.
2. Crear funciones/vistas públicas de mínimo privilegio y un endpoint autenticado que compruebe en servidor el derecho de Stats Espía; auditar el código de funciones SECURITY DEFINER (incluido `search_path`) y privilegios EXECUTE.
3. Preparar migración reversible de grants, RLS, RPC y clientes en entorno de prueba; validar con roles `anon`, `authenticated` sin permiso, con licencia, dueño y superadmin.
4. Solo tras aprobación del propietario, aplicar en producción con chequeos de regresión SEO, resultados, pagos y suscripciones.

**No se aplicó SQL ni cambiaron permisos de producción.** El riesgo existe en la configuración de datos revisada y requiere tratamiento antes de anunciar protección de estadísticas premium como característica segura.


## Etapa 5 — Stats Espía y velocidad: preparación segura (3 nov 2026)

### Rendimiento: código ya integrado en el prototipo
- **13 páginas pasadas de import estático a `React.lazy`** en `src/App.tsx`: EloSystem, Tutorial CSV, perfilador, ClubGG tutorial, promociones, SharkTV, revisión de mano, broadcast admin, campeonato Ignition, tutorial Ignition, noticias, promociones Mindev y Fullnuts. Se conservan todas las rutas y los controles.
- La foto decorativa del hero, confirmada como **elemento LCP** en una prueba móvil, pasa de `fetchPriority="low"` a `fetchPriority="high"`, con `loading="eager"` y tamaños explícitos. Los cuatro fondos inferiores siguen con `loading=lazy`.
- En una ejecución sintética móvil 390 px, antes de dividir rutas el JS transferido sumó aproximadamente 278.238 bytes; tras dividir rutas 233.912 bytes (reducción observada ~16%). **Son ejecuciones individuales de Cloudflare Browser Rendering, no un benchmark estadístico ni p75 real.**
- Una ejecución antes de cambiar prioridad registró ~1.500 ms de LCP en hero; otra después ~1.036 ms. **No atribuir causalidad ni comparar como mejora garantizada sin repetir mediciones controladas**.

### Stats Espía: cambios de código preparados
- `src/hooks/use-shop.ts`: claves de caché de compras, monedas y permisos incluyen ID del usuario autenticado. Inhabilita lecturas privadas al cerrar sesión; consulta otra vez al cambiar de cuenta.
- `src/lib/api/players.ts`, `src/hooks/use-players.ts`, `src/pages/player-profile.tsx`: visitantes sin licencia descargan solo **dos resultados** en las rutas de perfil y conservan un aviso basado en el número total de torneos. Consultas de usuarios con licencia conservan todo el historial por el mecanismo anterior hasta activar el backend de seguridad.
- `src/lib/api/stats-spy.ts` y `src/hooks/use-stats-spy.ts`: cliente e integración para RPC nuevas, solo activo al configurar `VITE_STATS_SPY_SECURE_RPC=true`. La bandera está **desactivada por defecto**; **NO activarla** antes de instalar las funciones, ajustar los privilegios públicos y validar con usuarios de prueba. Fallos de autorización nunca vuelven automáticamente al endpoint público.
- `PlayerStatsGrid`: comunicación ajustada para describir análisis de rentabilidad/histórico, sin afirmar exclusividad de métricas que el ranking ya expone. Estado visual sin oferta de compra temporal durante verificación de un suscriptor.
- `docs/security/stats-spy-guarded-rpcs-2026-11-03.proposal.sql`: dos RPC de lectura con `auth.uid()` y licencia activa/superadmin verificada dentro de PostgreSQL, SQL **no ejecutado**.
- `docs/security/stats-spy-cutover-runbook-2026-11-03.md`: contrato de datos, auditoría del SQL existente, fases, compatibilidad, pruebas por rol, migración y rollback.

**Punto de seguridad aún abierto:** `get_unified_ranking` devuelve premios/cashes/victorias y hace `SELECT *` internamente; `get_unified_player_stats` devuelve gastos/premios a usuarios anónimos; y las tablas base permiten SELECT público de valores usados como premium. La propuesta preparada **todavía no remedia esas vías**. La revocación efectiva se realizará solo tras migración completa de clientes y prueba con base de datos de desarrollo, no en producción a ciegas.

### QA de esta etapa
- 4/4 flujos GitHub Actions superados: TypeScript estricto, SEO/acceso, sitemap Worker y limpieza de funcionalidades.
- Vista móvil de Kolonvo (390 px): dos filas de historial, llamada de API con `limit=2`, paywall explicativo, cinco métricas bloqueadas visualmente, ningún recurso de imagen roto, documento 390 px sin desbordamiento.
- Cloudflare Preview desplegó cambios de división de código y prioridad del hero; últimas revisiones de integración quedan sometidas a QA de la vista previa final.
- Supabase proyecto de producción: **solo consultas SQL de lectura**; no se alteró una sola tabla, función, RLS ni permiso. No existen branches de Supabase disponibles para probar una migración sin crear un entorno nuevo.



## Etapa 7 — editorial, herramientas y aprendizaje (3 de noviembre de 2026)

Implementado **solo en la rama Preview del PR #64**, sin merge ni SQL en producción.

### Diseño y páginas
- **/blog**: portada de Biblioteca con cabecera Arena y cifra de artículos reales, búsqueda/categorías, resumen de resultados y tarjetas con foco visible; se preservan Proof of Work, recompensas y paginación.
- **/noticias**: cabecera y grilla Arena, fichas destacadas y filtros con `aria-pressed`; se corrigen los destinos internos para usar `getEditorialPath(category, slug)` (ruta de la sección real), sin cambiar slugs ni canonical.
- **/tools**: catálogo con hero Arena, número de herramientas, estado de Shark Coins y navegación hacia login mediante enlaces únicos (sin `button` anidado dentro de `Link`); no se cambia el acceso a los recursos ni los precios existentes.
- **/glosario**: índice con buscador, filtros de categoría, fichas adaptables y número de términos de la base de datos; se mantiene la ruta individual existente.
- **/glosario/:slug**: nueva cabecera semántica para cada definición; permanecen intactos JSON-LD DefinedTerm, breadcrumbs, definiciones y enlaces relacionados.
- **/academia**: nuevo hero y cantidad real de módulos; se conservan progreso, rachas, contenido, permisos y accesos a lecciones. La metadescripción ahora describe las autoevaluaciones opcionales (coherente con la UI existente).
- **/sistema-elo**: cabecera integrada y columna de lectura optimizada, conservando la explicación, el CTA al simulador y la clasificación.

### Componentes y CSS
- `ArenaPageHero` admite variantes `blog`, `news`, `tools`, `glossary`, `academy` y `elo`.
- Estilos en `arena-interior.css` aislados con `.arena-editorial`, `.arena-content-card`, `.arena-tools-grid`, `.arena-glossary-grid` y `.arena-learning-body`.
- Se reutilizan las cinco imágenes WebP ya incluidas en GitHub, sin añadir imágenes ni bibliotecas.
- Nuevo test automatizado `tests/arena-editorial-contract.test.mjs` para comprobar shell, SEO, navegación y controles de categorías.

### Verificación y límites
- La **primera tanda** (blog/noticias/tools) superó 4/4 flujos GitHub Actions y desplegó en Cloudflare Preview.
- El último código educativo también superó 4/4 flujos GitHub Actions; reconfirmar después del commit del nuevo test.
- Falta inspección visual humana y tests de interacción real en móvil 320px/390px y escritorio 1440px para todas las rutas nuevas; no presentar el prototipo como validado visualmente sin esta inspección.
- Otras rutas no cubiertas todavía: detalle editorial `/:category/:slug`, `/tools/*` (herramientas internas), `/academia/:moduleSlug`, `/academia/:moduleSlug/:lessonSlug`, comparación `/compare` y autenticación.
- No modifica políticas de Supabase, compras, Workers, sitemap, ni el flag de Stats Espía. **Mantener PR #64 en borrador sin fusionar**.


## Etapa 8 — identidad explícita de PÓKER y diseño de páginas de detalle (3 nov 2026)

Motivo: la revisión de la portada mostró que el lema «El ranking no miente» no explicaba, por sí mismo, que Sharkania trata de **torneos de póker**. No fue una decisión deliberada de producto, sino un déficit de claridad en el prototipo. La marca Arena se conserva, pero la disciplina y la oferta deben estar visibles en la primera pantalla.

### Portada y lenguaje de producto
- Nuevo H1: **«EL PÓKER TIENE SU ARENA.»**. Eyebrow «Circuito de póker competitivo», descripción de ranking ELO, torneos de póker online, jugadores, clubes y ligas. CTA «Ver ranking ELO» y «Ver torneos de póker».
- Tarjetas de acceso: «Ranking ELO de póker», «Torneos de póker» y «Clubes y ligas de póker»; agenda, noticias y banners editoriales con contexto claro.
- Se ajustó el tamaño tipográfico del hero para mantener el H1 legible en móvil y escritorio. Se eliminó el monograma ornamental «S ↗» que distraía encima del H1.
- NO se añadieron rutas, claims sobre indexación, números de resultados ficticios, ni lenguaje que garantice ganancias.

### Directorios, SEO y contenido
- H1/hero y metadatos ajustados con encabezados naturales para `/ranking`, `/calendar`, `/clubs`, `/leagues`, `/blog`, `/noticias`, `/tools`, `/glosario`, `/academia` y `/sistema-elo`.
- `index.html`, valores predeterminados de `SEOHead`, descripciones del JSON-LD y footer describen torneos de póker, rankings ELO y ligas reales. Se retiró la afirmación genérica «plataforma global» de esos textos, sin alterar el esquema ni el canonical.
- Inspección de HTML renderizado descubrió el título duplicado `Sharkania | ... | Sharkania` en Home; corregido haciendo que el título de `SEOHead` sea `Ranking ELO y torneos de póker online`, con la marca agregada una sola vez por el componente.

### Páginas de detalle renovadas sin cambiar negocio
- `/compare`: nuevo encabezado y experiencia de invitado y usuario autenticado; conservar `useFeatureAccess("stats_espia")`, cuotas, precios, cálculos y restricciones existentes. No declarar seguros los datos premium hasta corregir Supabase.
- `/academia/:moduleSlug`: módulo con jerarquía visual Arena; conserva desencriptación, permisos y progreso. Fichas de lecciones utilizables con teclado (Enter/Espacio).
- `/academia/:moduleSlug/:lessonSlug`: lectura y quiz dentro de superficies más claras, conservar su recompensa, navegación, WPT banner y estructura SEO.
- `/:category/:slug`: mejor tipografía, contexto editorial y orden visual, conservando títulos y metadatos individuales, enlaces, publicidad y recompensas. La página de artículo mantiene el PageShell estándar para no retirar accidentalmente banners globales.

### QA con limitaciones claramente identificadas
- Se añadieron tests `tests/arena-poker-clarity.test.mjs` para identidad de póker, rutas estables y regresiones de acceso/academia/editorial. Un test inicial exigía literalmente «DE PÓKER» incluso donde el texto se separaba en «CLUBES DE» / «PÓKER.»; se corrigió el test tras revisar los logs. El último commit de pruebas quedó 4/4 CI verde.
- Captura real móvil 390 px mediante Cloudflare Browser Rendering: el H1 y dos CTA de Home se leen sin recorte. Esa captura precede únicamente al ajuste final que elimina la pequeña «S ↗».
- Comprobación de `/ranking` por HTML renderizado: H1 «RANKING ELO DE PÓKER.» y título SEO correcto.
- Otras inspecciones simultáneas de Browser Rendering devolvieron 429 (límite del servicio); **no afirmar QA visual completa** de /tools, /academia, /compare, /glosario ni /noticias. Realizar revisión humana de esas rutas en ancho 320/390/1440 y de enlaces, formularios, errores, tablas y tipografía.
- Hasta la aprobación del propietario, NO fusionar PR #64 a `main`. Sin cambios en SQL, RLS, Supabase, sitemaps ni índices.


## Etapa 9 — herramientas y acceso de usuarios (3 nov 2026)

Solo rama `feature/sharkania-arena-experience-preview` del PR #64. No hay merge ni escrituras a Supabase de producción.

### Herramientas: estructura común
- Componente nuevo `ArenaToolHeader`, reutilizado por cinco pantallas de utilidad.
- `/tools/calculadora-icm`: encabezado profesional de ICM para torneos de póker. Conserva presets, distribución de premios, cálculos, límites de uso y contenido educativo.
- `/tools/simulador-elo`: portada específica del simulador, mantiene parámetros, fórmulas de ELO, límites y resultados.
- `/tools/calculadora-banca`: presentación de gestión MTT con aviso de que los cálculos son proyecciones; mantiene el `FeaturePaywall`, inputs y algoritmos.
- `/tools/quiz`: cabecera contextual persistente en preguntas y resultados para preservar un H1 reconocible; mantiene puntuación, preguntas, uso gratuito y paywall.
- `/tools/perfilador-salas`: cabecera, cuestionario y contexto explícito de póker. La introducción evita sugerir que un perfilado garantiza rentabilidad y aconseja comprobar legalidad y disponibilidad. No se han cambiado puntuaciones ni destinos comerciales existentes.

### Cuenta y seguridad: identidad visual consistente
- Componente nuevo `ArenaAuthFrame` con una columna explicativa de Sharkania y un formulario enfocado, sin cargar el menú general de la aplicación.
- `/login`: mantuvo Supabase Auth, Turnstile, redirección, mensajes, recuperación y estados de carga. Etiquetas vinculadas a campos, autocomplete y errores anunciados.
- `/register`: mismo mecanismo de alta de jugadores y solicitud de clubes, confirmación de email y validación; selector visual actualizado, etiquetas accesibles, metadatos `SEOHead` explícitos.
- `/forgot-password`: conserva correo transaccional, antienumeración y Turnstile, añade apariencia Arena y `noIndex`.
- `/update-password`: conserva `supabase.auth.updateUser`, confirmación de email y redirección; apariencia Arena, sugerencia de contraseña larga y `noIndex`.
- Hoja `src/styles/arena-workspaces.css` con estilos acotados a herramientas y autenticación, adaptable a `490px` y `850px`.

### Pruebas y límites
- `tests/arena-workspaces-contract.test.mjs` comprueba que rutas, invocaciones de cálculo, controles de suscripción, métodos de autenticación, Turnstile y CSS responsive permanecen en código.
- Un pase inicial de TypeScript detectó import `Link` sin uso en `room-profiler.tsx` después de quitar un enlace duplicado. Fue eliminado; verificar nuevamente las 4 comprobaciones antes del merge.
- Los tests de contrato comprueban presencia de mecanismos, **no** sustituyen pruebas manuales de compras, login real, recibo de email, quiz o cálculos correctos.
- No usar la vista Preview como evidencia de que se ha corregido la brecha RLS/Stats Espía: el trabajo de seguridad SQL sigue pendiente, sujeto al runbook.
- La experiencia a pantalla completa de `/tools/replayer`, los paneles privados `/dashboard` y `/admin`, y la revisión visual completa en 320px, 390px y 1440px todavía requieren fases específicas. No unificar a ciegas el Replayer porque tiene modo fullscreen.

Estado: mantener PR #64 en borrador y no alterar `main`, RLS, Supabase, licencias, URLs, sitemap ni Cloudflare Worker.


## Etapa 10 — continuidad visual de Promociones, SharkTV, La Bóveda y salas de póker (3 nov 2026)

Hallazgo inicial: las rutas comerciales y de video seguían montando `<PageShell>` en su modo `standard`; al navegar desde un directorio Arena aparecían el menú y la presentación previos. Además, el Navbar móvil del modo Arena utilizaba internamente la lista de enlaces antigua.

### Corrección de arquitectura sin perder monetización
- `PageShell` agrega `showMarketing?: boolean`, separado de `variant="arena"`. El valor por defecto conserva el comportamiento preexistente: Arena de directorios sin banners/ticker y páginas estándar con banners/ticker.
- Las páginas comerciales y editoriales migradas usan `<PageShell variant="arena" showMarketing>`: Navbar y footer Arena **manteniendo** `GlobalChampionsTicker`, `VerifiedBannerStrip` y el banner global verificado, incluyendo sus políticas de aprobación.
- `Navbar`: el desplegable Arena incorpora Estrategia y mantiene SharkTV, La Bóveda, CoinPoker e Ignition; el menú móvil ya utiliza `ARENA_MOBILE_LINKS` y muestra las salas con enlaces a tutoriales. Se añade `aria-expanded` al control de menú.
- Hoja `arena-public-bridge.css`: gradientes y fondos de la identidad Arena, tipografía, cartas, hero, bloques de contenido, menú móvil y estilos adaptables a móviles sin alterar componentes de compra, videos ni formularios.
- Componente `ArenaRouteTrail` con migas de navegación semánticas que llevan de cada oferta o tutorial a su sección padre. No sustituye slugs ni rutas canónicas.

### Páginas y contenido preservado
- `/promociones`: hero Arena, listado de ofertas revisadas y archivo histórico. Mantiene controles de `promoPhase`, fechas `America/Santiago`, `PromotionArtwork` y avisos editoriales.
- `/tv`: catálogo SharkTV con hero Arena y contador real de videos; mantiene lectura de `shark_tv_videos`, miniaturas, instructor, fecha y navegación a cada episodio. Se elimina un indicador «En línea ahora» que no estaba basado en estado real.
- `/tv/:id`: navegación Arena en loading, error y contenido; conserva Rumble, votación, contexto de la mano y videos relacionados.
- `/shop`: hero La Bóveda coherente con Arena, saldo real de Shark Coins y pestañas más accesibles con `aria-pressed`. **No se modifican** `useShopProducts`, `useUserPurchases`, `useSharkCoinsBalance`, precios, permisos, ni callbacks de compra.
- `/promociones/coinpoker`, `/tutorial-coinpoker`: navegación Arena, migas, hero y canonicals explícitas; conservan enlaces de afiliación, imágenes y zoom.
- `/ignition`, `/tutorial-ignition`, `/tutorial-ignition-deposit`, `/promociones/ignition-bonus`: navegación Arena, contexto del torneo y guías; se conservan formularios, captcha, pasos, medios y links comerciales.
- Otras promociones alcanzables: `/promociones/freeroll-diario`, `/mindev`, `/fullnuts`, además de los artículos dinámicos `/:category/:slug`. Estos últimos conservan anuncios y recompensas, y ya no devuelven al menú antiguo.

### Verificación y restricciones
- `tests/arena-public-navigation-contract.test.mjs`: cobertura estática de rutas, menú desktop/móvil, banners revisados, datos reales de tienda, selector de pestañas, TV, formularios, canonicals y contenido asociado.
- GitHub Actions en el commit de la suite de contratos: **4/4 checks aprobados**, incluidos TypeScript estricto, SEO/accesos, sitemap Worker y limpieza de funcionalidades retiradas.
- Pendiente inspección humana de navegación real con usuario autenticado, reproducción de Rumble, errores de compra y ofertas locales, además de QA visual completa en 320/390/1440 px.
- No se fusionó PR #64, no se editaron datos de producción ni Supabase; las ofertas de afiliados siguen requiriendo revisión editorial de vigencia, condiciones legales y elegibilidad por país (no inferirlas del rediseño).
