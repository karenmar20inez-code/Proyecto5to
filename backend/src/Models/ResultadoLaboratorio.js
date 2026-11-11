const mongoose = require('mongoose');

/**
 * Resultado de laboratorio con su procedencia y el rango de referencia
 * IMPRESO POR EL LABORATORIO (no se inventan rangos). Correcciones = nueva versión.
 */
const resultadoSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    consultaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consulta' },
    fechaMuestra: { type: Date, required: [true, 'La fecha de toma de muestra es obligatoria'] },
    analito: { type: String, required: [true, 'El analito es obligatorio'], trim: true }, // clave del catálogo interno
    nombre: { type: String, required: true, trim: true },
    valor: { type: Number, required: [true, 'El valor es obligatorio'] },
    unidad: { type: String, required: [true, 'La unidad es obligatoria'], trim: true },
    rangoReferencia: {
      min: Number,
      max: Number,
      texto: { type: String, trim: true, maxlength: 120 },
    },
    procedencia: { type: String, required: [true, 'Indica el laboratorio o la procedencia'], trim: true, maxlength: 150 },
    metodo: { type: String, trim: true, maxlength: 120 },
    ayuno: { type: Boolean },
    observaciones: { type: String, trim: true, maxlength: 1000 },
    origen: { type: String, enum: ['captura', 'migracion'], default: 'captura' },
    origenMedicionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicion' },

    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    registradoPorNombre: String,
    grupoId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, default: 1 },
    vigente: { type: Boolean, default: true },
    motivoCambio: String,
  },
  { timestamps: true, versionKey: false }
);

resultadoSchema.index({ pacienteId: 1, vigente: 1, analito: 1, fechaMuestra: 1 });
resultadoSchema.pre('validate', function validarRango() {
  const r = this.rangoReferencia || {};
  if (r.min != null && r.max != null && r.min > r.max) this.invalidate('rangoReferencia', 'El mínimo no puede ser mayor que el máximo');
  if (this.fechaMuestra && this.fechaMuestra.getTime() > Date.now() + 86400000) this.invalidate('fechaMuestra', 'La fecha no puede ser futura');
});

/** Fuera del rango de referencia del propio laboratorio: 'bajo' | 'alto' | null */
resultadoSchema.statics.fueraDeRango = (r) => {
  const ref = r.rangoReferencia || {};
  if (ref.min != null && r.valor < ref.min) return 'bajo';
  if (ref.max != null && r.valor > ref.max) return 'alto';
  return null;
};

module.exports = mongoose.model('ResultadoLaboratorio', resultadoSchema, 'laboratorios');
