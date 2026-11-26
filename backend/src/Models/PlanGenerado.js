const mongoose = require('mongoose');

/**
 * Plan alimentario generado automáticamente (colección `planes_generados`).
 * Guarda una COPIA de cada platillo (nombre, ingredientes, alérgenos, porción) y del perfil usado,
 * para que el plan no cambie si después se edita el catálogo o las preferencias.
 * Ciclo: borrador → aprobado (visible en el portal del paciente) → archivado.
 * Solo el personal clínico aprueba; un plan aprobado no se modifica: se regenera uno nuevo.
 */
const ESTADOS_PLAN = ['borrador', 'aprobado', 'archivado'];

const comidaSchema = new mongoose.Schema({
  tiempo: { type: String, required: true },
  etiquetaTiempo: String,
  platilloClave: { type: String, required: true },
  nombre: { type: String, required: true },
  ingredientes: [{ _id: false, alimento: String, cantidad: String }],
  alergenos: [String],
  contiene: [String],
  etiquetas: [String],
  proteina: String,
  validado: { type: Boolean, default: false }, // el platillo estaba validado por un profesional al generar
  kcalBase: Number,
  objetivoKcal: Number,
  porcion: { type: Number, min: 0.5, max: 2.5, required: true },
  kcal: Number,
  fijada: { type: Boolean, default: false },
}, { _id: false });

const planGeneradoSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    estado: { type: String, enum: ESTADOS_PLAN, default: 'borrador', index: true },
    semilla: { type: Number, required: true },
    kcalObjetivo: { type: Number, required: true },
    distribucion: [{ _id: false, tiempo: String, etiqueta: String, porcentaje: Number }],
    dias: [{ _id: false, dia: String, kcal: Number, comidas: [comidaSchema] }],
    exclusiones: [{ _id: false, motivo: String, cantidad: Number }],
    advertencias: [String],
    // Copia de lo que se usó para generar (tipo de alimentación, restricciones, alérgenos detectados…)
    perfil: { type: mongoose.Schema.Types.Mixed, default: {} },
    platillosAptos: Number,
    generadoPor: { usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }, nombre: String },
    aprobadoPor: { usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }, nombre: String },
    aprobadoEn: Date,
    notaRevision: { type: String, trim: true, maxlength: 2000 },
    historial: [{ _id: false, fecha: { type: Date, default: Date.now }, usuario: String, accion: String, detalle: String }],
  },
  { timestamps: true, versionKey: false }
);

planGeneradoSchema.index({ pacienteId: 1, estado: 1, createdAt: -1 });
// Garantía en la base: un solo plan aprobado por paciente
planGeneradoSchema.index({ pacienteId: 1, estado: 1 }, { unique: true, partialFilterExpression: { estado: 'aprobado' }, name: 'un_aprobado_por_paciente' });

module.exports = mongoose.model('PlanGenerado', planGeneradoSchema, 'planes_generados');
module.exports.ESTADOS_PLAN = ESTADOS_PLAN;
