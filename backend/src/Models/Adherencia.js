const mongoose = require('mongoose');

const ESTADOS_ADHERENCIA = ['cumplio', 'parcial', 'no'];

/**
 * Cumplimiento de un tiempo de comida de un plan en una fecha.
 * Un documento por (paciente, dieta, fecha, tiempo). Cada cambio se
 * guarda en `historial`; `estado: null` significa "sin registro".
 */
const adherenciaSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true },
    dietaId: { type: String, required: true, trim: true },
    fecha: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'Fecha con formato AAAA-MM-DD'] },
    tiempo: { type: String, required: true, trim: true, maxlength: 40 },
    estado: { type: String, enum: [...ESTADOS_ADHERENCIA, null], default: null },
    historial: [
      {
        _id: false,
        estado: { type: String, enum: [...ESTADOS_ADHERENCIA, null] },
        fecha: { type: Date, default: Date.now },
        responsable: String,
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

adherenciaSchema.index({ pacienteId: 1, dietaId: 1, fecha: 1, tiempo: 1 }, { unique: true });

module.exports = mongoose.model('Adherencia', adherenciaSchema, 'adherencias');
module.exports.ESTADOS_ADHERENCIA = ESTADOS_ADHERENCIA;
