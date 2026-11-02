# Sharkania — Auditoría comercial, SEO y visual (02-11-2026)

## Evidencia comprobada (lecturas sin modificar producción)
1. La configuración de Supabase site_settings/banners tiene 10 posiciones y 9 banners de escritorio con imagen. top_global está vacío. Los cuatro grid de inicio enlazan respectivamente a tutorial CoinPoker, WPT Global, una red externa de afiliados y tutorial ClubGG.
2. La home muestra noticias, después cuatro banners y después el hero principal: publicidad antes de la propuesta de valor. En el código anterior, la imagen móvil de picture se podía acompañar del href de escritorio.
3. La sección Promociones incluye 8 posts publicados, varios sobre campañas históricas de junio-septiembre. La tarjeta mostraba siempre Activa sin validación de vigencia. blog_posts almacena tres imágenes distintas y banners embebidos por post.
4. El perfilador anunciaba 80% de éxito y 98% MATCH constante, sin derivación estadística visible.
5. El FloatingCTA está desactivado en su configuración actual. Su texto guardado promete ROI garantizado: NO ACTIVAR sin comprobación contractual/legal ni evidencia.
6. El frontend usa site_settings; banners_config contiene una fila de prueba inactiva. No duplicar fuentes de configuración.
7. PostHog, Microsoft Clarity y una integración opcional de GA4 existen; no se ha comprobado todavía que haya tracking de conversiones finales confirmadas por las salas.
8. Los banners de blog en wpt-banner.tsx ya usan rel sponsored. Conservar esa práctica y extenderla a otras salidas pagadas.
9. Esta auditoría no ejecutó un navegador de rendimiento/Lighthouse ni recibió estadísticas de altas o depósitos de partners. No afirmar resultados no medidos.

## Estrategia por prioridad
P0: Transparencia, vinculación correcta de ofertas, retirar afirmaciones no sustentadas, fechas y términos de todas las campañas.
P1: One-page editorial por cada sala, con países permitidos, información comprobable, última revisión, ventajas/desventajas reales, tutorial y CTA principal único, aviso de afiliación y juego responsable.
P2: CMS único, con id de sala, ubicación, creatividad, dispositivo, mercado, prioridad, estado borrador/aprobado/activo/pausado/vencido, inicio/fin, términos, licencia de logos, fuente, fecha de revisión, imágenes responsive y URL de destino revisada. Prevenir publicación automática de ofertas vencidas.
P3: Eventos estandarizados en PostHog: partner_promotion_impression, partner_promotion_click, partner_landing_view, partner_registration_confirmed, partner_first_deposit_confirmed. Los dos últimos solo con postback válido de sala; sin ese dato, los clics no equivalen a leads.
P4: Experimento A/B de orden de portada y diseño de tarjetas, con criterios de lectura del experimento y volumen suficiente antes de optimizar.

## Estructura propuesta
Inicio: Hero de identidad Sharkania con CTA a Rankings/Torneos; sección de salas como tarjetas comerciales explícitas; tabla comparativa editorial; tutoriales; publicaciones originales; footer legal/disclosure. Mantener navegación principal sin interstitial comercial.
Promociones: mostrar fecha comprobada y fecha final si existe, condiciones y países; nunca etiqueta de activo si solo existe fecha de publicación.
Artículos: publicidad contextual tras contenido útil; no desplazar el primer bloque semántico ni excederse en banners; respetar canónicas.
Tracking: evento de clic con placement, partner_id, creative_id, ruta y región, sin datos personales ni URL completa de afiliación. Distinguir visitas, clics, cuentas verificadas y depósitos aprobados.

## Guía técnica de imágenes
Usar archivo fotográfico sin texto incrustado y textos/CTAs en HTML. Modo oscuro carbón y azul petróleo, acento cian de Sharkania y dorado sobrio. Fotografía editorial realista, no fantasía de casino. Sujetos adultos 25+, manos/chips/cartas plausibles.
Hero desktop 1920x760 master, 1440/960/640 responsive; móvil 720x900 con composición diferente. Presupuesto inicial por validar visualmente: hero 180-320 KB desktop, 100-140 KB móvil, tarjeta 45-90 KB. AVIF/WebP, srcset/sizes, width/height, alt específico. Hero que resulte LCP: eager + fetchpriority high; no lazy; resto lazy+async. Sin autoplay ni carruseles pesados, usar CDN con caché.
Objetivos Core Web Vitals (objetivos NO resultados): LCP p75 <= 2,5s; INP p75 <= 200ms; CLS p75 <= 0,1. Revisar PageSpeed/CrUX antes y después.

## PROMPTS PARA GENERACIÓN DE IMÁGENES

### A — HERO INICIO (editorial de torneo)
Ultra-photorealistic full-frame editorial sports photography for a prestigious independent Latin American poker ranking and educational website. Authentic high-end tournament atmosphere in a contemporary Latin American city at dusk. Three fictional adult participants aged 28-45, including a woman and two men with varied believable Latin American features, concentrated and relaxed natural expressions. Correctly stacked tournament chips, accurate standard playing cards and green felt, credible gestures and natural fabric. The human subjects and table action occupy the right 55% of the composition. The left 45% has dark uncluttered cinematic negative space intended for an accessible HTML H1 and two buttons. Sony A7R V photojournalistic look, full-frame 35mm f/2.8, 1/125s ISO 800, realistic light bounce, clean natural skin texture, subtle film grain, graphite-blue shadows, sophisticated cyan rim lighting and warm golden background lamps. Sharp purposeful subject, subtle realistic background blur, editorial emotional credibility rather than posed gambling glamour. 16:7 wide high-resolution framing plus mobile crop safety. No text, no words, no watermark, no brand logo, no web UI, no money falling from sky, no fake prizes, no minors, no recognizable public figure, no deformed hands or impossible cards.

### B — HERO PROMOCIONES / FREEROLLS
High-end documentary tournament photography for a trustworthy Latin American competitive poker platform. Friendly small adult freeroll tournament in a real clean club, players aged 25-50 in smart casual wardrobe, sincere concentration and subtle anticipation, modest realistic chips and cards, tournament coordinator blurred behind the table, natural unforced gestures. Magazine-grade 50mm lens f/2, rich cinematic dynamic range, naturally warm practical lamps in an elegant graphite and teal interior, believable skin texture, restrained cyan highlights, authentic physical details. Focus on participant sitting on right, free uncluttered left 40% for HTML title. No guarantees or monetary claims, no banknotes, no casino brands, no text or rendered typography, no children, no artificial glows, no CGI appearance. Landscape 16:9.

### C — HERO ACADEMIA / HERRAMIENTAS
Ultra-photorealistic editorial photo, adult Latin American female poker strategist aged around 32 studying tournament hand history with an adult colleague in a modern professional home-office, laptop with abstract illegible dark interface, a handful of plausible poker chips and cards on a tidy desk, thoughtful calm collaboration and not a victory scene. Full-frame 50mm f/2.8, soft large window source, controlled cyan practical accents in charcoal/teal scene, true skin pores, natural hands, authentic photographic contrast and reflections. Subjects occupy right 60%, left 40% reserved for HTML headline. 16:9, no words, logos, personal identifying details, celebrities, minors, simulated money, fake button or screenshots.

### D — TARJETAS/BANNERS DE SALAS
Photorealistic premium editorial card image, generic brand-free real poker tournament felt table, extreme believable close-up of an adult hand adjusting a tidy chip stack, two face-down normal-size playing cards and opponent in authentic soft-focus background. 85mm full-frame lens f/2.8 close focus, perfectly believable anatomy and card geometry, natural restrained graphite/cyan/gold palette, refined low-key tournament lighting with fine realistic grain, clean darker left 45% reserved for programmatically overlaid HTML room name, actual verified terms and accessible CTA. Generate full 3:2 master preserving important details when cropped to 600x250 desktop and 350x200 mobile. No logos, no text, no fake jackpot, no cash piles, no extreme neon, no minors, no public-figure lookalikes, no composite collage.

## Publicación segura
1. Generar 2-3 propuestas por escena y revisar coherencia de manos, mesa, fichas y cartas.
2. Elegir recortes desktop/mobile. Crear versiones AVIF/WebP localizadas en servidor con buena caché. Superponer texto y logo licenciado en HTML.
3. Validar color y contraste, alt y focus, dispositivos 360/390/768/1440, y comprobar enlaces externos por país.
4. CI, preview y medición de LCP/INP/CLS; revisión del contenido promocional y legal. Publicar después de aprobación. No activar ofertas falsas.
5. Para monetización real: contrastar evento de clic con informes/postbacks del partner. Sin confirmación de sala no declarar registros ni conversiones.

Fuentes técnicas: https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links ; https://developers.google.com/search/docs/appearance/google-images ; https://developers.google.com/search/docs/appearance/core-web-vitals ; https://web.dev/articles/optimize-lcp

## Cambios propuestos en el PR
- Home: enlazar dispositivo al href correcto, disclosure comercial, rel=sponsored externo, evento clic PostHog, alt/dimensiones y prioridades de imagen.
- Promociones: evitar afirmar vigencia, transparencia y miniaturas lazy.
- Perfilador: suprimir porcentajes sin fundamento, calificar enlaces comerciales y explicar recomendaciones orientativas.
La rama no cambia datos de Supabase ni despliega producción, y las nuevas fotos son prompts, no archivos aún generados.


## Capacidad real de publicación de recursos visuales (verificación 02-11-2026)
- Supabase Storage ya tiene el bucket público `blog_images` (206 objetos) y `Logos Sharkania` (13 objetos); también existen otros buckets de uso funcional. Consultas de solo lectura, no se subieron archivos ni se modificaron políticas de Storage.
- La conexión actual de Supabase permite leer tablas y ejecutar SQL, pero no ofrece una operación directa de carga binaria a Storage. La integración de las imágenes generadas **no está automatizada todavía**: no confundir generación de un recurso visual con subida/publicación. Prohibido colocar claves secretas en el cliente para intentar salvar esta limitación.
- Ruta técnica prevista: crear imágenes originales sin logos, generar recortes desktop y mobile, convertir WebP/AVIF, conservar un manifest de dimensiones/alt/licencia, subir mediante una operación Storage autenticada con permisos mínimos, usar URLs versionadas en el CMS, verificar CDN/caché y revisar preview antes de producción. La etapa de carga requiere una vía de transferencia binaria realmente disponible o un flujo de publicación autorizado. No crear un bucket nuevo innecesariamente.
- Guardar los archivos en Storage no equivale a insertar imágenes en una tabla SQL. La configuración de banners de la portada se obtiene desde `site_settings` y referencia rutas/URLs; los recursos editoriales se asocian a `blog_posts`. Evitar duplicar configuraciones.

## Revisión obligatoria de marcas y logos
- **ClubGG**: sus directrices oficiales restringen los usos que sugieren patrocinio, prohíben presentar al club como socio de ClubGG y restringen el uso de su logo en promocionales; indican que logo y enlaces de descarga pueden mostrarse en footer con aviso obligatorio en negrita. También prohíben publicitar públicamente juego por dinero real o métodos de pago como club de ClubGG. Estas reglas deben revisarse antes de generar o publicar un banner ClubGG; usar preferentemente identidad propia de Latin Allin Poker y no añadir sello ni logo ClubGG sin autorización.
- Texto oficial del aviso exigido por ClubGG en inglés: "ClubGG is a free poker client that only offers poker gameplay with play money that doesn’t have any monetary value and is not affiliated with, sponsoring, or endorsing this promotional activity." Revisar versión textual y ubicación con el responsable de cumplimiento antes de publicar modificaciones.
- Fuente primaria: https://www.clubgg.com/media-guideline (consultada 02-11-2026). No dar por hecho permiso universal para usar logos de terceros por el solo hecho de que sean visibles en internet.
- Para otras salas: priorizar kits oficiales del programa de afiliados o archivos entregados por el partner, registrar procedencia/condiciones de uso, no incorporar logos a fotografías generadas con IA. Ignition menciona explícitamente materiales y banners disponibles en su plataforma de afiliados: https://www.ignitionpoker.com/en/affiliates.
- No afirmar que una oferta está vigente sin fuente, término y países admisibles actualizados. Señalizar siempre contenido comercial y juego responsable.


## Ejecución real: promociones verificadas / borradores creados (2 de noviembre de 2026)
Fuentes primarias revisadas en noviembre de 2026. No reutilizar artes comerciales generadas con logos aproximados: los activos originales de marca residen en Supabase Storage:
- `Logos Sharkania/coinpoker.png` (18.976 bytes)
- `Logos Sharkania/wptglobal.png` (11.768 bytes)
- `Logos Sharkania/logo-ignition-poker.png` (87.823 bytes)
- `Logos Sharkania/sharkania-horizontal-light.svg` y `...dark.svg`.
No se encontró el logo oficial de Latin Allin Poker en ese bucket concreto. Revisar otra ubicación/autorización antes de diseñarlo; no improvisar versiones con IA.

**Se insertaron y verificaron tres nuevas entradas en `blog_posts`, todas `published=false, status=draft`; ninguna visible en público:**
1. `coinpoker-bono-bienvenida-150-2026`: fuente https://coinpoker.com/es/promotions/welcome-bonus/ ; 150 % hasta USD 2.000, primer depósito USD 10+, selección durante depósito; liberación mediante rake equivalente a 10x importe de bono, 30 días oficiales para liberarlo. Revisión editorial 2026-12-02 (no caducidad oficial).
2. `wpt-global-paquete-bienvenida-2026`: fuente https://wptglobal.com/es/poker/promociones/welcome-offer ; 100 % condicionado hasta USD 3.000, modalidad según región, 60 días liberación y tickets con plazos propios. Revisión editorial 2026-12-02 (no caducidad oficial); código FPHL no presentado como beneficio extra garantizado.
3. `coinpoker-pgt-kickoff-noviembre-2026`: calendario https://coinpoker.com/es/pgt-in-app-schedule/ ; fechas oficiales 8 a 30 noviembre 2026. Para este evento prevalece el final oficial del 30 de noviembre, no un período artificial. Aclarado que The One octubre 2026 ya terminó.

**Contenido existente:** `/promociones/ignition-bonus` ya utiliza una landing React dedicada y el bono de hasta USD 1.000 está documentado en https://www.ignitionpoker.com/en/bonus-terms-conditions ; no se crea una URL duplicada para el mismo beneficio. La landing existente contenía promesas específicas de cuatro freerolls Sunday de USD 1.200, elegibilidad universal de LATAM y "rakeback 50%" sin suficiente contexto. Se corrigieron esas aseveraciones en la rama de revisión, junto con divulgación de afiliación y plazos reales. Su publicación requiere aprobar el PR y revisar la ruta.

**Control de vigencias en frontend (PR, sin deploy):**
- `verified-on:YYYY-MM-DD`: fecha efectiva de comprobación editorial; `review-by:YYYY-MM-DD`: fecha límite de la comprobación. La política para ofertas sin fecha oficial de finalización es revisión a 30 días desde última verificación. Una revisión vencida **no implica que el operador haya cancelado la oferta**: solo se oculta de la lista de ofertas verificadas hasta su reconfirmación.
- `starts-on:YYYY-MM-DD` y `official-end:YYYY-MM-DD`: fecha oficial de evento. Se muestra "Próximamente" si todavía no inicia; sale del listado prioritario tras la fecha final.
- Entradas sin verificación se muestran por separado como archivo histórico y no aparecen con insignia de "activas".
- `partner:coinpoker|wptglobal|ignition`: permite mostrar el PNG oficial de Storage cuando una entrada verificada no tenga imagen editorial, sin logos generados por IA.
- Este mecanismo de interfaz no ejecuta por sí solo una nueva investigación ni revalida ofertas automáticamente: antes de vencer el plazo se debe consultar de nuevo la fuente y actualizar la ficha. Está preparado para automatizarse, pero todavía no cuenta con una tarea recurrente conectada.
- Mantener las 3 páginas nuevas en borrador hasta finalizar QA de rutas, texto comercial, países, referencias, robots/canónicas, preview y aprobación de publicación. No modificar datos de promociones históricas en producción sin revisión individual.

**Observaciones críticas de fuentes:** El directorio de CoinPoker exhibía información antigua sobre The One en la vista de octubre, pero la actualización oficial posterior indica que la edición 2026 terminó, con retorno proyectado para 2027: https://coinpoker.com/es/promotions/ . En el caso del calendario PGT, alguna sección secundaria muestra una fecha 2025 errónea, mientras el cronograma completo corresponde claramente al 8–30 de noviembre de 2026: https://coinpoker.com/es/tournaments/pokergo-tour-online/schedule/ . El contenido editorial cita explícitamente el calendario y no usa la fecha inconsistente.
