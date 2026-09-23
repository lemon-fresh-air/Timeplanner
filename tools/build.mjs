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
  .replace('{{SCRIPT}}', script);

if (process.argv.includes('--verify')) {
  const original = await readFile('archive/timeplanner-41.html', 'utf8');
  if (output !== original) {
    throw new Error('Build differs from the archived original.');
  }
  console.log('Verified: dist output is identical to the archived original.');
} else {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/timeplanner.html', output);
  console.log('Built dist/timeplanner.html.');
}
