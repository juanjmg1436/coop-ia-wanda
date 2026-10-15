# COOP.IA 3.0 · ProCoop EDU

Prototipo educativo, independiente y no oficial. Caso de estudio: cooperativa de servicios públicos de Wanda, Misiones. Todos los registros de ejemplo son ficticios.

## Para usar ahora

Abrí **dist/index.html** con un navegador moderno. No necesita instalar nada ni conectarse a Internet para utilizar ProCoop, los seis perfiles, las dos demostraciones y los PDF. También se entrega una copia llamada **COOPIA_3_0.html**.

1. En **Oficina**, elegí Cobranzas o Reclamos.
2. Pulsá **Reproducir demostración**.
3. Mirá la secuencia en **Reunión**.
4. En **Informes**, revisá cifras y evidencia, descargá el PDF y registrá tu observación.

El modo guiado usa textos preparados y cálculos reales en JavaScript. No ejecuta modelos de IA. La consigna libre solamente se interpreta en modo IA real.

**Estado de esta entrega (3.0.2, 15/10/2026):** frontend y demostraciones funcionales; backend y adaptadores probados con dobles de proveedor. No se verificó inferencia auténtica. El propietario ya publicó su backend en Cloudflare; debe aplicar la actualización y verificar Gemini en su cuenta. La demo de este proyecto sirve archivos estáticos. n8n fue retirado. La guía simple está en `docs/Guia_Prueba.html`.

## Qué se conservó

La copia de `original/ProCoop_Wanda_Original.html` es idéntica al adjunto recibido `ProCoop_Wanda_Mejorado(2).html`, aunque el prompt nombraba la versión (1). No se tocó el sitio original de Netlify.

SHA-256 original: `0f4f0629129f86fe0e0dc59891fa9c87f2e3402536f38c1e238246757f3ffe54`.

Se mantienen socios, conexiones, lecturas, facturación individual y por lotes, rutas de lectura, caja y arqueos, recibos, historial por cuenta, reclamos, órdenes, trámites, convenios, notas de crédito, diez casos, impresión e importación/exportación JSON/CSV.

La nueva copia usa otra clave de almacenamiento local, vinculada a la sesión de la pestaña. No lee ni sobrescribe `procop_edu_coop_wanda_v2`. Dos sesiones iniciadas independientemente no comparten cambios. La persistencia del navegador no es una base multiusuario. Exportá un respaldo antes de cerrar la práctica o cambiar de equipo; podés importarlo con el módulo original de respaldos. Las pestañas duplicadas por el navegador pueden heredar su sesión: para otra práctica abrí una sesión nueva o una ventana privada.

## Arquitectura y archivos

| Ubicación | Responsabilidad |
|---|---|
| `original/` | Respaldo intacto del adjunto |
| `src/core.mjs` | Seis perfiles, validación, diez herramientas, fórmulas y recorridos guiados |
| `src/office.*` | Oficina, director, reunión, tareas, informes, proveedores y proyector |
| `src/pdf.mjs`, `src/fonts.mjs` | PDF autónomo con fuentes incrustadas; licencia en `docs/` |
| `worker/engine.mjs` | Coordinación real, selección de herramientas y transferencias |
| `worker/providers.mjs` | Gemini, respaldo Workers AI, consumo y límites |
| `worker/index.mjs`, `worker/store.mjs` | API, autenticación, cuotas atómicas y D1 |
| `worker/migrations/` | Esquema SQL inicial para D1 |
| `scripts/` | Compilación, servidor local, credencial de administrador e informes |
| `tests/` | Pruebas reproducibles de ProCoop, dominio, UI y servidor |
| `dist/` | HTML sin dependencias de red, cabeceras y dos PDF de muestra |
| `docs/PROVEEDORES.md` | Investigación oficial y decisión de proveedores |
| `docs/VALIDACION.md` | Pruebas realizadas y verificaciones pendientes |

El HTML final se genera agregando la extensión a ProCoop, sin reconstruir el ERP. `ProCoopBridge` expone una copia validada y funciones limitadas; no entrega el objeto mutable `db` a los agentes. El modelo no tiene acceso libre a la base, al navegador, a credenciales ni a herramientas de red.

## IA real: coordinación implementada

Cobranzas: director → Alex interpreta y elige circuito → Valentina selecciona herramientas → código consulta facturas y recibos → Mateo recibe esos resultados e interpreta → Sofía interviene si Alex la solicita → Alex consolida → revisión humana.

Reclamos: director → Alex → Camila elige la consulta → Nicolás recibe resultados y utiliza agrupación y órdenes → Sofía revisa → Alex consolida → revisión humana.

La coordinación es híbrida: el modelo interpreta la consigna, elige el circuito y las herramientas dentro de permisos y redacta análisis. El programa impone el orden seguro, calcula importes y construye tablas y borradores. No es una empresa autónoma ni una delegación irrestricta. Una tarea normal usa cuatro llamadas en cobranzas o cinco con calidad/reclamos; el límite absoluto es seis, incluidos intentos fallidos y respaldo.

Los registros de ejecución incluyen perfiles, herramientas, transferencias, proveedor, modelo y tokens. El servidor guarda una copia minimizada de los datos recibidos y su SHA-256 para contrastar la evidencia. Se omiten nombres, DNI, domicilios y teléfonos; descripciones de reclamos y barrios siguen siendo datos enviados. Usar exclusivamente ficción. No se comparten sesiones de visitantes ni datos reales de la cooperativa.

## Fórmulas

La base original contiene 18 socios, 37 facturas, 27 recibos y 4 reclamos. Corte de los PDF de muestra: 11/10/2026.

| Indicador | Base original |
|---|---:|
| Facturación neta | $501.200,00 |
| Cobros registrados | $363.650,00 |
| Saldo pendiente y vencido | $137.550,00 |
| Facturas con saldo | 10 |
| Morosidad por importe | 27,44 % |

Se opera con centavos enteros. `invoice.total` ya descuenta notas de crédito en ProCoop: no se vuelve a descontar. Facturación bruta = total actual + notas de crédito. Saldo por factura = máximo entre total actual − pagos y cero. Un exceso de pago se muestra como saldo a favor. Conciliación: bruto − notas de crédito − cobros = pendiente − saldo a favor.

Morosidad = saldo vencido / facturación neta × 100. Una factura está vencida si su vencimiento es anterior al corte. Cero facturación produce «No aplica». Los convenios son deuda; no son cobros. La evolución separa mes facturado, pagos imputados a esas facturas y mes efectivo del recibo. No se calculan ganancias ni se reconstruyen balances históricos anteriores a los movimientos disponibles.

Reclamos: coincidencias de barrio y fechas dentro de 48 horas. Alta prioridad si hay al menos dos registros coincidentes o alguno tiene siete días abierto. Es una regla educativa, no un protocolo de emergencias. Coincidencia no implica causa hidráulica común. En la base original hay tres reclamos de agua abiertos, tres grupos individuales y dos borradores; una orden existente evita duplicación. No se inventaron reclamos relacionados para mejorar la demostración.

## Servidor local (opcional)

Requiere Node.js 24 o posterior. El uso offline del HTML no necesita Node.

```bash
npm ci
npm run build
npm test
npm start
```

Abrí `http://localhost:8787`. El servidor escucha solo en tu equipo. SQLite simula la interfaz de D1. No consume IA sin configuración. Para uso local real, ejecutá `npm run admin`, guardá el código de acceso en tu gestor de contraseñas y agregá el hash y la clave de Gemini en `.dev.vars`, excluido de Git. No pegues esos valores en chats ni dentro del HTML.

## Publicación gratuita del modo guiado

Subí el contenido de `dist/` a un sitio nuevo de alojamiento estático (por ejemplo Netlify o Cloudflare Pages en plan gratuito). La carpeta ya contiene `index.html`. No reemplaces la aplicación original. Los visitantes reciben su propia copia local y no existe un endpoint de inferencia en esta publicación estática.

No requiere base de datos ni API. Los límites y condiciones del alojamiento siguen aplicándose. No activar upgrades, cuentas pagas ni recargas automáticas.

## Publicar el backend en Cloudflare Workers Free + D1

Estos pasos son para una instalación nueva en tu propia cuenta de Cloudflare. Si ya la publicaste, seguí `docs/Guia_Prueba.html` para actualizar; no crees otra base ni reemplaces tu configuración existente. El entorno de desarrollo no tiene acceso a los secretos ni a la cuenta de Cloudflare del propietario.

1. Elegí **Workers Free**; no habilites el plan pago. En Google AI Studio creá un proyecto **Free Tier sin cuenta de facturación vinculada**. Verificá cuota disponible para `gemini-2.5-flash-lite`.
2. Desde la carpeta del proyecto:

```bash
npm run build
npx wrangler@4 login
npx wrangler@4 d1 create coop-ia
```

3. Reemplazá `REEMPLAZAR_CON_ID_D1` en `wrangler.jsonc` por el ID devuelto. Luego:

```bash
npx wrangler@4 d1 migrations apply coop-ia --remote
npm run admin
npx wrangler@4 secret put ADMIN_TOKEN_HASH
npx wrangler@4 secret put GEMINI_API_KEY
```

`npm run admin` muestra un código de alta entropía y su hash. Guardá el código de acceso en privado; pegá solo el hash en el diálogo de `secret put ADMIN_TOKEN_HASH`. En el segundo diálogo pegá la clave creada en [Google AI Studio](https://aistudio.google.com/app/apikey). No se agregan a archivos fuente ni a Git.

4. Solo después de verificar que ambas cuentas permanecen gratuitas, configurá en `wrangler.jsonc`: `FREE_TIER_CONFIRMED: "true"` y `FREE_TIER_REVIEW_UNTIL` como fecha ISO futura, como máximo 31 días desde hoy. Esta confirmación vence; sin renovarla el modo real se detiene. No es una prueba automática del estado de facturación: Gemini no lo informa en sus respuestas de generación.
5. Publicá la nueva aplicación:

```bash
npx wrangler@4 deploy
```

El HTML y `/api/*` deben estar en el mismo origen. No se habilita CORS abierto. No uses el HTML de Netlify para llamar a un Worker de otro dominio sin una integración adicional revisada.

6. Abrí la URL nueva, ingresá con el código de administrador, elegí **Proveedores → Verificar conexión** y ejecutá cobranzas en **IA real**. Esta prueba consume una llamada. Confirmá los eventos de proveedor, transferencia y consumo. Exportá la evidencia JSON y el PDF. Ese es el paso pendiente para demostrar IA auténtica.

**Respaldo opcional:** en Workers Free agregá `"ai": {"binding":"AI"}` al objeto de `wrangler.jsonc` y volvé a desplegar. En el centro de proveedores autorizá Cloudflare como respaldo; usa `@cf/meta/llama-3.1-8b-instruct-fp8`. Sin binding o sin autorización no se invoca. Node local no emula Workers AI; Gemini sí puede usarse con su clave propia.

## Controles y límites

Actualización de diagnóstico (11/10/2026): `worker/providers.mjs` conserva la categoría del último error de proveedor y la fecha de fin de la pausa. Diferencia cuota cero, límite de solicitudes, credencial rechazada, permisos, modelo ausente, parámetros y fallas temporales. No guarda el texto bruto de Google ni claves. Un bloqueo creado por la versión anterior conserva su vencimiento y se identifica como «motivo original no registrado»; actualizar no reinicia cuotas ni libera bloqueos. Para actualizar una instalación existente basta reemplazar ese archivo y ejecutar `npx wrangler@4 deploy`; no necesita migraciones. Los límites efectivos del proyecto se consultan en Google AI Studio, sin habilitar facturación.

- Código de acceso aleatorio de 256 bits; el servidor conserva solo su hash. Sesiones de una hora, cookie HttpOnly, Secure en HTTPS y SameSite Strict. No hay API keys ni tokens de sesión en localStorage.
- Origen exacto y cabecera de solicitud en mutaciones, autenticación en todos los endpoints de inferencia/configuración/aprobación, validación de IDs y modelos, cinco intentos de ingreso por IP/minuto.
- Un análisis simultáneo, idempotencia por solicitud, cuotas atómicas compartidas por instancias y sesiones. Por defecto: 20 intentos diarios, 180.000 tokens reservados diarios, seis llamadas y 64.000 tokens reservados por tarea. Salida limitada a 1.024 tokens; contexto de usuario máximo 10.000 caracteres por llamada.
- Reserva conservadora basada en bytes de entrada más salida máxima; se mantiene incluso en errores. No es consumo exacto. Se muestran tokens de la API cuando existen; en su ausencia, estimación identificada. No se conoce automáticamente la cuota restante del proveedor.
- Un HTTP 429 abre el circuito del proveedor durante 24 horas. Errores de autenticación/modelo lo detienen 24 horas; otros errores, cinco minutos. Solo se intenta un respaldo autorizado, dentro de la cuota global; nunca se crean cuentas, recargas ni claves nuevas.
- La cancelación impide nuevos pasos. Una solicitud ya enviada puede terminar y contabilizarse. Si se interrumpe la conexión, no se reintenta automáticamente: revisá el centro de tareas.
- Se rechazan referencias de evidencia inexistentes y cifras numéricas en la narrativa del modelo; los importes se presentan en tablas determinísticas. La revisión humana sigue siendo necesaria para evaluar la calidad de las recomendaciones.
- Aprobar registra una revisión. No crea pagos, convenios, cortes, reparaciones ni cierres. Los borradores no se programan automáticamente en ProCoop.
- Tareas, evidencia y consumo se conservan siete días en el backend y se limpian al ingresar o iniciar una tarea. Exportá antes de ese plazo. El historial local muestra hasta diez tareas.

La aplicación no posee funciones para habilitar facturación ni contratar planes. El costo cero depende de mantener las cuentas en los niveles gratuitos indicados. No puede impedir que el propietario cambie el plan por fuera de COOP.IA. Si se agota una cuota, hay indisponibilidad o se vence la revisión, usar el modo guiado. Nunca cambiar de plan para completar una demostración.

## Guion de cinco minutos

| Tiempo | Recorrido y explicación |
|---|---|
| 0:00–0:45 | Oficina y seis perfiles. Aclarar que es una simulación educativa independiente. |
| 0:45–1:30 | Abrir cobranzas, leer la consigna y reproducir. Explicar el rótulo de modo guiado. |
| 1:30–2:30 | Sala de reuniones: herramientas, evidencia y transferencia Valentina → Mateo. Si hay IA configurada, mostrar los eventos reales de proveedor. |
| 2:30–4:00 | Informe: contrastar los tres importes centrales, abrir conciliación, descargar PDF y registrar revisión. |
| 4:00–5:00 | Reclamos: mostrar agrupaciones, prioridad sugerida y borradores. Recordar que una causa o reparación necesita comprobación humana. |

El botón **Modo presentación** abre este recorrido con letra ampliada. Escape permite salir.

## Actualización 3.0.2 y GitHub

Se retiraron la pantalla, los workflows y el ejecutor de n8n. Los antiguos endpoints `/api/automation/*` responden 410 y ningún acceso anterior puede iniciar tareas. Los seis perfiles siguen coordinados por el motor propio. La actualización no cambia D1, secretos ni cuotas; `scripts/retirar-integracion.mjs` conserva un respaldo local antes de retirar los archivos obsoletos de una instalación anterior.

Se conserva la corrección comprobada en workerd: `fetch` nativo se invoca con su receptor global. El contrato pasó con un servicio interno controlado; no acredita conexión real a Gemini. La suite actual pasó 30 pruebas (`npm test`). El diagnóstico diferencia transporte, JSON HTTP inválido, salida truncada y JSON del modelo inválido.

El código se puede subir a un repositorio propio sin `.dev.vars`, `.env`, bases SQLite, `node_modules`, respaldos, credenciales ni metadatos del alojamiento. `.env.example` y `wrangler.jsonc` contienen solamente una plantilla sin secretos. El historial del repositorio de destino debe comenzar con esta copia limpia, sin importar historiales de otras integraciones.

### Google AI Studio

La [documentación oficial](https://ai.google.dev/gemini-api/docs/aistudio-build-mode), consultada el 15/10/2026, permite importar código desde **Build → + → Import from GitHub** y sincronizar cambios desde **Settings → GitHub**. Las claves del entorno AI Studio se administran como secretos del servidor.

Este proyecto usa **Cloudflare Workers + D1**. Importarlo a AI Studio permite trabajar con el código, pero no migra el backend a su entorno Node.js ni conecta la base D1 por sí solo. Esa adaptación no se incluye ni se considera probada. Para utilizar Gemini en la aplicación de Cloudflare existente, basta la clave propia de AI Studio guardada como `GEMINI_API_KEY` con `npx wrangler@4 secret put GEMINI_API_KEY`, junto con la configuración de administrador y del plan gratuito. Si el secreto ya existe, no hace falta volver a cargarlo.

No poner claves en el frontend ni en GitHub. No activar Cloud Run ni vincular facturación para este proyecto de presupuesto cero. Los límites gratuitos y las comprobaciones del proveedor siguen vigentes.
