// src/lib/admin-help-texts.ts
// Centralized help texts for club admin InfoTooltips.
// Each key maps to a section or feature in the admin panel.

export const ADMIN_HELP = {
  // Templates tab
  templates: {
    title: "¿Qué son las plantillas?",
    content:
      "Una plantilla es la configuración base de un tipo de torneo que se repite. Crea una plantilla una vez (ej: 'Freeroll Nocturno') y úsala para generar torneos rápidamente sin rellenar los datos cada vez.",
  },
  templateRecurrence: {
    title: "Días de repetición",
    content:
      "Selecciona qué días de la semana se repite este torneo. Después podrás generar el calendario de 30 días con un solo click y todos los torneos se crearán automáticamente.",
  },
  generateCalendar: {
    title: "Generación Masiva por Rango",
    content: "Selecciona una fecha de inicio y fin (máximo 30 días). El sistema evaluará todas tus plantillas activas y programará los torneos automáticamente en los días de la semana que tengan configurados dentro de ese período.",
  },
  importCSV: {
    title: "Importar calendario desde CSV",
    content:
      "Sube un archivo CSV con columnas 'plantilla' y 'fecha' (mínimo). Puedes agregar 'hora', 'nombre', 'buyin' y 'garantizado' como columnas opcionales. Ideal para cargar todo el mes de golpe.",
  },
  cloneTournament: {
    title: "Clonar torneo",
    content:
      "Crea un torneo nuevo con todos los datos de esta plantilla. Solo necesitas elegir la fecha y hora. Opcionalmente puedes cambiar el nombre o el buy-in.",
  },
  bulkDelete: {
    title: "Eliminación masiva",
    content:
      "Selecciona torneos programados para eliminarlos de golpe. Solo se pueden eliminar torneos con estado 'scheduled' que aún no tienen resultados subidos. Los torneos completados no se pueden eliminar en lote.",
  },

  // Tournaments tab
  tournaments: {
    title: "Gestión de torneos",
    content:
      "Aquí ves todos los torneos de tu club. Puedes crear torneos manualmente, subir resultados, editar o eliminar. Los torneos con resultados subidos calculan el ELO automáticamente.",
  },
  uploadResults: {
    title: "Subir resultados",
    content:
      "Sube los resultados del torneo con un CSV que tenga: posición, nickname del jugador y premio ganado. Al subir, el sistema calcula automáticamente los cambios de ELO para cada jugador.",
  },

  // Players tab
  players: {
    title: "Jugadores del club",
    content:
      "Aquí ves todos los jugadores que han participado en torneos de tu club. El ELO y las estadísticas se actualizan automáticamente cada vez que subes resultados.",
  },

  // Leagues tab
  leagues: {
    title: "Ligas",
    content:
      "Las ligas agrupan varios torneos en una temporada con tabla de posiciones. Crea una liga, asígnale torneos y el sistema calcula la tabla de puntos automáticamente.",
  },

  // Stats tab
  stats: {
    title: "Estadísticas del club",
    content:
      "Resumen rápido de la actividad de tu club: total de torneos, próximos programados, completados y ligas activas.",
  },

  // Info tab
  info: {
    title: "Información del club",
    content:
      "Edita la descripción, datos de contacto y redes sociales de tu club. Esta información es visible para todos los visitantes de tu perfil de club.",
  },
} as const;
