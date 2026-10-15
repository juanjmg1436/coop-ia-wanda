# Investigación de proveedores · 11/10/2026

Se consultaron mediante el conector GitHub los README de [free-llm-listing](https://github.com/richbrianx/free-llm-listing) y [awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis). Se usaron como directorios, no como garantía. Algunas afirmaciones de los directorios ya difieren de la documentación oficial, especialmente Cerebras y modelos retirados de Cloudflare.

## Comparación

| Proveedor | Gratuidad, tarjeta y Argentina | Modelos, cuotas y compatibilidad | Datos, limitaciones y decisión |
|---|---|---|---|
| Gemini API | Las cuentas nuevas comienzan en Free Tier; pasar a pago requiere vincular facturación. Argentina figura entre las regiones admitidas. | `gemini-2.5-flash-lite` ofrece entrada/salida gratuita en modalidad estándar. JSON estructurado y API REST aptos para Workers. RPM/TPM/RPD efectivos se consultan en AI Studio; no se toman cifras del directorio como garantías. | El nivel gratuito puede usar contenido para mejorar productos: solo ficción. Principal integrado, sin grounding, herramientas de pago, búsqueda ni caché facturada. Requiere clave propia y proyecto sin facturación. |
| Cloudflare Workers AI | 10.000 neuronas diarias sin costo en Workers Free. Superar requiere un plan pago; en Free las operaciones fallan al agotar la asignación. No se solicita activar pagos en esta solución. No se verificó una lista oficial específica de elegibilidad de cuentas de Argentina; el alta y conexión local siguen pendientes. | Modelo del catálogo `@cf/meta/llama-3.1-8b-instruct-fp8`, contexto publicado de 32.000 tokens y parámetro `response_format`. El nombre sin `-fp8` redirige a «no disponible» y se descartó. Binding nativo de Worker; tokens/neuronas dependen del modelo, no equivalen a llamadas ilimitadas. | La documentación indica que no usa el contenido para entrenar sin consentimiento. Respaldo opcional implementado, desactivado por defecto; sujeto a licencia del modelo y disponibilidad. Falta prueba con binding real. |
| GroqCloud | Existe Free tier. Su página de facturación exige un medio de pago para subir a Developer. No se completó alta ni verificación regional de Argentina. | La tabla consultada incluye `openai/gpt-oss-20b`, `openai/gpt-oss-120b` y `qwen/qwen3.8-27b`; muestra 30 RPM, 1.000 RPD, 8.000 TPM y 200.000 TPD para esos modelos. Puede haber excepciones por organización; se deben verificar límites de la cuenta. API compatible con OpenAI, herramientas y salidas estructuradas según modelo. | No retiene solicitudes de inferencia por defecto; puede conservarlas temporalmente por fiabilidad/abuso. No integrado: no añade una necesidad a esta primera versión. |
| OpenRouter | Existen variantes `:free`; no cualquier modelo acepta ese sufijo. No se requieren créditos para esas variantes, pero no se verificó un alta desde Argentina ni una cuota exacta de cuenta. | Catálogo y disponibilidad variables. La documentación de límites remite al contador `free_model_daily_requests` de la clave. No se presenta el «50 RPD» del directorio como cuota confirmada de esta cuenta. Compatibilidad JSON/herramientas depende del modelo y endpoint. | Las políticas también dependen del proveedor subyacente. No integrado: evita una tercera cuenta, rutas heterogéneas y dependencia de disponibilidad variable. |
| Cerebras Cloud | La documentación oficial actual afirma que NO hay un nivel permanentemente gratuito: prueba de USD 5 por 30 días y medio de pago verificado. | API y límites por modelo; acceso de prueba se detiene al agotarse créditos. No se analizó como alternativa operativa porque incumple el presupuesto continuado sin tarjeta. | Descartado. No se implementó adaptador ni se configuró cuenta. |

No se presupone estabilidad ni disponibilidad ilimitada en ninguno. La aplicación adopta solo Gemini y Workers AI; un único proveedor autorizado basta. Los mecanismos de cuotas internas no sustituyen los límites o términos de los proveedores. Las declaraciones de gratuidad de cuentas se revisan periódicamente y no activan facturación.

## Capas de costo separadas

| Capa | Solución y límite |
|---|---|
| Código de aplicación | HTML/JS propio, sin licencias comerciales obligatorias ni librerías runtime desde CDN. Fuente DejaVu redistribuida con licencia. JSDOM solo para pruebas. |
| Hosting estático | HTML descargable sin costo operativo. Publicación de demostración independiente. Para alojamiento propio, usar un nivel gratuito verificado y no contratar extras. |
| Backend | Workers Free: 100.000 solicitudes diarias, 10 ms de CPU por invocación. La espera de red no equivale a CPU. Se debe medir el Worker publicado con la base usada en la exposición; esa medición quedó pendiente. |
| Base D1 | Free: 5 millones de filas leídas/día, 100.000 escritas/día y 5 GB totales, además de límites técnicos por base. El historial se limpia a los siete días. |
| Inferencia | Gemini Free Tier sujeto a cuota de la cuenta; Workers AI Free sujeto a 10.000 neuronas/día. No son créditos promocionales temporales. |
| Control interno | 20 intentos/día, seis por tarea y reservas conservadoras de tokens; valores inferiores a los límites máximos configurables. Al fallar la inferencia se ofrece el modo guiado explícito. |

La cuota de CPU de Workers Free puede detener tareas que excedan su presupuesto. No hay prueba pública con inferencia ni medición de CPU real en esta entrega. Ante un límite, se reduce la base de demostración o se utiliza el servidor local; no se habilita un plan pago.

## Fuentes oficiales consultadas

- [Gemini: precios y modelos](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini: facturación y Free Tier](https://ai.google.dev/gemini-api/docs/billing)
- [Gemini: Argentina y regiones](https://ai.google.dev/gemini-api/docs/available-regions)
- [Gemini: salidas estructuradas](https://ai.google.dev/gemini-api/docs/structured-output)
- [Cloudflare Workers AI: precio y corte al superar la asignación](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare: modelo Llama FP8 y parámetros](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/)
- [Cloudflare: modo JSON y sus límites](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [Cloudflare: tratamiento de datos](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
- [Workers: precios](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1: precios](https://developers.cloudflare.com/d1/platform/pricing/)
- [Groq: límites](https://console.groq.com/docs/rate-limits)
- [Groq: facturación](https://console.groq.com/docs/billing-faqs)
- [Groq: datos](https://console.groq.com/docs/your-data)
- [OpenRouter: variantes gratuitas](https://openrouter.ai/docs/guides/routing/model-variants/free)
- [OpenRouter: límites](https://openrouter.ai/docs/api-reference/limits)
- [Cerebras: situación del nivel gratuito](https://inference-docs.cerebras.ai/support/rate-limits)

La página directa de límites de Gemini devolvió un error de recuperación; se verificó en la página oficial de facturación que las cuotas efectivas se consultan en AI Studio. No se inventaron límites alternativos.
