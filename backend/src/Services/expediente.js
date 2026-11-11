/**
 * Integra el motor de fórmulas con el expediente guardado en MongoDB:
 * busca el contexto de una medición (paciente, prescripción vigente,
 * peso inicial) y guarda la evaluación con la versión de fórmulas.
 */
const Paciente = require('../Models/Paciente');
const Medicion = require('../Models/Medicion');
const Prescripcion = require('../Models/Prescripcion');
const Evaluacion = require('../Models/Evaluacion');
const { evaluarMedicion } = require('./nutricion/evaluacion');
const { VERSION_FORMULAS } = require('./nutricion/formulas');
const { edadEnFecha } = require('../Models/Paciente');

/** Prescripción aplicable en una fecha: la más reciente con fechaInicio ≤ fecha. */
function prescripcionEnFecha(pacienteId, fecha) {
  return Prescripcion.findOne({ pacienteId, fechaInicio: { $lte: fecha } })
    .sort({ fechaInicio: -1, createdAt: -1 })
    .lean();
}

/** Peso inicial: el registrado en el alta o, si no existe, la primera medición vigente con peso. */
async function pesoInicial(paciente) {
  if (paciente.peso) return { valor: paciente.peso, fuente: 'registro del paciente' };
  const primera = await Medicion.findOne({ pacienteId: paciente._id, vigente: true, pesoKg: { $ne: null } })
    .sort({ fecha: 1 })
    .select('pesoKg fecha')
    .lean();
  return primera ? { valor: primera.pesoKg, fuente: 'primera medición' } : { valor: null, fuente: null };
}

/** Calcula y guarda la evaluación de una versión de medición. */
async function evaluarYGuardar(medicion) {
  const registro = await Paciente.findById(medicion.pacienteId).lean();
  // Edad cumplida EN LA FECHA DE LA MEDICIÓN (si hay fecha de nacimiento)
  const paciente = { ...registro, edad: registro.fechaNacimiento ? edadEnFecha(registro.fechaNacimiento, medicion.fecha) : registro.edad };
  const prescripcion = await prescripcionEnFecha(medicion.pacienteId, medicion.fecha);
  const inicial = await pesoInicial(paciente);

  const resultados = evaluarMedicion({ paciente, medicion, prescripcion, pesoInicialKg: inicial.valor });

  return Evaluacion.create({
    pacienteId: medicion.pacienteId,
    medicionId: medicion._id,
    prescripcionId: prescripcion?._id,
    fecha: medicion.fecha,
    versionFormulas: VERSION_FORMULAS,
    entradas: {
      edad: paciente.edad ?? null,
      sexo: paciente.sexo ?? null,
      estaturaCm: medicion.estaturaCm ?? paciente.estatura ?? null,
      pesoInicialKg: inicial.valor,
      fuentePesoInicial: inicial.fuente,
      prescripcionFechaInicio: prescripcion?.fechaInicio ?? null,
    },
    resultados,
  });
}

module.exports = { prescripcionEnFecha, pesoInicial, evaluarYGuardar };
