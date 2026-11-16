/**
 * Pruebas de integración HTTP que NO requieren base de datos:
 * autenticación, autorización, validaciones de entrada, códigos HTTP,
 * cabeceras de seguridad y el endpoint de cálculo.
 * La verificación de sesión se sustituye por un doble de prueba.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

process.env.CLAVE_CIFRADO = crypto.randomBytes(32).toString('base64');
mongoose.set('bufferCommands', false);

const sesiones = require('../src/Services/seguridad/sesiones');
const USUARIOS = {
  'token-admin': { _id: new mongoose.Types.ObjectId(), nombre: 'Superusuario Pruebas', rol: 'superusuario' },
  'token-nutri': { _id: new mongoose.Types.ObjectId(), nombre: 'Nutri Pruebas', rol: 'nutriologo' },
  'token-asist': { _id: new mongoose.Types.ObjectId(), nombre: 'Asist Pruebas', rol: 'asistente' },
};
sesiones.verificarSesion = async (t) => (USUARIOS[t] ? { usuario: USUARIOS[t], sesion: {} } : null);

const app = require('../src/app');

let servidor;
let base;
const ID = '64b7f0c2a1b2c3d4e5f60718'; // ObjectId válido inexistente

test.before(async () => {
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => servidor.close());

async function pedir(metodo, ruta, cuerpo, { crudo, token = 'token-admin', origen } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(origen && { Origin: origen }),
    },
    body: metodo === 'GET' ? undefined : crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* texto plano */ }
  return { status: r.status, json, texto, headers: r.headers };
}

test('GET / responde y envía cabeceras de seguridad', async () => {
  const r = await pedir('GET', '/', null, { token: null });
  assert.equal(r.status, 200);
  assert.match(r.texto, /La Nutria/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('Sin sesión o con token inválido → 401', async () => {
  assert.equal((await pedir('GET', '/api/pacientes', null, { token: null })).status, 401);
  assert.equal((await pedir('GET', '/api/pacientes', null, { token: 'falso' })).status, 401);
  assert.equal((await pedir('GET', '/api/calculos/formulas', null, { token: null })).status, 401);
});

test('Login sin datos → 400 (no consulta la base)', async () => {
  assert.equal((await pedir('POST', '/api/auth/login', {}, { token: null })).status, 400);
});

test('La API no tiene caché y CORS solo para orígenes permitidos', async () => {
  const ok = await pedir('GET', '/api/calculos/formulas', null, { origen: 'http://localhost:3000' });
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  const ajeno = await pedir('GET', '/api/calculos/formulas', null, { origen: 'https://sitio-ajeno.example' });
  assert.equal(ajeno.headers.get('access-control-allow-origin'), null);
});

test('Autorización por rol → 403', async () => {
  assert.equal((await pedir('GET', '/api/auditoria', null, { token: 'token-nutri' })).status, 403);
  assert.equal((await pedir('POST', '/api/usuarios', {}, { token: 'token-nutri' })).status, 403);
  assert.equal((await pedir('DELETE', `/api/pacientes/${ID}`, null, { token: 'token-nutri' })).status, 403);
  assert.equal((await pedir('PUT', '/api/alertas/reglas/xyz', {}, { token: 'token-nutri' })).status, 403);
  // el asistente no accede a información clínica
  assert.equal((await pedir('GET', `/api/pacientes/${ID}/expediente`, null, { token: 'token-asist' })).status, 403);
  assert.equal((await pedir('GET', `/api/pacientes/${ID}/mediciones`, null, { token: 'token-asist' })).status, 403);
  assert.equal((await pedir('GET', '/api/estadisticas/resumen', null, { token: 'token-asist' })).status, 403);
});

test('GET /api/calculos/formulas expone versión y referencias', async () => {
  const r = await pedir('GET', '/api/calculos/formulas');
  assert.equal(r.status, 200);
  assert.equal(r.json.version, '1.0.0');
  assert.ok(r.json.referencias.tmrMifflinStJeor);
});

test('POST /api/calculos/evaluar calcula sin guardar', async () => {
  const r = await pedir('POST', '/api/calculos/evaluar', {
    paciente: { edad: 30, sexo: 'Masculino', estatura: 175 },
    medicion: { pesoKg: 70 },
    prescripcion: { factorActividad: 1.55 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.resultados.imc.valor, 22.9);
  assert.equal(r.json.resultados.tmr.valor, 1649);
  assert.equal(r.json.resultados.get.valor, 2556);
});

test('IDs mal formados → 400', async () => {
  for (const [m, ruta] of [
    ['GET', '/api/pacientes/123/mediciones'],
    ['GET', '/api/pacientes/abc/expediente'],
    ['GET', '/api/pacientes/abc/linea-tiempo'],
    ['POST', '/api/pacientes/abc/consultas'],
    ['GET', '/api/mediciones/xyz/versiones'],
    ['POST', '/api/evaluaciones/xyz/ajustes'],
    ['PUT', '/api/citas/xyz'],
    ['GET', '/api/consultas/xyz'],
    ['PUT', '/api/antecedentes/xyz'],
    ['PUT', '/api/alertas/xyz'],
  ]) {
    const r = await pedir(m, ruta, {});
    assert.equal(r.status, 400, `${m} ${ruta}`);
  }
});

test('Corregir o anular una medición exige motivo → 400', async () => {
  assert.equal((await pedir('PUT', `/api/mediciones/${ID}`, { pesoKg: 70 })).status, 400);
  const r = await pedir('DELETE', `/api/mediciones/${ID}`, {});
  assert.equal(r.status, 400);
  assert.ok(r.json.errores.motivo);
});

test('Filtros inválidos → 400', async () => {
  assert.equal((await pedir('GET', '/api/citas?estado=perdida')).status, 400);
  assert.equal((await pedir('GET', '/api/estadisticas/resumen?anio=1500')).status, 400);
  assert.equal((await pedir('GET', '/api/auditoria?pacienteId=nope')).status, 400);
});

test('Ruta inexistente → 404; JSON roto → 400; cuerpo enorme → 413', async () => {
  assert.equal((await pedir('GET', '/api/no-existe')).status, 404);
  assert.equal((await pedir('POST', '/api/calculos/evaluar', null, { crudo: '{roto' })).status, 400);
  const grande = JSON.stringify({ x: 'a'.repeat(300 * 1024) });
  assert.equal((await pedir('POST', '/api/calculos/evaluar', null, { crudo: grande })).status, 413);
});

test('Sin base de datos la API responde 500 controlado (sin filtrar detalles)', async () => {
  const r = await pedir('GET', `/api/pacientes/${ID}/mediciones`);
  assert.equal(r.status, 500);
  assert.deepEqual(r.json, { mensaje: 'Error interno del servidor' });
});
