const F = require('../Services/nutricion/formulas');
const { evaluarMedicion } = require('../Services/nutricion/evaluacion');
const { UNIDADES } = require('../Models/Medicion');
const { controlador } = require('../Services/http');

// GET /api/calculos/formulas  → versión, referencias y unidades
const formulas = controlador(async (req, res) => {
  res.json({ version: F.VERSION_FORMULAS, referencias: F.REFERENCIAS, unidades: UNIDADES });
});

// POST /api/calculos/evaluar  → vista previa (no guarda nada)
// { paciente: { edad, sexo, estatura }, medicion: {...}, prescripcion: {...}, pesoInicialKg }
const evaluar = controlador(async (req, res) => {
  const { paciente = {}, medicion = {}, prescripcion = null, pesoInicialKg = null } = req.body || {};
  res.json({
    versionFormulas: F.VERSION_FORMULAS,
    resultados: evaluarMedicion({ paciente, medicion, prescripcion, pesoInicialKg }),
  });
});

module.exports = { formulas, evaluar };
