/**
 * Aplica el motor de fórmulas a una medición del expediente.
 * No accede a la base de datos: recibe los datos ya cargados.
 *
 * Cada indicador queda con su `origen`:
 *   - 'medido'    → valor capturado directamente
 *   - 'calculado' → operación aritmética sobre datos medidos
 *   - 'estimado'  → ecuación predictiva (ajustable por el nutriólogo)
 *   - 'prescrito' → definido por el nutriólogo en la prescripción
 */
const F = require('./formulas');

/* Ejecuta una fórmula sin romper la evaluación completa si un dato es inválido */
function seguro(fn, ...args) {
  try {
    const r = fn(...args);
    return { ...r, origen: r.tipo };
  } catch (error) {
    if (error instanceof F.ErrorValidacion) {
      return { valor: null, origen: 'error', error: error.message, campo: error.campo, faltantes: [], advertencias: [] };
    }
    throw error;
  }
}

/**
 * @param {object} p
 * @param {object} p.paciente      Documento de paciente (edad, sexo, estatura, peso inicial)
 * @param {object} p.medicion      Medición a evaluar
 * @param {object} [p.prescripcion] Prescripción vigente a la fecha de la medición
 * @param {number} [p.pesoInicialKg] Peso de referencia inicial (primera medición o registro)
 */
function evaluarMedicion({ paciente = {}, medicion = {}, prescripcion = null, pesoInicialKg = null }) {
  const estaturaCm = medicion.estaturaCm ?? paciente.estatura ?? null;
  const pesoKg = medicion.pesoKg ?? null;
  const pr = prescripcion || {};

  const imc = seguro(F.imc, { pesoKg, estaturaCm, edad: paciente.edad });
  if (imc.valor !== null) imc.categoriaReferencia = F.categoriaImcOMS(imc.valor);

  const tmr = seguro(F.tmrMifflinStJeor, { pesoKg, estaturaCm, edad: paciente.edad, sexo: paciente.sexo });
  const get = seguro(F.gastoEnergeticoTotal, { tmrKcal: tmr.valor, factorActividad: pr.factorActividad });

  return {
    imc,
    tmr,
    get,
    balanceEnergetico: seguro(F.balanceEnergetico, { consumoKcal: medicion.consumoKcal, gastoKcal: get.valor }),
    cambioPeso: seguro(F.cambioPesoPorcentual, { pesoInicialKg, pesoActualKg: pesoKg }),
    relacionCinturaCadera: seguro(F.relacionCinturaCadera, { cinturaCm: medicion.cinturaCm, caderaCm: medicion.caderaCm }),
    relacionCinturaEstatura: seguro(F.relacionCinturaEstatura, { cinturaCm: medicion.cinturaCm, estaturaCm }),
    composicion: seguro(F.composicionCorporal, { pesoKg, grasaPorcentaje: medicion.grasaPorcentaje }),
    macronutrientes: seguro(F.distribucionMacronutrientes, {
      kcal: pr.kcalObjetivo,
      proteinasPct: pr.proteinasPct,
      carbohidratosPct: pr.carbohidratosPct,
      grasasPct: pr.grasasPct,
    }),
    requerimientoProteico: seguro(F.requerimientoProteico, { pesoKg, gramosPorKg: pr.proteinaGKg }),
    hidratacion: seguro(F.hidratacionEstimada, { pesoKg, mlPorKg: pr.aguaMlKg ?? 35 }),
    progresoPeso: seguro(F.progresoHaciaObjetivo, {
      valorInicial: pesoInicialKg,
      valorActual: pesoKg,
      valorObjetivo: pr.pesoObjetivoKg,
    }),
  };
}

/** Aplica los ajustes manuales del nutriólogo sin perder el valor original. */
function resultadosConAjustes(resultados = {}, ajustes = []) {
  const finales = JSON.parse(JSON.stringify(resultados));
  ajustes
    .filter((a) => a.vigente !== false)
    .forEach((a) => {
      if (!finales[a.indicador]) return;
      finales[a.indicador] = {
        ...finales[a.indicador],
        valorOriginal: finales[a.indicador].valor,
        valor: a.valor,
        origen: 'ajustado',
        ajuste: { motivo: a.motivo, responsable: a.responsable, fecha: a.fecha },
      };
    });
  return finales;
}

module.exports = { evaluarMedicion, resultadosConAjustes };
