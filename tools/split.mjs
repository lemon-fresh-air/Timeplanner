import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = await readFile('archive/timeplanner-41.html', 'utf8');
const styles = source.match(/<style>([\s\S]*?)<\/style>/);
const scripts = source.match(/<script>([\s\S]*?)<\/script>/);

if (!styles || !scripts) {
  throw new Error('Expected one inline <style> and one inline <script> block.');
}

const template = source
  .replace(styles[0], '<style>{{STYLES}}</style>')
  .replace(scripts[0], '<script>{{SCRIPT}}</script>');

await mkdir('src', { recursive: true });
await Promise.all([
  writeFile('src/template.html', template),
  writeFile('src/styles.css', styles[1]),
  writeFile('src/app.js', scripts[1]),
]);

console.log('Created editable source files in src/.');
