const mongoose = require('mongoose');
const { pluginCifrado } = require('../Services/seguridad/cifrado');
const { TIPOS_ALIMENTACION, RESTRICCIONES } = require('../Services/nutricion/generadorDietas');

/**
 * Preferencias alimentarias del paciente (colección `preferencias_alimentarias`, una por paciente).
 * Las captura el propio paciente desde su portal o el personal clínico. Las alergias e intolerancias
 * NO se guardan aquí: viven en los antecedentes (cifrados y versionados) y el generador las lee de ahí.
 * Cada cambio queda en `historial` (quién, cuándo, qué campos) y en la bitácora de auditoría.
 */
const lista = (etiqueta) => ({
  type: [{ type: String, trim: true, maxlength: [60, `Cada elemento de ${etiqueta} admite hasta 60 caracteres`] }],
  validate: { validator: (l) => l.length <= 30, message: `${etiqueta}: máximo 30 elementos` },
  default: [],
});

const preferenciasSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, unique: true },
    tipoAlimentacion: { type: String, enum: { values: Object.keys(TIPOS_ALIMENTACION), message: 'Tipo de alimentación no válido' } },
    numeroComidas: { type: Number, enum: { values: [3, 4, 5], message: 'El número de comidas debe ser 3, 4 o 5' } },
    restricciones: [{ type: String, enum: { values: Object.keys(RESTRICCIONES), message: 'Restricción no válida' } }],
    gustos: lista('alimentos que le gustan'),
    rechazos: lista('alimentos que no quiere'),
    preparacion: [{ type: String, enum: { values: ['rapido', 'sin-coccion'], message: 'Preferencia de preparación no válida' } }],
    // Alergias o intolerancias que el paciente reporta desde su portal: el generador SIEMPRE las trata
    // como restricciones; el nutriólogo debe confirmarlas en los antecedentes del expediente.
    alergiasReportadas: { type: String, trim: true, maxlength: 500 },
    notas: { type: String, trim: true, maxlength: 1000 },
    // El paciente pidió un plan desde su portal (el nutriólogo lo ve como pendiente)
    solicitudPlan: Date,
    actualizadoPor: String,
    origen: { type: String, enum: ['paciente', 'profesional'], default: 'profesional' },
    historial: [{ _id: false, fecha: { type: Date, default: Date.now }, usuario: String, origen: String, campos: [String] }],
  },
  { timestamps: true, versionKey: false }
);

preferenciasSchema.plugin(pluginCifrado, { rutas: ['notas', 'alergiasReportadas'] });

module.exports = mongoose.model('PreferenciasAlimentarias', preferenciasSchema, 'preferencias_alimentarias');
