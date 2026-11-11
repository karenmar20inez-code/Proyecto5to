/**
 * ============================================================
 *  LA NUTRIA · MOTOR DE CÁLCULOS NUTRICIONALES
 * ============================================================
 *  Funciones puras e independientes (sin acceso a BD ni a HTTP).
 *
 *  Todas devuelven un objeto `Resultado`:
 *    {
 *      valor:        number | object | null,
 *      unidad:       string,
 *      tipo:         'calculado' | 'estimado',
 *      formula:      identificador de la fórmula,
 *      faltantes:    string[]  (datos requeridos ausentes),
 *      advertencias: string[]  (restricciones de aplicación)
 *    }
 *
 *  - 'calculado': operación aritmética directa sobre datos medidos.
 *  - 'estimado':  ecuación predictiva poblacional; el profesional puede
 *                 ajustarla o sustituirla. Nunca es un diagnóstico.
 *
 *  Si falta un dato obligatorio NO se inventa: `valor` es null y el
 *  campo se lista en `faltantes`. Si un dato está fuera de rango
 *  fisiológico se lanza `ErrorValidacion`.
 *
 *  Unidades de entrada: kg, cm, años, kcal, %, ml.
 * ============================================================
 */

const VERSION_FORMULAS = '1.0.0';

class ErrorValidacion extends Error {
  constructor(campo, mensaje) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.campo = campo;
  }
}

/* ---------- utilidades internas ---------- */

const esVacio = (v) => v === undefined || v === null || v === '' || Number.isNaN(v);

/** Convierte a número; '' / null / undefined → null. Lanza si no es numérico. */
function numero(campo, v, { min = -Infinity, max = Infinity } = {}) {
  if (esVacio(v)) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new ErrorValidacion(campo, `${campo} debe ser numérico`);
  if (n < min || n > max) {
    throw new ErrorValidacion(campo, `${campo} fuera de rango (${min} – ${max})`);
  }
  return n;
}

const redondear = (n, decimales = 2) =>
  n === null ? null : Math.round(n * 10 ** decimales) / 10 ** decimales;

function resultado(formula, unidad, tipo, valor, faltantes = [], advertencias = []) {
  return { valor: faltantes.length ? null : valor, unidad, tipo, formula, faltantes, advertencias };
}

function faltan(datos) {
  return Object.entries(datos).filter(([, v]) => v === null).map(([k]) => k);
}

/* Rangos fisiológicos aceptados (validación de captura, no de normalidad) */
const RANGOS = {
  pesoKg: { min: 1, max: 400 },
  estaturaCm: { min: 30, max: 250 },
  edad: { min: 0, max: 120 },
  cinturaCm: { min: 20, max: 300 },
  caderaCm: { min: 20, max: 300 },
  porcentaje: { min: 0, max: 100 },
  kcal: { min: 0, max: 15000 },
};

/* ============================================================
 * 1. ÍNDICE DE MASA CORPORAL
 * IMC = peso (kg) / estatura (m)²
 * Ref.: OMS. Obesity: preventing and managing the global epidemic. TRS 894, 2000.
 * Restricción: puntos de corte válidos para adultos (≥ 18 años).
 * ============================================================ */
function imc({ pesoKg, estaturaCm, edad } = {}) {
  const peso = numero('pesoKg', pesoKg, RANGOS.pesoKg);
  const estatura = numero('estaturaCm', estaturaCm, RANGOS.estaturaCm);
  const años = numero('edad', edad, RANGOS.edad);
  const adv = [];
  if (años !== null && años < 18) {
    adv.push('En menores de 18 años el IMC debe interpretarse con percentiles por edad y sexo (OMS/CDC).');
  }
  const f = faltan({ pesoKg: peso, estaturaCm: estatura });
  const valor = f.length ? null : redondear(peso / (estatura / 100) ** 2, 1);
  return resultado('IMC', 'kg/m²', 'calculado', valor, f, adv);
}

/** Categoría de referencia OMS para adultos (clasificación, no diagnóstico). */
function categoriaImcOMS(valorImc) {
  if (esVacio(valorImc)) return null;
  if (valorImc < 18.5) return 'Bajo peso';
  if (valorImc < 25) return 'Normal';
  if (valorImc < 30) return 'Sobrepeso';
  if (valorImc < 35) return 'Obesidad grado I';
  if (valorImc < 40) return 'Obesidad grado II';
  return 'Obesidad grado III';
}

/* ============================================================
 * 2. TASA METABÓLICA EN REPOSO · Mifflin-St Jeor
 * Hombres: 10·peso + 6.25·estatura − 5·edad + 5
 * Mujeres: 10·peso + 6.25·estatura − 5·edad − 161
 * Ref.: Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241-247.
 * Restricción: adultos 19–78 años de la muestra original. Si el sexo
 * no es Femenino/Masculino no se elige una ecuación automáticamente.
 * ============================================================ */
function tmrMifflinStJeor({ pesoKg, estaturaCm, edad, sexo } = {}) {
  const peso = numero('pesoKg', pesoKg, RANGOS.pesoKg);
  const estatura = numero('estaturaCm', estaturaCm, RANGOS.estaturaCm);
  const años = numero('edad', edad, RANGOS.edad);
  const s = sexo === 'Masculino' || sexo === 'Femenino' ? sexo : null;
  const adv = [];
  if (!esVacio(sexo) && !s) {
    adv.push('La ecuación requiere sexo biológico Femenino o Masculino; el profesional debe definir el valor.');
  }
  if (años !== null && (años < 18 || años > 80)) {
    adv.push('Ecuación validada en adultos; fuera de ese rango la estimación es menos precisa.');
  }
  const f = faltan({ pesoKg: peso, estaturaCm: estatura, edad: años, sexo: s });
  let valor = null;
  if (!f.length) {
    valor = 10 * peso + 6.25 * estatura - 5 * años + (s === 'Masculino' ? 5 : -161);
    valor = redondear(valor, 0);
  }
  return resultado('Mifflin-St Jeor', 'kcal/día', 'estimado', valor, f, adv);
}

/* ============================================================
 * 3. GASTO ENERGÉTICO TOTAL estimado
 * GET = TMR × factor de actividad física
 * Ref.: FAO/OMS/UNU. Human energy requirements. 2004 (PAL 1.40 – 2.40).
 * El factor lo prescribe el nutriólogo.
 * ============================================================ */
function gastoEnergeticoTotal({ tmrKcal, factorActividad } = {}) {
  const tmr = numero('tmrKcal', tmrKcal, RANGOS.kcal);
  const factor = numero('factorActividad', factorActividad, { min: 1, max: 2.5 });
  const adv = [];
  if (factor !== null && factor < 1.2) adv.push('Factor menor a 1.2: verificar (reposo absoluto).');
  const f = faltan({ tmrKcal: tmr, factorActividad: factor });
  return resultado('TMR × factor de actividad', 'kcal/día', 'estimado',
    f.length ? null : redondear(tmr * factor, 0), f, adv);
}

/* ============================================================
 * 4. BALANCE ENERGÉTICO
 * Balance = energía consumida − gasto energético
 * (+) superávit, (−) déficit.
 * ============================================================ */
function balanceEnergetico({ consumoKcal, gastoKcal } = {}) {
  const consumo = numero('consumoKcal', consumoKcal, RANGOS.kcal);
  const gasto = numero('gastoKcal', gastoKcal, RANGOS.kcal);
  const f = faltan({ consumoKcal: consumo, gastoKcal: gasto });
  return resultado('Consumo − gasto', 'kcal/día', 'calculado',
    f.length ? null : redondear(consumo - gasto, 0), f,
    ['Depende de la exactitud del consumo registrado y del gasto estimado.']);
}

/* ============================================================
 * 5. PORCENTAJE DE CAMBIO DE PESO
 * %Δ = (peso actual − peso inicial) / peso inicial × 100
 * ============================================================ */
function cambioPesoPorcentual({ pesoInicialKg, pesoActualKg } = {}) {
  const inicial = numero('pesoInicialKg', pesoInicialKg, RANGOS.pesoKg);
  const actual = numero('pesoActualKg', pesoActualKg, RANGOS.pesoKg);
  const f = faltan({ pesoInicialKg: inicial, pesoActualKg: actual });
  return resultado('(actual − inicial) / inicial × 100', '%', 'calculado',
    f.length ? null : redondear(((actual - inicial) / inicial) * 100, 2), f);
}

/* ============================================================
 * 6. RELACIÓN CINTURA-CADERA
 * ICC = cintura (cm) / cadera (cm)
 * Ref.: OMS. Waist circumference and waist-hip ratio. Expert consultation, 2008.
 * ============================================================ */
function relacionCinturaCadera({ cinturaCm, caderaCm } = {}) {
  const cintura = numero('cinturaCm', cinturaCm, RANGOS.cinturaCm);
  const cadera = numero('caderaCm', caderaCm, RANGOS.caderaCm);
  const f = faltan({ cinturaCm: cintura, caderaCm: cadera });
  return resultado('cintura / cadera', 'razón', 'calculado',
    f.length ? null : redondear(cintura / cadera, 2), f);
}

/* ============================================================
 * 7. RELACIÓN CINTURA-ESTATURA
 * ICE = cintura (cm) / estatura (cm)
 * Ref.: Ashwell M, Gibson S. BMJ Open. 2016;6:e010159.
 * ============================================================ */
function relacionCinturaEstatura({ cinturaCm, estaturaCm } = {}) {
  const cintura = numero('cinturaCm', cinturaCm, RANGOS.cinturaCm);
  const estatura = numero('estaturaCm', estaturaCm, RANGOS.estaturaCm);
  const f = faltan({ cinturaCm: cintura, estaturaCm: estatura });
  return resultado('cintura / estatura', 'razón', 'calculado',
    f.length ? null : redondear(cintura / estatura, 2), f);
}

/* ============================================================
 * 8. MASA GRASA Y MASA LIBRE DE GRASA
 * MG  = peso × %grasa / 100
 * MLG = peso − MG
 * La exactitud depende del método con el que se midió el %grasa
 * (bioimpedancia, plicometría, DEXA…).
 * ============================================================ */
function composicionCorporal({ pesoKg, grasaPorcentaje } = {}) {
  const peso = numero('pesoKg', pesoKg, RANGOS.pesoKg);
  const grasa = numero('grasaPorcentaje', grasaPorcentaje, { min: 1, max: 75 });
  const f = faltan({ pesoKg: peso, grasaPorcentaje: grasa });
  let valor = null;
  if (!f.length) {
    const masaGrasaKg = redondear((peso * grasa) / 100, 2);
    valor = { masaGrasaKg, masaLibreGrasaKg: redondear(peso - masaGrasaKg, 2) };
  }
  return resultado('peso × %grasa', 'kg', 'calculado', valor, f,
    ['Derivado del % de grasa; su exactitud depende del método de medición.']);
}

/* ============================================================
 * 9. DISTRIBUCIÓN DE MACRONUTRIENTES
 * gramos = kcal × % / 100 / factor Atwater (P 4, HC 4, L 9 kcal/g)
 * Ref.: Factores generales de Atwater (FAO, 2003).
 * Los porcentajes los prescribe el nutriólogo y deben sumar 100 %.
 * ============================================================ */
const ATWATER = { proteinas: 4, carbohidratos: 4, grasas: 9 };

function distribucionMacronutrientes({ kcal, proteinasPct, carbohidratosPct, grasasPct } = {}) {
  const energia = numero('kcal', kcal, RANGOS.kcal);
  const p = numero('proteinasPct', proteinasPct, RANGOS.porcentaje);
  const c = numero('carbohidratosPct', carbohidratosPct, RANGOS.porcentaje);
  const g = numero('grasasPct', grasasPct, RANGOS.porcentaje);
  const f = faltan({ kcal: energia, proteinasPct: p, carbohidratosPct: c, grasasPct: g });
  if (!f.length && Math.abs(p + c + g - 100) > 0.5) {
    throw new ErrorValidacion('macronutrientes', `Los porcentajes deben sumar 100 % (suman ${redondear(p + c + g, 1)} %)`);
  }
  let valor = null;
  if (!f.length) {
    const bloque = (pct, clave) => ({
      porcentaje: pct,
      kcal: redondear((energia * pct) / 100, 0),
      gramos: redondear((energia * pct) / 100 / ATWATER[clave], 1),
    });
    valor = {
      proteinas: bloque(p, 'proteinas'),
      carbohidratos: bloque(c, 'carbohidratos'),
      grasas: bloque(g, 'grasas'),
    };
  }
  return resultado('Atwater 4-4-9', 'g/día', 'calculado', valor, f);
}

/* ============================================================
 * 10. REQUERIMIENTO PROTEICO
 * proteína (g/día) = peso (kg) × g/kg prescritos
 * Ref.: IOM DRI 2005 (RDA adulto 0.8 g/kg); los valores mayores
 * dependen de la condición clínica y los define el profesional.
 * ============================================================ */
function requerimientoProteico({ pesoKg, gramosPorKg } = {}) {
  const peso = numero('pesoKg', pesoKg, RANGOS.pesoKg);
  const gkg = numero('gramosPorKg', gramosPorKg, { min: 0.3, max: 3.5 });
  const adv = [];
  if (gkg !== null && gkg > 2.2) adv.push('Prescripción > 2.2 g/kg: verificar indicación clínica y función renal.');
  if (gkg !== null && gkg < 0.8) adv.push('Prescripción < 0.8 g/kg (por debajo de la RDA para adultos).');
  const f = faltan({ pesoKg: peso, gramosPorKg: gkg });
  return resultado('peso × g/kg', 'g/día', 'calculado',
    f.length ? null : redondear(peso * gkg, 1), f, adv);
}

/* ============================================================
 * 11. HIDRATACIÓN (estimación orientativa)
 * agua (ml/día) = peso (kg) × ml/kg (por omisión 35 ml/kg)
 * Ref.: Práctica clínica 30–35 ml/kg en adultos sanos (ESPEN 2019).
 * No aplica en insuficiencia renal/cardiaca u otras restricciones.
 * ============================================================ */
function hidratacionEstimada({ pesoKg, mlPorKg = 35 } = {}) {
  const peso = numero('pesoKg', pesoKg, RANGOS.pesoKg);
  const factor = numero('mlPorKg', mlPorKg, { min: 20, max: 50 });
  const f = faltan({ pesoKg: peso, mlPorKg: factor });
  return resultado('peso × ml/kg', 'ml/día', 'estimado',
    f.length ? null : redondear(peso * factor, 0), f,
    ['Estimación orientativa para adultos sanos; ajustar según clima, actividad y condición clínica.']);
}

/* ============================================================
 * 12. EVOLUCIÓN DEL PESO RESPECTO AL OBJETIVO
 * progreso % = (inicial − actual) / (inicial − objetivo) × 100
 * Funciona para metas de pérdida o de ganancia. Puede ser < 0
 * (alejándose de la meta) o > 100 (meta superada).
 * ============================================================ */
function progresoHaciaObjetivo({ valorInicial, valorActual, valorObjetivo } = {}) {
  const ini = numero('valorInicial', valorInicial);
  const act = numero('valorActual', valorActual);
  const obj = numero('valorObjetivo', valorObjetivo);
  const f = faltan({ valorInicial: ini, valorActual: act, valorObjetivo: obj });
  const adv = [];
  let valor = null;
  if (!f.length) {
    if (ini === obj) {
      adv.push('El valor objetivo es igual al inicial: no hay recorrido que medir.');
    } else {
      valor = redondear(((ini - act) / (ini - obj)) * 100, 1);
    }
  }
  return resultado('(inicial − actual) / (inicial − objetivo) × 100', '%', 'calculado', valor, f, adv);
}

/* ============================================================
 * 13. CUMPLIMIENTO DE OBJETIVOS
 * Promedio del progreso de cada objetivo, acotado a [0, 100].
 * objetivos: [{ nombre, valorInicial, valorActual, valorObjetivo }]
 * ============================================================ */
function cumplimientoObjetivos(objetivos = []) {
  if (!Array.isArray(objetivos)) throw new ErrorValidacion('objetivos', 'objetivos debe ser una lista');
  const detalle = objetivos.map((o) => ({ nombre: o.nombre, progreso: progresoHaciaObjetivo(o).valor }));
  const validos = detalle.filter((d) => d.progreso !== null);
  const f = validos.length ? [] : ['objetivos'];
  const valor = validos.length
    ? {
        porcentaje: redondear(
          validos.reduce((t, d) => t + Math.min(100, Math.max(0, d.progreso)), 0) / validos.length, 1),
        detalle,
      }
    : null;
  return resultado('promedio de progreso acotado a 0–100', '%', 'calculado', valor, f);
}

/* ============================================================
 * 14. ADHERENCIA AL PLAN NUTRICIONAL
 * adherencia % = Σ puntaje / comidas registradas × 100
 * puntaje: cumplió = 1, parcial = 0.5, no cumplió = 0
 * Cobertura = registradas / programadas (si se conocen).
 * ============================================================ */
const PUNTAJE_ADHERENCIA = { cumplio: 1, parcial: 0.5, no: 0 };

function adherenciaPlan(registros = [], { comidasProgramadas } = {}) {
  if (!Array.isArray(registros)) throw new ErrorValidacion('registros', 'registros debe ser una lista');
  const validos = registros.filter((r) => r && r.estado in PUNTAJE_ADHERENCIA);
  const programadas = numero('comidasProgramadas', comidasProgramadas, { min: 0, max: 100000 });
  const f = validos.length ? [] : ['registros'];
  let valor = null;
  if (validos.length) {
    const puntos = validos.reduce((t, r) => t + PUNTAJE_ADHERENCIA[r.estado], 0);
    valor = {
      porcentaje: redondear((puntos / validos.length) * 100, 1),
      registradas: validos.length,
      cobertura: programadas ? redondear((validos.length / programadas) * 100, 1) : null,
    };
  }
  return resultado('Σ puntaje / registradas × 100', '%', 'calculado', valor, f,
    ['Basado en el autorreporte registrado; refleja solo las comidas registradas.']);
}

/* ============================================================
 * 15. PROMEDIO DE CONSUMO CALÓRICO
 * media aritmética de los registros con valor (ignora faltantes)
 * ============================================================ */
function promedioConsumoCalorico(registros = []) {
  if (!Array.isArray(registros)) throw new ErrorValidacion('registros', 'registros debe ser una lista');
  const valores = registros
    .map((r) => (typeof r === 'object' && r !== null ? r.kcal : r))
    .filter((v) => !esVacio(v))
    .map((v) => numero('kcal', v, RANGOS.kcal));
  const f = valores.length ? [] : ['registros'];
  return resultado('media aritmética', 'kcal/día', 'calculado',
    valores.length ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length, 0) : null, f,
    valores.length ? [`Calculado con ${valores.length} registro(s).`] : []);
}

/* ============================================================
 * 16. VARIACIÓN SEMANAL / MENSUAL DE UN INDICADOR
 * Compara el último valor con el valor más cercano (anterior o igual)
 * a `dias` días antes. Tasa = Δ / días transcurridos × 7 (por semana).
 * serie: [{ fecha: 'YYYY-MM-DD' | Date, valor: number }]
 * ============================================================ */
const MS_DIA = 86400000;

function variacionPeriodo(serie = [], dias = 7) {
  if (!Array.isArray(serie)) throw new ErrorValidacion('serie', 'serie debe ser una lista');
  const ventana = numero('dias', dias, { min: 1, max: 3650 });
  const puntos = serie
    .filter((p) => p && !esVacio(p.valor) && p.fecha)
    .map((p) => ({ t: new Date(p.fecha).getTime(), valor: Number(p.valor) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.valor))
    .sort((a, b) => a.t - b.t);

  const nombre = ventana === 7 ? 'semanal' : ventana === 30 ? 'mensual' : `${ventana} días`;
  if (puntos.length < 2) return resultado(`variación ${nombre}`, 'unidad del indicador', 'calculado', null, ['serie']);

  const ultimo = puntos[puntos.length - 1];
  const limite = ultimo.t - ventana * MS_DIA;
  const previos = puntos.filter((p) => p.t <= limite);
  const adv = [];
  let base = previos[previos.length - 1];
  if (!base) {
    base = puntos[0];
    adv.push(`No hay medición de hace ${ventana} días; se usa la más antigua disponible.`);
  }
  if (base === ultimo) return resultado(`variación ${nombre}`, 'unidad del indicador', 'calculado', null, ['serie']);

  const diasReales = (ultimo.t - base.t) / MS_DIA;
  const delta = ultimo.valor - base.valor;
  return resultado(`variación ${nombre}`, 'unidad del indicador', 'calculado', {
    delta: redondear(delta, 2),
    porcentaje: base.valor !== 0 ? redondear((delta / base.valor) * 100, 2) : null,
    diasComparados: redondear(diasReales, 1),
    tasaSemanal: redondear((delta / diasReales) * 7, 2),
  }, [], adv);
}

/* Catálogo para documentación / endpoint */
const REFERENCIAS = {
  imc: 'OMS. Obesity: preventing and managing the global epidemic. WHO TRS 894, 2000.',
  tmrMifflinStJeor: 'Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241-247.',
  gastoEnergeticoTotal: 'FAO/WHO/UNU. Human energy requirements. Food and Nutrition Technical Report 1, 2004.',
  relacionCinturaCadera: 'WHO. Waist circumference and waist–hip ratio: report of a WHO expert consultation, 2008.',
  relacionCinturaEstatura: 'Ashwell M, Gibson S. BMJ Open. 2016;6:e010159.',
  distribucionMacronutrientes: 'FAO. Food energy – methods of analysis and conversion factors. FNP 77, 2003 (Atwater).',
  requerimientoProteico: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. 2005.',
  hidratacionEstimada: 'Volkert D, et al. ESPEN guideline on clinical nutrition and hydration in geriatrics. Clin Nutr. 2019;38:10-47.',
};

module.exports = {
  VERSION_FORMULAS,
  REFERENCIAS,
  ErrorValidacion,
  PUNTAJE_ADHERENCIA,
  imc,
  categoriaImcOMS,
  tmrMifflinStJeor,
  gastoEnergeticoTotal,
  balanceEnergetico,
  cambioPesoPorcentual,
  relacionCinturaCadera,
  relacionCinturaEstatura,
  composicionCorporal,
  distribucionMacronutrientes,
  requerimientoProteico,
  hidratacionEstimada,
  progresoHaciaObjetivo,
  cumplimientoObjetivos,
  adherenciaPlan,
  promedioConsumoCalorico,
  variacionPeriodo,
};
