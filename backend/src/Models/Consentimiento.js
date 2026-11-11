const mongoose = require('mongoose');

const TIPOS_CONSENTIMIENTO = {
  aviso_privacidad: 'Aviso de privacidad entregado',
  datos_sensibles: 'Consentimiento expreso para datos de salud',
  atencion_nutricional: 'Consentimiento informado de atención',
  comunicaciones: 'Recordatorios y comunicaciones',
};

/**
 * Registro de consentimiento. La LFPDPPP (DOF 20/03/2025) exige consentimiento
 * expreso y por escrito para datos sensibles (salud). Nunca se borra: se revoca.
 */
const consentimientoSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    tipo: { type: String, enum: Object.keys(TIPOS_CONSENTIMIENTO), required: true },
    versionDocumento: { type: String, required: [true, 'Indica la versión del documento'], trim: true, maxlength: 40 },
    fecha: { type: Date, required: true, default: Date.now },
    medio: { type: String, enum: ['firma_autografa', 'firma_electronica', 'medio_electronico'], required: true },
    otorgado: { type: Boolean, default: true },
    revocacion: { fecha: Date, motivo: String, usuario: String },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    observaciones: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Consentimiento', consentimientoSchema, 'consentimientos');
module.exports.TIPOS_CONSENTIMIENTO = TIPOS_CONSENTIMIENTO;
