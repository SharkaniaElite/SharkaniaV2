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
