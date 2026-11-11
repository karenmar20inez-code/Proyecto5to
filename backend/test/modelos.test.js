/* Validación de esquemas Mongoose (no requiere conexión a la base de datos) */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Medicion = require('../src/Models/Medicion');
const Prescripcion = require('../src/Models/Prescripcion');
const Cita = require('../src/Models/Cita');
const Adherencia = require('../src/Models/Adherencia');

const id = () => new mongoose.Types.ObjectId();
const base = () => ({ pacienteId: id(), grupoId: id(), responsable: 'pruebas', fecha: new Date('2026-02-01') });

async function errores(doc) {
  try {
    await doc.validate();
    return {};
  } catch (e) {
    return e.errors;
  }
}

test('Medición sin ningún valor es inválida', async () => {
  const e = await errores(new Medicion(base()));
  assert.ok(e.valores);
});

test('Medición con un valor es válida y versión 1 vigente por omisión', async () => {
  const m = new Medicion({ ...base(), pesoKg: 70 });
  assert.deepEqual(await errores(m), {});
  assert.equal(m.version, 1);
  assert.equal(m.vigente, true);
});

test('Medición con fecha futura o fuera de rango es inválida', async () => {
  const futura = await errores(new Medicion({ ...base(), fecha: new Date(Date.now() + 5 * 86400000), pesoKg: 70 }));
  assert.ok(futura.fecha);
  const rango = await errores(new Medicion({ ...base(), pesoKg: 900 }));
  assert.ok(rango.pesoKg);
});

test('Medición rechaza métodos no catalogados', async () => {
  const e = await errores(new Medicion({ ...base(), pesoKg: 70, metodos: { peso: 'a-ojo' } }));
  assert.ok(e['metodos.peso']);
});

test('Prescripción: macros deben ser los tres y sumar 100', async () => {
  const p = { pacienteId: id(), responsable: 'x', fechaInicio: new Date() };
  assert.ok((await errores(new Prescripcion({ ...p, proteinasPct: 20 }))).macronutrientes);
  assert.ok((await errores(new Prescripcion({ ...p, proteinasPct: 20, carbohidratosPct: 50, grasasPct: 20 }))).macronutrientes);
  assert.deepEqual(await errores(new Prescripcion({ ...p, proteinasPct: 20, carbohidratosPct: 50, grasasPct: 30 })), {});
  assert.deepEqual(await errores(new Prescripcion({ ...p, pesoObjetivoKg: 70 })), {});
});

test('Cita: estado por omisión "programada" y rechaza estados desconocidos', async () => {
  const c = new Cita({ pacienteId: id(), responsable: 'x', fechaHora: new Date() });
  assert.equal(c.estado, 'programada');
  assert.ok((await errores(new Cita({ pacienteId: id(), responsable: 'x', fechaHora: new Date(), estado: 'perdida' }))).estado);
});

test('Adherencia: fecha AAAA-MM-DD y estado nulo permitido', async () => {
  const b = { pacienteId: id(), dietaId: 'semana-2', tiempo: 'Cena' };
  assert.ok((await errores(new Adherencia({ ...b, fecha: '2/11/2026' }))).fecha);
  assert.deepEqual(await errores(new Adherencia({ ...b, fecha: '2026-11-02', estado: null })), {});
  assert.ok((await errores(new Adherencia({ ...b, fecha: '2026-11-02', estado: 'quizas' }))).estado);
});
