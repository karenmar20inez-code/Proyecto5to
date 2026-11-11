#!/usr/bin/env node
/**
 * Hook PostToolUse de La Nutria.
 * Después de que Claude edita un .js del backend, ejecuta `node --check`
 * (solo revisa sintaxis, no ejecuta el archivo ni se conecta a MongoDB).
 * Si hay un error de sintaxis, sale con código 2 para que Claude lo corrija.
 */
const { spawnSync } = require('child_process');

let entrada = '';
process.stdin.on('data', (c) => { entrada += c; });
process.stdin.on('end', () => {
  let datos;
  try { datos = JSON.parse(entrada || '{}'); } catch { process.exit(0); }

  const ruta = (datos.tool_input && datos.tool_input.file_path) || '';
  const normal = ruta.replace(/\\/g, '/');
  const esBackendJs = /\/backend\//.test(normal) && /\.(c?js)$/.test(normal) && !/\/node_modules\//.test(normal);
  if (!esBackendJs) process.exit(0);

  const r = spawnSync(process.execPath, ['--check', ruta], { encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`Error de sintaxis en ${ruta}:\n${(r.stderr || '').trim()}\n`);
    process.exit(2);
  }
  process.exit(0);
});
