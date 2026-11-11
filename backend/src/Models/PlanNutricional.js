const mongoose = require('mongoose');

/**
 * Plan nutricional ligado a objetivos y a la prescripción de requerimientos.
 * Guarda un snapshot de los requerimientos al emitirse para que el plan
 * histórico no cambie si después se modifica la prescripción.
 */
const planSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    consultaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consulta' },
    nombre: { type: String, required: [true, 'El nombre del plan es obligatorio'], trim: true, maxlength: 150 },
    vigencia: {
      inicio: { type: Date, required: [true, 'Fecha de inicio obligatoria'] },
      fin: Date,
    },
    objetivoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Objetivo' }],
    prescripcionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescripcion' },
    requerimientos: {
      kcal: Number,
      proteinasPct: Number,
      carbohidratosPct: Number,
      grasasPct: Number,
      proteinaGKg: Number,
      aguaObjetivoMl: Number,
      getEstimadoKcal: Number,
      versionFormulas: String,
      fechaCalculo: Date,
    },
    dietaId: { type: String, trim: true }, // menú del catálogo de dietas
    // Alimentos del menú al emitir el plan (permite revisar alergias sin depender del catálogo del frontend)
    alimentos: [{ type: String, trim: true }],
    recomendaciones: { type: String, trim: true, maxlength: 4000 },
    estado: { type: String, enum: ['borrador', 'vigente', 'finalizado', 'reemplazado'], default: 'borrador', index: true },
    profesionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    profesional: String,
    historial: [{ _id: false, fecha: { type: Date, default: Date.now }, usuario: String, accion: String, campos: [String] }],
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('PlanNutricional', planSchema, 'planes');
