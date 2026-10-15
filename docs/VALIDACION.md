# Registro de validación · COOP.IA 3.0

Última actualización: 15/10/2026. Original auditado: ProCoop_Wanda_Mejorado(2).html.

## Ejecutado

Actualización 15/10/2026: 30 pruebas automatizadas aprobadas mediante `npm test`, sin fallas. La regresión de los diez casos utiliza las funciones y formularios originales dentro de JSDOM. No sustituye una inspección visual en un navegador real.

| Criterio | Evidencia / resultado |
|---|---|
| Respaldo preservado | SHA-256 coincide byte por byte con el adjunto. No se modificó Netlify original. |
| Dashboard, socios, lecturas, caja, historial, reclamos, órdenes, trámites, convenios, reportes | Navegación DOM y operaciones originales conservadas. |
| Diez casos educativos | Se ejecutó el circuito completo: diez de diez completados. Incluye alta, lectura/factura, caja, fuga/orden/cierre, titularidad, conexión, reconexión, convenio, nota de crédito y operación integradora. |
| Caja y cobros | Cobro sin caja abierta rechazado; apertura por formulario y recibos asociados al turno verificados. |
| Persistencia original | Un valor existente bajo la clave original permanece intacto; COOP.IA usa otra clave. |
| Seis perfiles | Seis tarjetas y diez herramientas. Restricciones de herramientas por perfil comprobadas. |
| Cobranzas | Totales independientes confirmados: 501.200 facturado, 363.650 cobrado, 137.550 pendiente; 37 facturas, diez pendientes. |
| Ajustes, convenios y pagos parciales | Caso con nota de crédito de 100,25 y pago parcial de 200,35: conciliación correcta sin doble descuento. |
| Fechas y morosidad | Factura que vence en el corte no se cuenta como vencida; corte anterior a los movimientos se rechaza. |
| Datos manipulados | Importes negativos, duplicados, referencias rotas y herramientas no autorizadas rechazados. |
| Minimización | Se excluyen nombres, DNI, domicilios y teléfonos del conjunto destinado al servidor/modelo. |
| Reclamos | Tres abiertos de agua, agrupación sin inventar causa, dos borradores; no duplica la orden existente. Una coincidencia adicional ficticia se prueba solo en tests, no se agrega a la entrega. |
| Modo guiado | Ambos escenarios, traspasos, resultados, revisión e impresión sin consumo de API ni mutaciones de la base. |
| Motor multiagente | Circuitos completos API → perfiles → herramientas → transferencia → informe → aprobación probados con dobles de proveedor explícitos. Cuatro llamadas en cobranzas, cinco en reclamos. NO acredita inferencia externa real. |
| Adaptador Gemini | Contrato HTTP y estructura de respuesta probados con fetch de prueba; clave en cabecera, nunca en URL o resultado. |
| Proveedor de respaldo | HTTP 429 detiene Gemini, habilita solo respaldo autorizado y registra dos intentos; consumo sin metadatos marcado como estimado. |
| Cuotas atómicas | Veinte intentos concurrentes contra una cuota de cinco: solo cinco reservas aceptadas. Reserva sobredimensionada rechazada desde el primer intento. |
| Autenticación | Endpoints de inferencia, configuración, historial y aprobación rechazan visitantes; cookie HttpOnly/Secure/SameSite, origen, expiración e intentos de ingreso comprobados. |
| Sesiones, duplicados y aprobaciones | Las tareas son propias de su sesión. Solicitud duplicada y doble aprobación rechazadas. |
| Costo cero | Inferencia desactivada sin confirmación temporal del nivel gratuito; modelos fuera de lista bloqueados. No hay funciones para upgrades o cargos. |
| PDF | Archivos PDF auténticos, independientes de Internet, fuentes incrustadas; extracción de texto y renderizado Poppler revisados. Tablas/detalle de facturas y trazabilidad incluidos. |
| Pantallas y recursos | Secciones, diálogos, estados, impresión y presentación probados en DOM; no hay scripts externos. CSP contiene hashes de todos los scripts. |

## Pendiente, sin afirmar como completado

Actualización de diagnóstico del 11/10/2026: ejecutadas las 14 pruebas de `tests/security.test.mjs`, todas aprobadas. Cuatro pruebas nuevas comprueban persistencia de la causa y cuota cero, clasificación sin filtración de secretos, conservación de bloqueos heredados y recuperación después del vencimiento. Los intentos durante una pausa no llaman al proveedor ni incrementan consumo. Son pruebas con respuestas de API controladas, no inferencia auténtica. Se comprobó mediante GET público que el backend desplegado por el propietario en `coop-ia-wanda.coopia-juan.workers.dev` responde y declara autenticación configurada. El propietario informó una conexión fallida; la causa original no fue conservada por la primera versión. El modelo real aún no se considera validado. El 15/10/2026 no se pudo renovar esa comprobación pública: Cloudflare respondió 403/1010 al cliente de este entorno. No demuestra que el sitio sea inaccesible para el propietario.

1. **Conexión de inferencia auténtica:** requiere clave propia de Gemini o binding Workers AI. No se suministró ninguno, no se generaron claves y no se usaron credenciales de terceros.
2. **Aplicación de esta actualización en el backend del propietario:** el propietario ya publicó `coop-ia-wanda.coopia-juan.workers.dev`, migró D1 y configuró sus secretos. Queda pendiente que aplique la actualización 3.0.2 y pruebe la conexión de Gemini. El sitio de descargas sigue siendo estático.
3. **Prueba en un modelo real:** validar la calidad del enrutamiento y análisis, tolerancia del JSON, cuotas efectivas y consumo de CPU de Workers Free. Los tests de contrato no demuestran disponibilidad del modelo.
4. **Revisión visual en navegador, celular y proyector:** no había control de navegador habilitado en el entorno de desarrollo. Hay reglas responsive, fuentes legibles, tablas desplazables y modo presentación, pero JSDOM no mide diseño ni distribución física.
5. **Usabilidad institucional:** realizar una prueba docente y registrar mejoras. No se configura cumplimiento de un SLA ni decisiones sobre servicios reales.

## Verificación final a realizar al activar IA

Ingresar como administrador en el backend publicado, verificar conexión, ejecutar cobranzas reales, comprobar transferencia Valentina → Mateo, contrastar los importes con el historial de ProCoop, exportar evidencia JSON y PDF, registrar revisión y repetir con reclamos. Comprobar que un visitante sin sesión recibe 401 y no genera llamadas en la tabla de consumo. Mantener el plan gratuito; si falla una cuota, detener y usar el modo guiado.

Los registros con `mode: real` producidos dentro de las pruebas son artefactos de prueba en bases efímeras y nunca se cargan como evidencia real en la aplicación entregada.

## Corrección de Gemini y retiro de la integración externa

- Reproducido el error `Illegal invocation` con el archivo de proveedor original en **workerd 2026-10-12**. Causa: `fetch` nativo almacenado como método sin enlace al receptor global. Antes de la corrección falló sin salir a Google; después pasó el contrato con una respuesta interna de prueba. No se utilizó API key real.
- Contrato reproducible: `tests/runtime/workerd.capnp`, con servicio interno de respuesta. Ninguna solicitud externa. Con workerd instalado: `workerd serve tests/runtime/workerd.capnp`; abrir `http://127.0.0.1:8791/`. Resultado esperado: `ok: true`, `legacyRejected: true`, `realAI: false`.
- Distinción probada de error de transporte, JSON HTTP inválido, salida truncada y JSON generado inválido; no se almacenan textos brutos ni claves.
- Se retiraron workflows, interfaz, ejecutor y pruebas de la integración n8n cancelada por el propietario. Una prueba de seguridad verifica que todos los endpoints anteriores respondan 410 incluso con configuración y credenciales heredadas, sin crear tareas, llamar al proveedor ni modificar datos.
- Se conservan los diez casos ProCoop y los seis perfiles; regresión incluida en la suite completa.
- La publicación en GitHub no acredita inferencia ni compatibilidad de despliegue en Google AI Studio. Su entorno Node.js requiere adaptación para reemplazar los bindings Workers/D1; no fue realizada.
