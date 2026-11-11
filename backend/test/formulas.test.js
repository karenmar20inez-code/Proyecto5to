/* Pruebas unitarias del motor de fórmulas · ejecutar con: npm test (backend) */
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/Services/nutricion/formulas');
const { evaluarMedicion, resultadosConAjustes } = require('../src/Services/nutricion/evaluacion');

test('IMC: 70 kg / 1.75 m² = 22.9 kg/m²', () => {
  const r = F.imc({ pesoKg: 70, estaturaCm: 175 });
  assert.equal(r.valor, 22.9);
  assert.equal(r.unidad, 'kg/m²');
  assert.equal(r.tipo, 'calculado');
  assert.deepEqual(r.faltantes, []);
});

test('IMC: acepta números en texto y advierte en menores de 18', () => {
  const r = F.imc({ pesoKg: '50', estaturaCm: '160', edad: 15 });
  assert.equal(r.valor, 19.5);
  assert.equal(r.advertencias.length, 1);
});

test('IMC: dato faltante → null, sin inventar', () => {
  const r = F.imc({ pesoKg: 70 });
  assert.equal(r.valor, null);
  assert.deepEqual(r.faltantes, ['estaturaCm']);
});

test('IMC: valores fuera de rango o no numéricos lanzan ErrorValidacion', () => {
  assert.throws(() => F.imc({ pesoKg: 0, estaturaCm: 170 }), F.ErrorValidacion);
  assert.throws(() => F.imc({ pesoKg: 'abc', estaturaCm: 170 }), F.ErrorValidacion);
  assert.throws(() => F.imc({ pesoKg: 70, estaturaCm: 900 }), F.ErrorValidacion);
});

test('Categoría OMS de referencia', () => {
  assert.equal(F.categoriaImcOMS(17), 'Bajo peso');
  assert.equal(F.categoriaImcOMS(24.9), 'Normal');
  assert.equal(F.categoriaImcOMS(25), 'Sobrepeso');
  assert.equal(F.categoriaImcOMS(41), 'Obesidad grado III');
  assert.equal(F.categoriaImcOMS(null), null);
});

test('Mifflin-St Jeor: hombre 70 kg, 175 cm, 30 años = 1649 kcal', () => {
  const r = F.tmrMifflinStJeor({ pesoKg: 70, estaturaCm: 175, edad: 30, sexo: 'Masculino' });
  assert.equal(r.valor, 1649);
  assert.equal(r.tipo, 'estimado');
});

test('Mifflin-St Jeor: mujer 60 kg, 165 cm, 25 años = 1345 kcal', () => {
  assert.equal(F.tmrMifflinStJeor({ pesoKg: 60, estaturaCm: 165, edad: 25, sexo: 'Femenino' }).valor, 1345);
});

test('Mifflin-St Jeor: sexo "Otro" no elige ecuación automáticamente', () => {
  const r = F.tmrMifflinStJeor({ pesoKg: 60, estaturaCm: 165, edad: 25, sexo: 'Otro' });
  assert.equal(r.valor, null);
  assert.ok(r.faltantes.includes('sexo'));
  assert.equal(r.advertencias.length, 1);
});

test('GET = TMR × factor (1649 × 1.55 = 2556)', () => {
  const r = F.gastoEnergeticoTotal({ tmrKcal: 1649, factorActividad: 1.55 });
  assert.equal(r.valor, 2556);
  assert.equal(r.tipo, 'estimado');
  assert.throws(() => F.gastoEnergeticoTotal({ tmrKcal: 1649, factorActividad: 4 }), F.ErrorValidacion);
});

test('GET sin factor prescrito → faltante', () => {
  assert.deepEqual(F.gastoEnergeticoTotal({ tmrKcal: 1649 }).faltantes, ['factorActividad']);
});

test('Balance energético: 2000 − 2556 = −556 kcal (déficit)', () => {
  assert.equal(F.balanceEnergetico({ consumoKcal: 2000, gastoKcal: 2556 }).valor, -556);
});

test('Cambio de peso: 80 → 76 kg = −5 %', () => {
  assert.equal(F.cambioPesoPorcentual({ pesoInicialKg: 80, pesoActualKg: 76 }).valor, -5);
});

test('Relación cintura-cadera 80/100 = 0.8 y cintura-estatura 85/170 = 0.5', () => {
  assert.equal(F.relacionCinturaCadera({ cinturaCm: 80, caderaCm: 100 }).valor, 0.8);
  assert.equal(F.relacionCinturaEstatura({ cinturaCm: 85, estaturaCm: 170 }).valor, 0.5);
});

test('Composición corporal: 80 kg con 25 % grasa → 20 kg MG y 60 kg MLG', () => {
  const r = F.composicionCorporal({ pesoKg: 80, grasaPorcentaje: 25 });
  assert.deepEqual(r.valor, { masaGrasaKg: 20, masaLibreGrasaKg: 60 });
});

test('Macronutrientes 2000 kcal 20/50/30 → 100 g P, 250 g HC, 66.7 g L', () => {
  const r = F.distribucionMacronutrientes({ kcal: 2000, proteinasPct: 20, carbohidratosPct: 50, grasasPct: 30 });
  assert.equal(r.valor.proteinas.gramos, 100);
  assert.equal(r.valor.carbohidratos.gramos, 250);
  assert.equal(r.valor.grasas.gramos, 66.7);
  assert.equal(r.valor.grasas.kcal, 600);
});

test('Macronutrientes: porcentajes que no suman 100 lanzan error', () => {
  assert.throws(
    () => F.distribucionMacronutrientes({ kcal: 2000, proteinasPct: 20, carbohidratosPct: 40, grasasPct: 30 }),
    F.ErrorValidacion
  );
});

test('Requerimiento proteico 70 kg × 1.2 g/kg = 84 g; advierte > 2.2 g/kg', () => {
  assert.equal(F.requerimientoProteico({ pesoKg: 70, gramosPorKg: 1.2 }).valor, 84);
  assert.equal(F.requerimientoProteico({ pesoKg: 70, gramosPorKg: 2.5 }).advertencias.length, 1);
});

test('Hidratación orientativa 70 kg × 35 ml/kg = 2450 ml (estimado)', () => {
  const r = F.hidratacionEstimada({ pesoKg: 70 });
  assert.equal(r.valor, 2450);
  assert.equal(r.tipo, 'estimado');
});

test('Progreso hacia objetivo: pérdida y ganancia de peso', () => {
  assert.equal(F.progresoHaciaObjetivo({ valorInicial: 80, valorActual: 76, valorObjetivo: 70 }).valor, 40);
  assert.equal(F.progresoHaciaObjetivo({ valorInicial: 50, valorActual: 52, valorObjetivo: 55 }).valor, 40);
  assert.equal(F.progresoHaciaObjetivo({ valorInicial: 70, valorActual: 70, valorObjetivo: 70 }).valor, null);
});

test('Cumplimiento de objetivos: promedio acotado a 0–100', () => {
  const r = F.cumplimientoObjetivos([
    { nombre: 'peso', valorInicial: 80, valorActual: 76, valorObjetivo: 70 },     // 40
    { nombre: 'cintura', valorInicial: 100, valorActual: 88, valorObjetivo: 90 }, // 120 → 100
    { nombre: 'grasa', valorInicial: 30, valorActual: 31, valorObjetivo: 20 },    // −10 → 0
  ]);
  assert.equal(r.valor.porcentaje, 46.7);
});

test('Adherencia: cumplió/parcial/no/cumplió = 62.5 %, cobertura 50 %', () => {
  const r = F.adherenciaPlan(
    [{ estado: 'cumplio' }, { estado: 'parcial' }, { estado: 'no' }, { estado: 'cumplio' }],
    { comidasProgramadas: 8 }
  );
  assert.equal(r.valor.porcentaje, 62.5);
  assert.equal(r.valor.cobertura, 50);
  assert.equal(F.adherenciaPlan([]).valor, null);
});

test('Promedio de consumo calórico ignora faltantes', () => {
  assert.equal(F.promedioConsumoCalorico([2000, null, 1800, { kcal: 2200 }, '']).valor, 2000);
  assert.equal(F.promedioConsumoCalorico([]).valor, null);
});

test('Variación semanal y mensual', () => {
  const serie = [
    { fecha: '2026-10-01', valor: 80 },
    { fecha: '2026-10-08', valor: 79 },
    { fecha: '2026-10-15', valor: 78 },
  ];
  const semanal = F.variacionPeriodo(serie, 7);
  assert.equal(semanal.valor.delta, -1);
  assert.equal(semanal.valor.diasComparados, 7);
  assert.equal(semanal.valor.tasaSemanal, -1);

  const mensual = F.variacionPeriodo(serie, 30);
  assert.equal(mensual.valor.delta, -2);
  assert.equal(mensual.advertencias.length, 1); // no hay dato de hace 30 días
  assert.equal(F.variacionPeriodo([{ fecha: '2026-10-01', valor: 80 }], 7).valor, null);
});

test('Evaluación integral: distingue calculado, estimado y faltantes', () => {
  const ev = evaluarMedicion({
    paciente: { edad: 30, sexo: 'Masculino', estatura: 175 },
    medicion: { pesoKg: 76, cinturaCm: 85, caderaCm: 100, grasaPorcentaje: 25, consumoKcal: 2000 },
    prescripcion: { factorActividad: 1.55, pesoObjetivoKg: 70, kcalObjetivo: 2000, proteinasPct: 20, carbohidratosPct: 50, grasasPct: 30, proteinaGKg: 1.2 },
    pesoInicialKg: 80,
  });
  assert.equal(ev.imc.valor, 24.8);
  assert.equal(ev.imc.origen, 'calculado');
  assert.equal(ev.tmr.origen, 'estimado');
  assert.equal(ev.tmr.valor, 1709);          // 760 + 1093.75 − 150 + 5
  assert.equal(ev.get.valor, 2649);          // 1708.75 redondeado → 1709 × 1.55
  assert.equal(ev.balanceEnergetico.valor, -649);
  assert.equal(ev.cambioPeso.valor, -5);
  assert.equal(ev.progresoPeso.valor, 40);
  assert.equal(ev.composicion.valor.masaGrasaKg, 19);
  assert.equal(ev.requerimientoProteico.valor, 91.2);
});

test('Evaluación: dato inválido no rompe el resto de indicadores', () => {
  const ev = evaluarMedicion({ paciente: { edad: 30 }, medicion: { pesoKg: 70, estaturaCm: 175, cinturaCm: 5 } });
  assert.equal(ev.imc.valor, 22.9);
  assert.equal(ev.relacionCinturaEstatura.origen, 'error');
  assert.equal(ev.tmr.valor, null); // sin sexo: no se estima
});

test('Ajustes del nutriólogo conservan el valor original', () => {
  const base = { get: { valor: 2649, origen: 'estimado' } };
  const final = resultadosConAjustes(base, [{ indicador: 'get', valor: 2400, motivo: 'Calorimetría indirecta', responsable: 'nutrióloga' }]);
  assert.equal(final.get.valor, 2400);
  assert.equal(final.get.valorOriginal, 2649);
  assert.equal(final.get.origen, 'ajustado');
  assert.equal(base.get.valor, 2649); // el original no se muta
});
