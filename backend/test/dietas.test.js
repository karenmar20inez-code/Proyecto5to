const test = require('node:test');
const assert = require('node:assert/strict');
const Dieta = require('../src/Models/Dieta');
const DIETAS_BASE = require('../src/data/dietas-base.json');
const { claveDesdeNombre } = require('../src/Controllers/dietaController');

const valida = () => ({
  clave: 'dieta-prueba', nombre: 'Dieta de prueba', inicio: '2026-11-09', fin: '2026-11-10',
  dias: [
    { dia: 'Lunes', fecha: '2026-11-09', comidas: [{ tiempo: 'Desayuno', platillo: 'Avena', ingredientes: [{ alimento: 'Avena', cantidad: '½ taza' }] }] },
    { dia: 'Martes', fecha: '2026-11-10', comidas: [] },
  ],
});

test('Dieta: una dieta completa es válida', () => {
  assert.equal(new Dieta(valida()).validateSync(), undefined);
});

test('Dieta: exige nombre, fechas y al menos un día', () => {
  const error = new Dieta({ clave: 'x-1', dias: [] }).validateSync();
  assert.ok(error.errors.nombre);
  assert.ok(error.errors.inicio);
  assert.ok(error.errors.fin);
  assert.ok(error.errors.dias);
});

test('Dieta: el fin no puede ser anterior al inicio', () => {
  const error = new Dieta({ ...valida(), fin: '2026-11-01' }).validateSync();
  assert.match(error.errors.fin.message, /anterior al inicio/);
});

test('Dieta: rechaza fechas mal formadas e ingredientes sin alimento', () => {
  const datos = valida();
  datos.dias[0].fecha = '09/11/2026';
  datos.dias[0].comidas[0].ingredientes.push({ alimento: '', cantidad: '1 pieza' });
  const error = new Dieta(datos).validateSync();
  assert.ok(error.errors['dias.0.fecha']);
  assert.ok(error.errors['dias.0.comidas.0.ingredientes.1.alimento']);
});

test('Dieta: no permite más de 14 días', () => {
  const datos = valida();
  datos.dias = Array.from({ length: 15 }, (_, n) => ({ dia: 'Día', fecha: '2026-11-09', comidas: [] }));
  assert.ok(new Dieta(datos).validateSync().errors.dias);
});

test('claveDesdeNombre: genera claves estables sin acentos ni espacios', () => {
  assert.equal(claveDesdeNombre('Dieta semana 3'), 'dieta-semana-3');
  assert.equal(claveDesdeNombre('  Menú Diabético (Ñandú)  '), 'menu-diabetico-nandu');
  assert.equal(claveDesdeNombre('!!!'), 'dieta');
});

test('Catálogo inicial: la dieta "semana-2" migrada del frontend es válida y completa', () => {
  assert.equal(DIETAS_BASE.length, 1);
  const base = DIETAS_BASE[0];
  assert.equal(base.clave, 'semana-2');
  assert.equal(new Dieta(base).validateSync(), undefined);
  assert.equal(base.dias.length, 7);
  assert.equal(base.dias.reduce((t, d) => t + d.comidas.length, 0), 27);
  assert.equal(base.dias.reduce((t, d) => t + d.comidas.reduce((u, c) => u + c.ingredientes.length, 0), 0), 111);
});
