const mongoose = require('mongoose');

const ESTADOS_CITA = ['programada', 'realizada', 'cancelada', 'no_asistio'];

const cambioEstadoSchema = new mongoose.Schema(
  {
    estado: { type: String, enum: ESTADOS_CITA, required: true },
    fecha: { type: Date, default: Date.now },
    responsable: { type: String, required: true },
    motivo: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

/** Consulta programada. Los cambios de estado se acumulan en `historialEstados`. */
const citaSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    fechaHora: { type: Date, required: [true, 'La fecha y hora de la cita son obligatorias'], index: true },
    duracionMin: { type: Number, min: 5, max: 480, default: 45 },
    motivo: { type: String, trim: true, maxlength: 200 },
    notas: { type: String, trim: true, maxlength: 2000 },
    estado: {
      type: String,
      enum: { values: ESTADOS_CITA, message: 'Estado de cita no válido' },
      default: 'programada',
      index: true,
    },
    historialEstados: [cambioEstadoSchema],
    responsable: { type: String, required: true, trim: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Cita', citaSchema, 'citas');
module.exports.ESTADOS_CITA = ESTADOS_CITA;
