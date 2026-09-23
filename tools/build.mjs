import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [template, styles, script] = await Promise.all([
  readFile('src/template.html', 'utf8'),
  readFile('src/styles.css', 'utf8'),
  readFile('src/app.js', 'utf8'),
]);

if (!template.includes('{{STYLES}}') || !template.includes('{{SCRIPT}}')) {
  throw new Error('Template placeholders are missing. Run npm run split to restore them.');
}

const output = template
  .replace('{{STYLES}}', styles)
  .replace('{{SCRIPT}}', script)
  .replace('{{PWA_HEAD}}', `
<link rel="manifest" href="./manifest.webmanifest">
<meta name="theme-color" content="#F2F1ED">
<link rel="icon" href="./icons/icon-192.png" sizes="192x192" type="image/png">`)
  .replace('{{PWA_SW_REGISTRATION}}', `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
</script>
`);

if (process.argv.includes('--verify')) {
  const original = await readFile('archive/timeplanner-41.html', 'utf8');
  const reconstructedOriginal = template
    .replace('{{STYLES}}', styles)
    .replace('{{SCRIPT}}', script)
    .replace('{{PWA_HEAD}}', '')
    .replace('{{PWA_SW_REGISTRATION}}', '');
  if (reconstructedOriginal !== original) {
    throw new Error('The editable app source differs from the archived original.');
  }
  console.log('Verified: the editable app source is identical to the archived original.');
} else {
  await writeFile('index.html', output);
  console.log('Built index.html for GitHub Pages.');
}
