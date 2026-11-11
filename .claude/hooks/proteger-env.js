#!/usr/bin/env node
/**
 * Hook PreToolUse de La Nutria.
 * Bloquea cualquier acceso de Claude Code a archivos .env (leer, editar,
 * buscar o usarlos en comandos). Ahí viven MONGO_URI y CLAVE_CIFRADO.
 * Las plantillas sin secretos (.env.example, .env.sample, .env.template) sí se permiten.
 * Código de salida 2 = la herramienta no se ejecuta y Claude recibe el motivo.
 */
let entrada = '';
process.stdin.on('data', (c) => { entrada += c; });
process.stdin.on('end', () => {
  let datos;
  try { datos = JSON.parse(entrada || '{}'); } catch { process.exit(0); }

  const t = datos.tool_input || {};
  const candidatos = [t.file_path, t.path, t.notebook_path, t.glob, t.command];
  // En Glob el patrón es una ruta; en Grep el patrón es texto a buscar (no se revisa).
  if (datos.tool_name === 'Glob') candidatos.push(t.pattern);

  const patronEnv = /(^|[\\/\s'"=:<>|;&(`])\.env(?!\.(example|sample|template)\b)(\.[\w-]+)?(?=$|[\s'"/;|&)`<>*])/gi;
  // `process.env` e `import.meta.env` (también escapados en una regex: process\.env) son código, no archivos.
  const esCodigo = (texto, i) => /(process|meta)\\?$/i.test(texto.slice(Math.max(0, i - 8), i + 1));
  const tieneEnv = (texto) => [...texto.matchAll(patronEnv)].some((m) => !esCodigo(texto, m.index));
  const tocaEnv = candidatos.some((v) => typeof v === 'string' && tieneEnv(v));

  if (tocaEnv) {
    process.stderr.write(
      'Bloqueado por .claude/hooks/proteger-env.js: en La Nutria está prohibido abrir, ' +
      'modificar o mostrar archivos .env (credenciales de MongoDB Atlas y CLAVE_CIFRADO). ' +
      'Si hace falta un cambio ahí, explícale a la usuaria qué variable agregar y que lo haga ella.\n'
    );
    process.exit(2);
  }
  process.exit(0);
});
