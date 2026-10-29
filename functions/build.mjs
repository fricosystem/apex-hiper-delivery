// Empacota as Functions com o código de @hiper/shared embutido. O deploy só
// envia functions/dist, então ele precisa de um package.json próprio, sem as
// dependências de workspace que o npm do Cloud Build não entende.
import { build } from 'esbuild';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const runtimeDeps = Object.keys(pkg.dependencies);

await rm('dist', { recursive: true, force: true });
await mkdir('dist');

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // firebase-admin e firebase-functions ficam de fora: o Cloud Build instala.
  external: runtimeDeps,
  logLevel: 'info',
});

await writeFile(
  'dist/package.json',
  JSON.stringify(
    {
      name: 'hiper-delivery-functions',
      private: true,
      type: 'module',
      main: 'index.js',
      engines: { node: '22' },
      dependencies: pkg.dependencies,
    },
    null,
    2,
  ) + '\n',
);

// O emulador procura o firebase-functions dentro da pasta de origem (dist).
// O deploy ignora node_modules, então o link só vale para rodar local.
await symlink('../node_modules', 'dist/node_modules', 'dir');
