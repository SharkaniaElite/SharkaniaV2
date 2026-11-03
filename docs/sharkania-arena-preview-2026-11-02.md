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
