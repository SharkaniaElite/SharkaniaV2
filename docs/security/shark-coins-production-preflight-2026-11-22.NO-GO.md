# Shark Coins — preflight productivo / NO GO hasta autorización y recuperación
Fecha: 2026-11-22. Issue #104. Alcance exclusivo spend_credits(uuid,text) y use_free_tool(uuid,text). No ELO, no índices, no cambios de roles, ni modificaciones a saldos históricos.

## Evidencia
- SQL candidato blob fbe68ea4043f25a70ccb10c0b5d16b9273617c6a; rollback 2c9138d716e72125d1f902fa96e5bae2d33525ca. Ambos en commit 6620bb1826896e33fad4ab4c1dfaeb16054f9af6. CI real Auth local 45019912765 PASS: apply, rollback, reapply; 8 llamadas simultáneas, una compra y un uso gratuito, compras per-use conservadas, anon y usuario ajeno denegados. Esquema de negocio sintético, no restauración de producción.
- Consulta de solo lectura posterior al despliegue de dependencias: exact_spend_body, exact_free_body, exact_trigger, exact_acl_guard todos true. Hashes de definiciones antiguas: spend ec287f59f138e41c4324e71894eb77f3; free 888e112254f9a82b417afcf94475df2d; trigger d9cda7bfd326fe52fa93ef18dcb9ddd9. Propietario postgres, search_path public, extensions; anon sin EXECUTE y authenticated/service_role con EXECUTE en las dos RPC.
- Instancia PG17.6, READ COMMITTED, UTC; 20 productos activos, 9 registros de uso gratuito; cero llamadas activas visibles en la observación (no implica exclusión de tráfico).
- Auditoría previa: 18 compras; cero enlaces a transacciones faltantes, duplicados o discrepancias de usuario, importe y tipo. 197 perfiles, cero saldos negativos/nulos. No conciliación exhaustiva del historial ni prueba de ausencia de perjuicio.
- Backup lógico local cifrado del esquema public consta en issue #98; lectura pg_restore verificada, restauración de prueba pendiente por protección del equipo. No afirmar restaurabilidad demostrada. No crear proyecto, habilitar PITR, modificar Windows ni transferir datos reales.

## Secuencia de corte propuesta — pendiente
1. Solicitar autorización específica sobre estas dos funciones y acordar ventana de baja actividad. Mantener ELO v2 sin activar. Confirmar vía dashboard el punto de recuperación disponible o concluir restauración aislada; no asumir que el backup antiguo basta. No iniciar con otro cambio de base de datos en curso.
2. Releer SHA exactos y repetir las comprobaciones de cuerpos, ACL, trigger, actividad y conteos agregados inmediatamente antes. Capturar ambos textos y ACL como contingencia, sin datos de jugadores. Si existe divergencia, detener.
3. Aplicar exclusivamente el candidato exacto bajo una transacción, con lock_timeout 3s y statement_timeout 20s. Las guardas verifican antes y después los cuerpos y ACL. No dividir transacción ni forzar bloqueo; si falla, confirmar que ambas definiciones antiguas siguen intactas.
4. Releer las definiciones y permisos, verificar trigger intacto y comprobar las invariantes agregadas de compras/saldos. No ejecutar llamadas que gasten créditos de usuarios reales, ni crear usuarios o transacciones de prueba en producción sin autorización separada. Comparar cambios legítimos entre capturas, no exigir conteo idéntico si hubo actividad.
5. Revisar errores de RPC sin exportar identidad ni payloads. Reversión de definiciones disponible en archivo exacto probado, con precondición de que las funciones nuevas no hayan cambiado. Revertir solo tras autorización/criterio de incidente acordado; vuelve a exponer el riesgo de carrera y no revierte movimientos históricos.
6. Conciliar registro de migraciones y Git mediante procedimiento dedicado aprobado; estos archivos son candidatos, no migraciones aplicadas. No declarar cierre antes de verificar resultados productivos.

## Decisión
Preflight técnico de catálogo PASS. GO para revisión; NO GO para cambios productivos por falta de autorización específica y recuperación verificada. No se ha ejecutado DDL ni DML.
