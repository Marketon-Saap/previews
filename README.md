# Marketon · previews

Páginas de revisión y pruebas para clientes. Sin medición (sin GTM ni HubSpot), formularios que validan pero no envían, `noindex`. Una carpeta por cliente y versión.

| Cliente | Página | URL |
|---|---|---|
| APTO | Landing v2 · propuesta de relevancia para Ads (22-sep-2026) | https://marketon-previews.pages.dev/apto/landing-v2-propuesta/ (Cloudflare, Marketon-SaaP) · espejo: https://marketon-saap.github.io/previews/apto/landing-v2-propuesta/ |
| APTO | Landing con el chat de Jazz en modo prueba (Worker `apto-chat-api` con respuestas simuladas; formulario en revisión, no envía) (26-oct-2026) | https://marketon-previews.pages.dev/apto/jazz-chat-20261026/ · espejo: https://marketon-saap.github.io/previews/apto/jazz-chat-20261026/ |

| Transcargo (cliente de APTO) | Copia del sitio en staging con el asistente de IA en modo prueba (Worker `transcargo-chat-api`; formularios sin envío; imágenes desde el staging) (29-oct-2026) | https://marketon-previews.pages.dev/transcargo/chat-20261029/ · espejo: https://marketon-saap.github.io/previews/transcargo/chat-20261029/ |

## Cómo publicar

1. Generar la página en modo revisión dentro de una carpeta `<cliente>/<pagina>/`.
2. `git push` (GitHub Pages redepliega solo).
3. Cloudflare Pages en la cuenta Marketon-SaaP: `CLOUDFLARE_ACCOUNT_ID=8ac4c45cdb6e899556350e21e86f6053 npx wrangler pages deploy . --project-name marketon-previews --branch main`
