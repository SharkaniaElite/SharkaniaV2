// src/pages/privacy.tsx
import { PageShell } from "../components/layout/page-shell";

export function PrivacyPage() {
  const lastUpdated = "2024-03-20";

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-sk-text-1 mb-2">Política de Privacidad</h1>
          <p className="font-mono text-sk-xs text-sk-text-3">Última actualización: {lastUpdated}</p>
        </header>

        <article className="prose prose-invert prose-zinc max-w-none text-sk-text-2 text-sk-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">1. Información que Recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Datos de Cuenta:</strong> Email y contraseñas (encriptadas de forma segura por Supabase Auth).</li>
              <li><strong>Perfil Público:</strong> Nicknames utilizados en las salas de póker, país de origen (código de bandera) y estadísticas de rendimiento derivadas de los torneos jugados.</li>
              <li><strong>Datos de Uso:</strong> Cookies técnicas esenciales para mantener la sesión activa e información básica de analítica (Google Analytics) anonimizada.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">2. Cómo Utilizamos su Información</h2>
            <p>
              La razón de ser de Sharkania es pública y competitiva. Su nickname, país, ELO y resultados de torneos <strong>son visibles públicamente</strong> en las tablas de clasificación, perfiles de jugador y registros históricos. No utilizamos su correo electrónico para spam, únicamente para notificaciones críticas de la cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">3. Compartir Datos con Terceros</h2>
            <p>
              <strong>No vendemos sus datos personales.</strong> La información solo se comparte con nuestra infraestructura de base de datos (Supabase) y alojamiento (Cloudflare) bajo estrictos acuerdos de procesamiento de datos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">4. Eliminación y "Derecho al Olvido"</h2>
            <p>
              Si desea que su nickname sea anonimizado en las tablas históricas o eliminar su cuenta de usuario, puede solicitarlo a través de las herramientas de su perfil o contactando al soporte. Tenga en cuenta que los resultados matemáticos de los torneos pasados (las posiciones) se mantendrán para no corromper el ecosistema ELO global, pero se desvincularán de su identidad.
            </p>
          </section>
        </article>
      </div>
    </PageShell>
  );
}