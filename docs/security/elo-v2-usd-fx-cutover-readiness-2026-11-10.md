# Sharkania — ELO v2 con buy-in convertido a USD: estado de QA

**10 de noviembre de 2026. PR #97 DRAFT apilado sobre PR #96 y PR #95. NO GO a producción.**

## Decisión y límites

El propietario aprobó mantener ELO v1 histórico sin reescrituras y calcular nuevas competiciones ELO v2 usando el buy-in equivalente a USD. Se conserva la misma estructura de K que el legacy, sustituyendo únicamente el importe nominal del buy-in por el importe en USD. Los premios, las reentradas y el registro económico permanecen en la moneda original.

- USD: entrada original.
- CLP: entrada dividida por CLP por dólar observado del Banco Central de Chile.
- EUR: entrada multiplicada por USD por EUR de la referencia del Banco Central Europeo.
- El importe original almacenado en producción tiene dos decimales. Un torneo de EUR 9,09 con cotización hipotética 1,10 USD/EUR equivale a USD 9,999 para el logaritmo, sin redondeo anticipado.

## Comprobación de fecha de la tasa

Los servicios oficiales proporcionan fecha de observación; consultar una observación histórica hoy NO prueba que ya estuviera publicada al empezar un torneo antiguo. El prototipo captura first_seen_at mediante PostgreSQL en el momento real de primera ingestión. Solo permite seleccionar tasas capturadas antes de comenzar el evento, y con fecha efectiva dentro de los siete días anteriores (ventana provisional de QA). Si falta, se rechaza el torneo; nunca se inventa una tasa ni se acepta del frontend.

**Mitigación QA añadida:** ya no basta con tener una cotización de menos de siete días. Se requiere un registro inmutable `fx_feed_check_v2` de **consulta exitosa al proveedor durante las dos horas anteriores al inicio**, cuya última observación aceptada coincida con la tasa seleccionada. La Edge Function registra la consulta solo después de validar la respuesta y almacenar todos los valores oficiales de ese proveedor. Una cotización antigua sin una consulta reciente impide publicar.

**Límite restante antes de GO:** la regla de dos horas **reduce el riesgo**, pero no certifica que no hubo otra publicación durante ese intervalo. La propuesta operativa es consultar al menos una vez por hora y alertar por fallo/ausencia de registros, pendiente de verificar cuotas BCCh y calendario TARGET/BCE, disponibilidades de días no hábiles, costos y compatibilidad real. No se creó ningún cron ni alarma. Si no podemos demostrar frescura suficiente en una fecha, la publicación se bloquea.

## Fuentes y acceso

- Banco Central de Chile, API BDE, serie F073.TCO.PRE.Z.D, pesos por USD. Requiere credencial API BDE del propietario administrada solo como secreto de servidor. https://si3.bcentral.cl/estadisticas/Principal1/Web_Services/documentacion.html
- Banco Central Europeo, serie EXR/D.USD.EUR.SP00.A, dólares por euro; API pública. https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata
- El módulo supabase/functions/elo-fx-capture está en el repositorio, pero la configuración supabase/config.toml lo declara deshabilitado. No se programó ni desplegó, y el secreto BCCH_BDE_API_TOKEN no está configurado.

## Entregables de QA

- docs/security/elo-v2-usd-fx-observations-2026-11-10.CANDIDATE.sql: recibos privados de tasa y equivalente por torneo, registro inmutable, rol de servicio y corte de activación apagado. Registra también `fx_feed_check_v2` con hora `checked_at`, última observación y controles de dos horas; un usuario autenticado no puede falsificar estas comprobaciones.
- docs/security/elo-v2-usd-results-writers-2026-11-10.CANDIDATE.sql: dos escritores iniciales atómicos, liga e independiente, para CLP/EUR/USD; no autorizan carga histórica ni resultado duplicado.
- supabase/functions/elo-fx-capture/official-parsers.mjs: validación estructural de BCCh y ECB.
- src/lib/api/guarded-v2-results.ts y los dos componentes admin: ruta detrás de tres flags coordinados apagados por defecto; no tiene fallback a REST cliente.
- .github/workflows/qa-elo-v2-official-fx-pg17.yml y .github/workflows/qa-elo-v2-real-auth-fx.yml: pruebas de PostgreSQL ficticio y GoTrue/PostgREST local con cuatro usuarios falsos. La suite local prueba autenticación, privacidad de tasas, USD/CLP/EUR, autorización y continuidad sin ELO v1.

## No resuelto antes de GO

1. Probar que la Edge Function compile y funcione con los verdaderos contratos/formatos de las APIs oficiales, sin publicar credenciales ni consultar en producción.
2. Definir cron de captura, alarmas por observación más reciente ausente, cuotas y operación ante revisión o caída de BCCh/ECB. Obtener credencial BDE por vía protegida, sin enviarla por chat.
3. Aprobar fecha/evento v2. Los torneos anteriores sin cotización capturada antes de su comienzo permanecen bloqueados; hace falta política separada para torneos CLP/EUR históricos aún sin resultados.
4. Ejecutar ambas RPC y su corte de ACL sobre clon real restaurado, con costo y creación previamente autorizados; auditar RLS, dependencias y pruebas de carga/concurrencia.
5. Ensayar una sola migración final coherente con #95, #96 y #97; backend, despliegue de Edge, cron, frontend y flags requieren aprobaciones separadas. No se ha modificado Supabase ni Cloudflare productivos.

**Estado: DRAFT / NO GO, ninguna modificación productiva.**
