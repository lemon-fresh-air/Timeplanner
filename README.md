# Timeplanner

Оригінальний застосунок збережено без змін у `archive/timeplanner-41.html`. Редагована логіка та інтерфейс також лишаються ідентичними йому; PWA додає лише маніфест, іконки та офлайн-обгортку.

Для зручного редагування він розділений на:

- `src/template.html` — HTML-розмітка;
- `src/styles.css` — стилі;
- `src/app.js` — JavaScript.

## Команди

```bash
npm run build
npm run verify
```

`npm run build` створює готовий `index.html` у корені для GitHub Pages та PWA-іконки.
`npm run verify` підтверджує, що редагований код застосунку байт-в-байт відповідає архівній оригінальній версії.
