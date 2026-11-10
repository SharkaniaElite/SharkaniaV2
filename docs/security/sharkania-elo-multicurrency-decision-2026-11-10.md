# Sharkania — decisión ELO v2 normalizado a USD (10 noviembre 2026)

**Decisión de producto acordada con el propietario:** conservar intacto el historial ELO v1 e introducir un ELO v2 que convierta los buy-ins USD, CLP y EUR a un único equivalente en USD antes del cálculo. Esta decisión sustituye la propuesta anterior de no ponderar el buy-in. **NO implica autorización de desplegar, migrar, activar flags ni fusionar PR #95/#96.**

## Contrato de fórmula v2

El motor legacy-js-v1 aplica el factor:

K = (total_tournaments < 30 ? 40 : 20) × (1 + log10(buy_in + 1) × 0.1) × (1 + log10(número_jugadores) × 0.15).

**ELO v2 (elo-v2-usd-normalized)** conserva la estructura matemática y reemplaza solamente el buy-in nominal por su equivalente USD, siempre verificado y congelado por torneo:

- USD: buy_in_usd = buy_in; sin tasa externa.
- CLP: buy_in_usd = buy_in_clp / (CLP por 1 USD).
- EUR: buy_in_usd = buy_in_eur × (USD por 1 EUR).

Ejemplo **hipotético, NO cotización del día**: 1 USD = 950 CLP y 1 EUR = 1,10 USD. USD 10, CLP 9.500 y EUR 9,090909… tendrán el mismo componente de buy-in para el ELO. Con rivales, posiciones y otros factores idénticos, la variación será idéntica.

**Fuentes oficiales preferidas:**
- Banco Central de Chile: Dólar Observado en CLP por USD. Documentación: https://www.bcentral.cl/areas/estadisticas/preguntas-frecuentes-estadisticas ; API oficial: https://si3.bcentral.cl/estadisticas/Principal1/Web_Services/documentacion.html
- Banco Central Europeo: referencia EUR/USD en USD por EUR (usualmente diaria hábil): https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html

## Tipo de cambio del momento apropiado

El acuerdo de equivalencia por moneda requiere otra protección: **se usará la última cotización oficial que estuviera publicada y disponible al comenzar el torneo, NO la cotización del día en que el administrador carga resultados**. Un cambio publicado después del comienzo, aunque se carguen resultados semanas después, no debe afectar al ELO.

La fecha efectiva de la cotización nunca será futura respecto de la fecha local del torneo. En fines de semana/feriados se utiliza la última observación oficial disponible antes del inicio y se bloquean cotizaciones demasiado antiguas (umbral QA inicial: 7 días, sujeto a validación de feriados largos). Falta implementar el adaptador que consulta los proveedores desde el servidor y comprueba el timestamp de publicación. Si no hay tasa oficial verificable, **se bloquea publicación; nunca se inventa un valor ni se pide al navegador que lo envíe**.

## Evidencia permanente de cada torneo

Registrar con protección de escritura: ID torneo, algorithm_version, fecha-hora real + zona horaria, buy-in original y moneda, equivalente USD preciso, tasa y dirección, origen oficial, fecha efectiva, momento de publicación, ID de observación, fecha de captura y fingerprint verificable. El cálculo de K debe operar con precisión NUMERIC y redondear solo en el punto definido por la política ELO, no redondear a centavos antes del logaritmo.

**El equivalente USD alimenta solamente la ponderación del ELO.** Premios, reentradas, bounties y balances financieros conservan su moneda original y sus registros por moneda. Los acumulados legacy que mezclaban distintas divisas no deben presentarse como sumas en USD.

## V1 → V2: sin borrar ni reiniciar ELO

- **v1 histórica:** los eventos ya publicados conservan su puntuación y nunca se recalculan usando FX. El ELO acumulado previo continúa siendo el punto de partida del jugador.
- **v2 futura:** se aplica solo a torneos que comiencen desde una **fecha/evento de activación aún no aprobada**. A partir de esa competencia se usa buy-in convertido a USD. No se reinicia a 1200 ni se exige cuentas nuevas.
- **Competiciones antiguas sin resultados y correcciones:** seguirán bloqueadas hasta una política de replay cronológico auditado; no elegir algoritmo en función del día de carga.
- Nuevas monedas requerirán sus tasas oficiales y contratos de par antes de admitirlas.

## Preparación técnica realizada (NO producción)

- Módulo puro sin conexión a base de datos ni web: src/lib/elo/elo-v2-usd-policy.ts.
- Prueba QA determinista: tests/elo-v2-usd-normalization-qa.mjs: equivalencia de monedas, USD compatible con v1, fin de semana, cotizaciones posteriores/inválidas, fuente equivocada y preservación de v1.
- No hay proveedor de tipo de cambio conectado, no hay tablas de snapshots FX creadas y las RPC actuales de PR #95/#96 **siguen USD-only**. No sugerir que CLP/EUR funcionan ya.
- Antes de producción: implementar adaptador servidor y tablas de cotización; extender ambas RPC SQL de modo atómico, probar con JWT/REST y PG17; luego verificar en copia real restaurada con costos expresamente autorizados.
- Sigue pendiente decidir tratamiento de 34 ligas CLP/EUR no publicadas y torneos independientes CLP pasados, así como la fecha exacta de vigencia de v2. El historial antiguo no se reescribe.

**Estado Release A: DRAFT / NO GO.** Esta decisión es de diseño deportivo, no aprobación del cambio productivo.
