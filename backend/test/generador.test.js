const test = require('node:test');
const assert = require('node:assert/strict');
const Platillo = require('../src/Models/Platillo');
const PreferenciasAlimentarias = require('../src/Models/PreferenciasAlimentarias');
const PLATILLOS = require('../src/data/platillos-base.json');
const g = require('../src/Services/nutricion/generadorDietas');

const SEMILLAS = Array.from({ length: 120 }, (_, i) => (i + 1) * 104729);
const perfilDe = (datos) => g.construirPerfil(datos);
const generar = (perfil, semilla = 12345, extra = {}) => g.generarPlanValido({ platillos: PLATILLOS, perfil, semilla, ...extra });
const comidasDe = (plan) => plan.dias.flatMap((d) => d.comidas);
const OMNIVORO = { kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 5 } };

/* ---------- Catálogo inicial ---------- */

test('Catálogo: todos los platillos base son válidos y sus claves son únicas', () => {
  const claves = new Set();
  PLATILLOS.forEach((p) => {
    assert.equal(new Platillo(p).validateSync(), undefined, `platillo inválido: ${p.clave}`);
    assert.ok(!claves.has(p.clave), `clave repetida: ${p.clave}`);
    claves.add(p.clave);
  });
  assert.ok(PLATILLOS.length >= 60);
});

test('Catálogo: la clasificación vegana/vegetariana se deriva y es coherente con lo que contiene', () => {
  PLATILLOS.forEach((p) => {
    const c = g.clasificar(p);
    if (c.vegano) {
      ['lacteos', 'huevo', 'pescado', 'mariscos'].forEach((a) => assert.ok(!p.alergenos.includes(a), `${p.clave} vegano con ${a}`));
      assert.ok(!['pollo', 'pavo', 'res', 'cerdo', 'miel'].some((x) => p.contiene.includes(x)), `${p.clave} vegano con origen animal`);
    }
    if (['pollo', 'res', 'cerdo'].includes(p.proteina)) assert.ok(!c.vegetariano, `${p.clave} tiene carne y quedó vegetariano`);
  });
});

test('kcalPlatillo: calcula la energía a partir de los equivalentes del SMAE', () => {
  assert.equal(g.kcalPlatillo({ equivalentes: { cereales: 2, aoa: 3, verduras: 2, grasas: 1 } }), 2 * 70 + 3 * 55 + 2 * 25 + 45);
});

test('Preferencias: valida tipo de alimentación, número de comidas y restricciones', () => {
  const err = new PreferenciasAlimentarias({ pacienteId: '6b07b6564967a2e166f9c26b', tipoAlimentacion: 'carnivora', numeroComidas: 7, restricciones: ['ayuno-total'] }).validateSync();
  assert.ok(err.errors.tipoAlimentacion);
  assert.ok(err.errors.numeroComidas);
  assert.ok(err.errors['restricciones.0']);
});

/* ---------- Datos mínimos ---------- */

test('datosFaltantes: pide alergias, requerimiento, tipo de alimentación y número de comidas antes de generar', () => {
  const faltan = g.datosFaltantes({ kcal: null, preferencias: null, alergiasRegistradas: false }).map((f) => f.campo);
  assert.deepEqual(faltan.sort(), ['alergias', 'numeroComidas', 'requerimiento', 'tipoAlimentacion']);
  assert.deepEqual(g.datosFaltantes({ kcal: 1800, preferencias: { tipoAlimentacion: 'vegana', numeroComidas: 4 }, alergiasRegistradas: true }), []);
  assert.ok(g.datosFaltantes({ kcal: 300, preferencias: { tipoAlimentacion: 'vegana', numeroComidas: 4 }, alergiasRegistradas: true }).some((f) => f.campo === 'requerimiento'));
});

/* ---------- Seguridad: restricciones nunca se violan ---------- */

const CASOS_ALERGIA = [
  ['gluten (celiaquía)', { categoria: 'alergia', descripcion: 'Enfermedad celiaca' }, 'gluten'],
  ['lácteos (lactosa)', { categoria: 'intolerancia', descripcion: 'Intolerancia a la lactosa' }, 'lacteos'],
  ['huevo', { categoria: 'alergia', descripcion: 'Alergia al huevo' }, 'huevo'],
  ['cacahuate', { categoria: 'alergia', descripcion: 'Alergia al cacahuate' }, 'cacahuate'],
  ['frutos secos', { categoria: 'alergia', descripcion: 'Alergia a nueces y almendras' }, 'frutos-secos'],
  ['mariscos', { categoria: 'alergia', descripcion: 'Alergia a camarón' }, 'mariscos'],
  ['pescado', { categoria: 'alergia', descripcion: 'Alergia al pescado' }, 'pescado'],
  ['soya', { categoria: 'alergia', descripcion: 'Alergia a la soya' }, 'soya'],
];
CASOS_ALERGIA.forEach(([nombre, alergia, alergeno]) => {
  test(`Alergia a ${nombre}: ningún plan (en ${SEMILLAS.length} semillas) incluye el alérgeno`, () => {
    const perfil = perfilDe({ ...OMNIVORO, alergias: [alergia] });
    SEMILLAS.forEach((s) => {
      const r = generar(perfil, s);
      assert.ok(r.ok, r.motivo);
      comidasDe(r.plan).forEach((c) => assert.ok(!c.alergenos.includes(alergeno), `${c.nombre} contiene ${alergeno} (semilla ${s})`));
    });
  });
});

test('Alergia a un alimento sin etiqueta (mango): se excluye por el texto de los ingredientes', () => {
  const perfil = perfilDe({ ...OMNIVORO, alergias: [{ categoria: 'alergia', descripcion: 'Alergia al mango' }] });
  SEMILLAS.slice(0, 40).forEach((s) => {
    const r = generar(perfil, s);
    comidasDe(r.plan).forEach((c) => assert.ok(!g.normalizar(c.ingredientes.map((i) => i.alimento).join(' ')).includes('mango')));
  });
});

test('Rechazos: los alimentos que el paciente no quiere nunca aparecen', () => {
  const perfil = perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 5, rechazos: ['Brócoli', 'atún', 'nopales'] } });
  SEMILLAS.slice(0, 60).forEach((s) => {
    const texto = g.normalizar(JSON.stringify(comidasDe(generar(perfil, s).plan).map((c) => [c.nombre, c.ingredientes])));
    ['brocoli', 'atun', 'nopales'].forEach((r) => assert.ok(!texto.includes(r), `aparece ${r} (semilla ${s})`));
  });
});

test('Tipo de alimentación: los planes veganos y vegetarianos solo usan platillos aptos', () => {
  [['vegana', 'vegano'], ['vegetariana', 'vegetariano'], ['pescetariana', 'pescetariano']].forEach(([tipo, campo]) => {
    const perfil = perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: tipo, numeroComidas: 5 } });
    SEMILLAS.slice(0, 60).forEach((s) => {
      const r = generar(perfil, s);
      assert.ok(r.ok, `${tipo}: ${r.motivo}`);
      comidasDe(r.plan).forEach((c) => assert.ok(g.clasificar(c)[campo], `${tipo}: ${c.nombre}`));
    });
  });
});

test('Restricciones religiosas: halal sin cerdo ni alcohol; kosher sin cerdo, sin mariscos y sin mezclar carne y lácteos', () => {
  const halal = perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 4, restricciones: ['halal'] } });
  const kosher = perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 4, restricciones: ['kosher'] } });
  SEMILLAS.slice(0, 60).forEach((s) => {
    comidasDe(generar(halal, s).plan).forEach((c) => assert.ok(!c.contiene.includes('cerdo') && !c.contiene.includes('alcohol'), c.nombre));
    comidasDe(generar(kosher, s).plan).forEach((c) => {
      assert.ok(!c.contiene.includes('cerdo') && !c.alergenos.includes('mariscos'), c.nombre);
      assert.ok(!(g.clasificar(c).conCarne && c.alergenos.includes('lacteos')), `${c.nombre} mezcla carne y lácteos`);
    });
  });
  assert.ok(halal.advertencias.some((a) => /certificaci/.test(a)));
});

test('Diagnósticos: diabetes excluye azúcar añadida e hipertensión excluye platillos altos en sodio', () => {
  const perfil = perfilDe({ ...OMNIVORO, diagnosticos: [{ texto: 'Diabetes mellitus tipo 2' }, { texto: 'Hipertensión arterial' }] });
  assert.deepEqual(perfil.excluirEtiquetas.sort(), ['alto-sodio', 'azucar-anadida']);
  SEMILLAS.slice(0, 60).forEach((s) => comidasDe(generar(perfil, s).plan)
    .forEach((c) => assert.ok(!c.etiquetas.includes('alto-sodio') && !c.etiquetas.includes('azucar-anadida'), c.nombre)));
});

/* ---------- Coherencia y variedad ---------- */

test('Plan: 7 días, todas las comidas, ≤ 2 repeticiones por semana, sin repetir en días seguidos y kcal ±10 %', () => {
  [3, 4, 5].forEach((n) => [1400, 1800, 2400].forEach((kcal) => {
    const perfil = perfilDe({ kcal, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: n } });
    SEMILLAS.slice(0, 30).forEach((s) => {
      const r = generar(perfil, s);
      assert.ok(r.ok, `${n} comidas, ${kcal} kcal: ${r.motivo}`);
      assert.equal(r.plan.dias.length, 7);
      const usos = {};
      r.plan.dias.forEach((d, i) => {
        assert.equal(d.comidas.length, n);
        assert.ok(Math.abs(d.kcal - kcal) <= kcal * g.TOLERANCIA_KCAL, `${d.dia}: ${d.kcal} vs ${kcal}`);
        d.comidas.forEach((c) => {
          usos[c.platilloClave] = (usos[c.platilloClave] || 0) + 1;
          if (i > 0) assert.ok(!r.plan.dias[i - 1].comidas.some((x) => x.platilloClave === c.platilloClave), 'repetido en días seguidos');
        });
      });
      Object.values(usos).forEach((u) => assert.ok(u <= g.MAX_REPETICIONES_SEMANA));
    });
  }));
});

test('Aleatoriedad controlada: la misma semilla reproduce el plan y semillas distintas lo varían', () => {
  const perfil = perfilDe(OMNIVORO);
  const a = generar(perfil, 777).plan;
  const b = generar(perfil, 777).plan;
  assert.deepEqual(a.dias, b.dias);
  const distintos = new Set(SEMILLAS.slice(0, 20).map((s) => JSON.stringify(comidasDe(generar(perfil, s).plan).map((c) => c.platilloClave))));
  assert.ok(distintos.size >= 18, `solo ${distintos.size} planes distintos en 20 semillas`);
});

test('Gustos: los platillos con alimentos que le gustan aparecen más a menudo', () => {
  const conteo = (perfil) => SEMILLAS.slice(0, 60).reduce((t, s) => t + comidasDe(generar(perfil, s).plan)
    .filter((c) => g.normalizar(c.nombre).includes('pescado')).length, 0);
  const sin = conteo(perfilDe(OMNIVORO));
  const con = conteo(perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 5, gustos: ['pescado'] } }));
  assert.ok(con > sin, `con gusto ${con} vs sin gusto ${sin}`);
});

test('Regenerar: las comidas fijadas se conservan y el resto cambia', () => {
  const perfil = perfilDe(OMNIVORO);
  const base = generar(perfil, 1).plan;
  const fijadas = { '0-2': base.dias[0].comidas[2].platilloClave, '3-0': base.dias[3].comidas[0].platilloClave };
  const nuevo = generar(perfil, 99991, { fijadas }).plan;
  assert.equal(nuevo.dias[0].comidas[2].platilloClave, fijadas['0-2']);
  assert.equal(nuevo.dias[3].comidas[0].platilloClave, fijadas['3-0']);
  assert.ok(nuevo.dias[0].comidas[2].fijada);
  assert.notDeepEqual(comidasDe(nuevo).map((c) => c.platilloClave), comidasDe(base).map((c) => c.platilloClave));
});

test('Una comida fijada que ya no es apta (nueva alergia) no se conserva', () => {
  const base = generar(perfilDe(OMNIVORO), 5).plan;
  const conHuevo = PLATILLOS.find((p) => p.alergenos.includes('huevo') && p.tiempos.includes('desayuno'));
  const perfil = perfilDe({ ...OMNIVORO, alergias: [{ categoria: 'alergia', descripcion: 'huevo' }] });
  const r = generar(perfil, 5, { fijadas: { '0-0': conHuevo.clave } });
  assert.ok(r.ok);
  assert.notEqual(r.plan.dias[0].comidas[0].platilloClave, conHuevo.clave);
  assert.ok(base);
});

/* ---------- Casos imposibles y validación independiente ---------- */

test('Sin opciones suficientes: explica el motivo en lugar de relajar restricciones', () => {
  const perfil = perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'vegana', numeroComidas: 5, rechazos: ['frijol', 'tortilla', 'avena', 'soya', 'amaranto'] } });
  const r = generar(perfil, 3);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /No hay suficientes platillos de «Desayuno»/);
  assert.ok(r.detalle.exclusiones);
});

test('validarPlan: detecta un platillo no apto introducido después de generar', () => {
  const perfil = perfilDe({ ...OMNIVORO, alergias: [{ categoria: 'alergia', descripcion: 'cacahuate' }] });
  const plan = generar(perfil, 11).plan;
  assert.equal(g.validarPlan(plan, perfil).valido, true);
  const alterado = JSON.parse(JSON.stringify(plan));
  const intruso = PLATILLOS.find((p) => p.clave === 'manzana-crema-cacahuate');
  Object.assign(alterado.dias[2].comidas[1], { platilloClave: intruso.clave, nombre: intruso.nombre, ingredientes: intruso.ingredientes, alergenos: intruso.alergenos });
  const v = g.validarPlan(alterado, perfil);
  assert.equal(v.valido, false);
  assert.ok(v.problemas.some((p) => /no es apto/.test(p)));
});

test('listaCompras: agrupa los ingredientes de la semana', () => {
  const plan = generar(perfilDe(OMNIVORO), 21).plan;
  const lista = g.listaCompras(plan);
  assert.ok(lista.length > 10);
  assert.ok(lista.every((i) => i.alimento && i.veces >= 1));
});

/* ---------- Correcciones de la revisión de seguridad ---------- */

test('Alergias y rechazos en plural o con palabras cortas también se excluyen (fresas, ajo, plátanos)', () => {
  const perfil = perfilDe({ ...OMNIVORO, alergias: [{ categoria: 'alergia', descripcion: 'Alergia a las fresas' }, { categoria: 'intolerancia', descripcion: 'ajo' }] });
  const conRechazos = perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 5, rechazos: ['plátanos', 'limones'] } });
  SEMILLAS.slice(0, 40).forEach((s) => {
    const texto = g.normalizar(JSON.stringify(comidasDe(generar(perfil, s).plan).map((c) => [c.nombre, c.ingredientes])));
    assert.ok(!/fresa/.test(texto) && !/\bajo\b/.test(texto), `aparece fresa o ajo (semilla ${s})`);
    const texto2 = g.normalizar(JSON.stringify(comidasDe(generar(conRechazos, s).plan).map((c) => [c.nombre, c.ingredientes])));
    assert.ok(!/platano/.test(texto2) && !/limon/.test(texto2), `aparece plátano o limón (semilla ${s})`);
  });
});

test('Clasificación: un platillo mal etiquetado se reconoce por su proteína o sus ingredientes', () => {
  const mal = { nombre: 'Torta de jamón', proteina: 'ninguna', ingredientes: [{ alimento: 'Jamón de pierna' }, { alimento: 'Pan' }], alergenos: [], contiene: [] };
  const c = g.clasificar(mal);
  assert.equal(c.vegetariano, false);
  assert.ok(c.contiene.has('cerdo'));
  assert.equal(g.clasificar({ nombre: 'Tacos', proteina: 'pollo', ingredientes: [{ alimento: 'Tortilla' }], alergenos: [], contiene: [] }).vegetariano, false);
  assert.ok(g.motivoExclusion(mal, perfilDe({ kcal: 1800, preferencias: { tipoAlimentacion: 'omnivora', numeroComidas: 3, restricciones: ['sin-cerdo'] } })));
  // La crema de cacahuate y las bebidas vegetales no cuentan como lácteos
  assert.equal(g.clasificar(PLATILLOS.find((p) => p.clave === 'pan-crema-cacahuate')).vegano, true);
});

test('La copia del plan indica si cada platillo estaba validado por un profesional', () => {
  const plan = generar(perfilDe(OMNIVORO), 31).plan;
  assert.ok(comidasDe(plan).every((c) => c.validado === false)); // el catálogo inicial llega sin validar
  const validados = PLATILLOS.map((p) => ({ ...p, validado: true }));
  const plan2 = g.generarPlanValido({ platillos: validados, perfil: perfilDe(OMNIVORO), semilla: 31 }).plan;
  assert.ok(comidasDe(plan2).every((c) => c.validado === true));
});
