const mongoose = require('mongoose');

/**
 * Diagnóstico nutricional DOCUMENTADO POR EL PROFESIONAL (el sistema no genera
 * diagnósticos). Formato PES opcional: problema, etiología, signos y síntomas.
 * Se vincula con la evidencia que lo sustenta (evaluación, medición, laboratorio).
 */
const diagnosticoSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    consultaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consulta' },
    tipo: { type: String, enum: ['nutricional', 'medico_referido'], default: 'nutricional' },
    problema: { type: String, required: [true, 'Describe el problema / diagnóstico'], trim: true, maxlength: 500 },
    etiologia: { type: String, trim: true, maxlength: 500 },
    signosSintomas: { type: String, trim: true, maxlength: 1000 },
    codigo: { sistema: String, codigo: String, texto: String },
    evidencia: {
      evaluacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluacion' },
      medicionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicion' },
      laboratorioIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ResultadoLaboratorio' }],
    },
    estado: { type: String, enum: ['activo', 'en_mejora', 'resuelto', 'descartado'], default: 'activo' },
    fechaDiagnostico: { type: Date, default: Date.now },
    fechaResolucion: Date,
    profesionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    profesional: String,
    historial: [{ _id: false, fecha: { type: Date, default: Date.now }, usuario: String, estado: String, nota: String }],
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Diagnostico', diagnosticoSchema, 'diagnosticos');
