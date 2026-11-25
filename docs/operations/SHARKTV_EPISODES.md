# Gestionar episodios de SharkTV

Abre **Super Admin → SharkTV → Gestión de episodios**. Selecciona un episodio para editarlo o **Crear episodio** para registrar una pieza nueva. La producción requiere la aprobación correspondiente antes de guardar. La preview pública solo permite consultar el catálogo y las fichas.

## Datos editoriales

- **Título**, **Serie**, **Descripción**, **Presentador**, **Duración** en minutos y segundos y **Temas** separados por coma.
- **URL oficial del reproductor**. Copia el atributo `src` de **Compartir → Insertar** en Rumble. La **Página pública de Rumble** tiene su propio campo. Los identificadores del embed y la página pueden ser distintos.
- **Miniatura**. Pega una URL HTTPS de una imagen autorizada. Para Clérigo Analiza #01, dejar el campo vacío conserva la miniatura oficial.
- **Destacar en SharkTV** selecciona el episodio más reciente marcado como destacado. En el archivo se mantienen los demás episodios. Los campos de la mano son opcionales.

## Registrar Clérigo Analiza #01

Busca primero el episodio por su título o el enlace de Rumble. Si ya figura en el selector, usa **Editar episodio**. Crea una fila solo si falta. Usa estos valores para identificar el estreno:

| Campo | Valor |
|---|---|
| Título | Clérigo Analiza #01 — Gané con una escalera… ¿pero hice bien el call? |
| Serie | Clérigo Analiza |
| Presentador | Clérigo Póker |
| Duración | 6:18 |
| Temas | Análisis de manos, Pot odds, Decisiones, NL25 |
| URL del reproductor | `https://rumble.com/embed/v7gq0y0/?pub=4par2u` |
| Miniatura oficial | [WebP alojado en Sharkania](https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/blog_images/clerigo_analiza_%20jugue_mal.webp) |
| Página pública | `https://rumble.com/v7iwdvi-gan-con-una-escalera-pero-hice-bien-el-call-clrigo-analiza-01.html` |

El catálogo reconoce el estreno por el ID del embed o de la página pública. Tras registrarlo, muestra una sola tarjeta y usa los metadatos guardados en `/tv/clerigo-analiza-01`. Si hay filas duplicadas, la vista pública elige la coincidencia más reciente. Las filas existentes permanecen disponibles para revisión en Super Admin.

Al revisar una publicación autorizada, comprueba que el catálogo muestre una sola tarjeta del estreno, que su ficha mantenga la ruta anterior y que **Cargar reproductor** y **Ver en Rumble** abran el episodio correcto.
