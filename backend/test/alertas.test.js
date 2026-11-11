/* Pruebas unitarias de las reglas de alerta (funciones puras, sin base de datos) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { REGLAS, REGLAS_POR_OMISION, evaluarReglas } = require('../src/Services/clinica/reglasAlerta');

const DIA = 86400000;
const AHORA = new Date('2026-11-10T12:00:00Z').getTime();
const hace = (d) => new Date(AHORA - d * DIA);
const regla = (tipo, parametros = {}) => ({ codigo: tipo.toUpperCase(), tipo, parametros, prioridad: 'media', activa: true });
const ctx = (extra = {}) => ({
  paciente: { _id: 'p1', estado: 'activo', fechaNacimiento: '1990-01-01', sexo: 'Femenino', estatura: 160 },
  expediente: { estado: 'en_seguimiento' }, mediciones: [], laboratorios: [], citas: [], consultas: [],
  objetivos: [], planVigente: null, antecedentes: [], consentimientos: [], ahora: AHORA, ...extra,
});

test('Laboratorio: usa el último resultado de cada analito y el rango del propio laboratorio', () => {
  const laboratorios = [
    { _id: 'l1', analito: 'glucosa_ayuno', nombre: 'Glucosa', valor: 130, unidad: 'mg/dL', fechaMuestra: hace(60), rangoReferencia: { min: 70, max: 100 } },
    { _id: 'l2', analito: 'glucosa_ayuno', nombre: 'Glucosa', valor: 95, unidad: 'mg/dL', fechaMuestra: hace(5), rangoReferencia: { min: 70, max: 100 } },
    { _id: 'l3', analito: 'hdl', nombre: 'HDL', valor: 30, unidad: 'mg/dL', fechaMuestra: hace(5), rangoReferencia: { min: 40 } },
    { _id: 'l4', analito: 'ldl', nombre: 'LDL', valor: 300, unidad: 'mg/dL', fechaMuestra: hace(5) }, // sin rango: no alerta
  ];
  const r = REGLAS.laboratorio_fuera_rango_lab(regla('laboratorio_fuera_rango_lab'), ctx({ laboratorios }));
  assert.equal(r.length, 1);
  assert.match(r[0].motivo, /HDL: 30 mg\/dL .* por debajo/);
  assert.equal(r[0].origen.pestana, 'laboratorios');
});

test('Laboratorio: umbral configurado', () => {
  const laboratorios = [{ _id: 'l1', analito: 'trigliceridos', nombre: 'TG', valor: 210, unidad: 'mg/dL', fechaMuestra: hace(1) }];
  assert.equal(REGLAS.laboratorio_umbral(regla('laboratorio_umbral', { analito: 'trigliceridos', max: 200 }), ctx({ laboratorios })).length, 1);
  assert.equal(REGLAS.laboratorio_umbral(regla('laboratorio_umbral', { analito: 'trigliceridos', max: 250 }), ctx({ laboratorios })).length, 0);
  assert.equal(REGLAS.laboratorio_umbral(regla('laboratorio_umbral', {}), ctx({ laboratorios })).length, 0);
});

test('Cambio de peso: compara con la medición más antigua dentro de la ventana', () => {
  const mediciones = [
    { _id: 'm0', fecha: hace(400), pesoKg: 90 }, // fuera de ventana
    { _id: 'm1', fecha: hace(150), pesoKg: 80 },
    { _id: 'm2', fecha: hace(10), pesoKg: 75.5 },
  ];
  const r = REGLAS.cambio_peso(regla('cambio_peso', { porcentaje: 5, dias: 180 }), ctx({ mediciones }));
  assert.equal(r.length, 1);
  assert.match(r[0].motivo, /-5\.6 %/);
  assert.equal(r[0].llave, 'CAMBIO_PESO|m2');
  assert.equal(REGLAS.cambio_peso(regla('cambio_peso', { porcentaje: 6, dias: 180 }), ctx({ mediciones })).length, 0);
});

test('Seguimiento pendiente: sin cita futura y último registro antiguo', () => {
  const viejo = ctx({ consultas: [{ fecha: hace(45) }] });
  assert.equal(REGLAS.seguimiento_pendiente(regla('seguimiento_pendiente', { dias: 30 }), viejo).length, 1);
  const conCita = ctx({ consultas: [{ fecha: hace(45) }], citas: [{ _id: 'c1', estado: 'programada', fechaHora: new Date(AHORA + DIA) }] });
  assert.equal(REGLAS.seguimiento_pendiente(regla('seguimiento_pendiente', { dias: 30 }), conCita).length, 0);
  const baja = ctx({ consultas: [{ fecha: hace(45) }], paciente: { _id: 'p1', estado: 'baja' } });
  assert.equal(REGLAS.seguimiento_pendiente(regla('seguimiento_pendiente'), baja).length, 0);
});

test('Objetivo sin revisión: la llave cambia con cada revisión (no reabre alertas)', () => {
  const o = { _id: 'o1', descripcion: 'Bajar 5 kg', estado: 'activo', frecuenciaRevisionDias: 30, createdAt: hace(40), revisiones: [] };
  const r1 = REGLAS.objetivo_sin_revision(regla('objetivo_sin_revision'), ctx({ objetivos: [o] }));
  assert.equal(r1.length, 1);
  const revisado = { ...o, revisiones: [{ fecha: hace(2) }] };
  assert.equal(REGLAS.objetivo_sin_revision(regla('objetivo_sin_revision'), ctx({ objetivos: [revisado] })).length, 0);
  const vencidoOtraVez = { ...o, revisiones: [{ fecha: hace(35) }] };
  assert.notEqual(REGLAS.objetivo_sin_revision(regla('objetivo_sin_revision'), ctx({ objetivos: [vencidoOtraVez] }))[0].llave, r1[0].llave);
});

test('Datos incompletos: alergias y consentimiento', () => {
  const r = REGLAS.datos_incompletos(regla('datos_incompletos'), ctx());
  assert.match(r[0].motivo, /alergias/);
  assert.match(r[0].motivo, /consentimiento/);
  const completo = ctx({
    antecedentes: [{ categoria: 'alergia', estado: 'negado', descripcion: 'Niega alergias' }],
    consentimientos: [{ tipo: 'datos_sensibles', otorgado: true }],
  });
  assert.equal(REGLAS.datos_incompletos(regla('datos_incompletos'), completo).length, 0);
  const revocado = ctx({ ...completo, consentimientos: [{ tipo: 'datos_sensibles', otorgado: true, revocacion: { fecha: hace(1) } }], antecedentes: completo.antecedentes });
  assert.match(REGLAS.datos_incompletos(regla('datos_incompletos'), revocado)[0].motivo, /consentimiento/);
});

test('Consulta no realizada: inasistencias y citas sin actualizar', () => {
  const citas = [
    { _id: 'c1', estado: 'no_asistio', fechaHora: hace(3) },
    { _id: 'c2', estado: 'programada', fechaHora: hace(3) },
    { _id: 'c3', estado: 'programada', fechaHora: new Date(AHORA + DIA) },
    { _id: 'c4', estado: 'no_asistio', fechaHora: hace(90) },
  ];
  assert.deepEqual(REGLAS.consulta_no_realizada(regla('consulta_no_realizada', { dias: 30 }), ctx({ citas })).map((c) => c.origen.id), ['c1', 'c2']);
});

test('Alergia en plan: coincidencia por texto, sin acentos ni palabras vacías', () => {
  const planVigente = { _id: 'pl1', nombre: 'Dieta semana 2', alimentos: ['Huevo', 'Pan integral', 'Cacahuate tostado', 'Yogur sin azúcar'] };
  const antecedentes = [
    { grupoId: 'a1', categoria: 'alergia', estado: 'activo', descripcion: 'Alergia al huevo' },
    { grupoId: 'a2', categoria: 'intolerancia', estado: 'activo', descripcion: 'Intolerancia a la lactosa' },
    { grupoId: 'a3', categoria: 'alergia', estado: 'resuelto', descripcion: 'Cacahuate' },
  ];
  const r = REGLAS.alergia_en_plan(regla('alergia_en_plan'), ctx({ planVigente, antecedentes }));
  assert.equal(r.length, 1);
  assert.match(r[0].motivo, /Huevo/);
  assert.match(r[0].motivo, /Revisión requerida/);
});

test('Reglas inactivas no se evalúan y las por omisión son válidas', () => {
  const inactiva = { ...regla('datos_incompletos'), activa: false };
  assert.equal(evaluarReglas([inactiva], ctx()).length, 0);
  REGLAS_POR_OMISION.forEach((r) => assert.ok(REGLAS[r.tipo], r.tipo));
  assert.ok(REGLAS_POR_OMISION.find((r) => r.tipo === 'cambio_peso').nota.includes('GLIM'));
});
