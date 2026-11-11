const mongoose = require('mongoose');
const { pluginCifrado } = require('../Services/seguridad/cifrado');

/**
 * Consulta (encuentro clínico) con nota SOAP.
 *  - borrador: editable, con autoguardado y registro de versiones.
 *  - firmada: inmutable. Se guarda un hash SHA-256 del contenido firmado.
 *  - Las correcciones posteriores son adendas (no se borra el original).
 * El contenido SOAP y las adendas se guardan cifrados.
 */
const adendaSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: ['aclaracion', 'correccion', 'complemento'], default: 'aclaracion' },
    texto: { type: String, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    autor: String,
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

const consultaSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    citaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cita' },
    fecha: { type: Date, required: [true, 'La fecha y hora de la consulta son obligatorias'] },
    tipo: { type: String, enum: ['primera_vez', 'subsecuente'], default: 'subsecuente' },
    motivo: { type: String, trim: true, maxlength: 300 },
    profesionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    profesional: String,

    soap: {
      subjetivo: { type: String, default: '' },
      objetivo: { type: String, default: '' },
      analisis: { type: String, default: '' },
      plan: { type: String, default: '' },
    },

    estado: { type: String, enum: ['borrador', 'firmada'], default: 'borrador', index: true },
    firma: {
      usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
      nombre: String,
      cedulaProfesional: String,
      fecha: Date,
      hash: String,
    },
    versiones: [{ _id: false, numero: Number, fecha: Date, usuarioId: mongoose.Schema.Types.ObjectId, campos: [String], autoguardado: Boolean }],
    adendas: [adendaSchema],
  },
  { timestamps: true, versionKey: false }
);

consultaSchema.index({ pacienteId: 1, fecha: -1 });
consultaSchema.plugin(pluginCifrado, {
  rutas: ['soap.subjetivo', 'soap.objetivo', 'soap.analisis', 'soap.plan', 'adendas.texto'],
});

module.exports = mongoose.model('Consulta', consultaSchema, 'consultas');
