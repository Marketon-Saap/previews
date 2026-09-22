# Marketon · previews

Páginas de revisión y pruebas para clientes. Sin medición (sin GTM ni HubSpot), formularios que validan pero no envían, `noindex`. Una carpeta por cliente y versión.

| Cliente | Página | URL |
|---|---|---|
| APTO | Landing v2 · propuesta de relevancia para Ads (22-sep-2026) | https://marketon-previews.pages.dev/apto/landing-v2-propuesta/ (Cloudflare, Marketon-SaaP) · espejo: https://marketon-saap.github.io/previews/apto/landing-v2-propuesta/ |

## Cómo publicar

1. Generar la página en modo revisión dentro de una carpeta `<cliente>/<pagina>/`.
2. `git push` (GitHub Pages redepliega solo).
3. Cloudflare Pages en la cuenta Marketon-SaaP: `CLOUDFLARE_ACCOUNT_ID=8ac4c45cdb6e899556350e21e86f6053 npx wrangler pages deploy . --project-name marketon-previews --branch main`
