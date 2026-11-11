const mongoose = require('mongoose');

/**
 * Resultado de aplicar el motor de fórmulas a una versión de medición.
 * Guarda los datos de entrada usados y la versión de las fórmulas,
 * de modo que cada número es reproducible.
 * Los ajustes del nutriólogo se agregan sin borrar el valor calculado.
 */
const ajusteSchema = new mongoose.Schema(
  {
    indicador: { type: String, required: true, trim: true },
    valor: { type: mongoose.Schema.Types.Mixed, required: true },
    motivo: { type: String, required: [true, 'El motivo del ajuste es obligatorio'], trim: true, maxlength: 500 },
    responsable: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
    vigente: { type: Boolean, default: true },
  },
  { _id: true }
);

const evaluacionSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    medicionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicion', required: true, index: true },
    prescripcionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescripcion' },
    fecha: { type: Date, required: true },
    versionFormulas: { type: String, required: true },
    entradas: { type: mongoose.Schema.Types.Mixed, default: {} },
    resultados: { type: mongoose.Schema.Types.Mixed, default: {} },
    ajustes: [ajusteSchema],
    vigente: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

evaluacionSchema.index({ pacienteId: 1, vigente: 1, fecha: 1 });

module.exports = mongoose.model('Evaluacion', evaluacionSchema, 'evaluaciones');
