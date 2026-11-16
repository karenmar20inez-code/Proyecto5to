const mongoose = require('mongoose');

const ESTADOS_EXPEDIENTE = ['abierto', 'en_seguimiento', 'alta', 'archivado'];

/**
 * Expediente clínico: uno por paciente. Concentra el folio, el profesional
 * responsable, el equipo con acceso y el estado del expediente.
 */
const expedienteSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, unique: true },
    folio: { type: String, required: true, unique: true, trim: true },
    estado: { type: String, enum: { values: ESTADOS_EXPEDIENTE, message: 'Estado no válido' }, default: 'abierto' },
    responsableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', index: true },
    equipoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
    fechaIngreso: { type: Date, default: Date.now },
    motivoConsulta: { type: String, trim: true, maxlength: 1000 },
    fechaUltimoActo: Date, // para la política de conservación (NOM-004: ≥ 5 años)
    /* Qué puede ver el propio paciente en su portal: todo cerrado hasta que su nutriólogo lo autorice.
       Nunca se muestran notas clínicas, diagnósticos, antecedentes ni laboratorios. */
    portal: {
      dieta: { type: Boolean, default: false },            // dieta asignada
      recomendaciones: { type: Boolean, default: false },  // recomendaciones del plan vigente
      citas: { type: Boolean, default: false },            // sus citas
      progreso: { type: Boolean, default: false },         // peso, IMC, cintura, % grasa, masa muscular
      cumplimiento: { type: Boolean, default: false },     // su registro de cumplimiento de la dieta
      indicadoresClinicos: { type: Boolean, default: false }, // presión, glucosa, lípidos, HbA1c (requiere autorización expresa)
    },
    historial: [{
      _id: false, fecha: { type: Date, default: Date.now }, usuarioId: mongoose.Schema.Types.ObjectId, campos: [String],
    }],
  },
  { timestamps: true, versionKey: false }
);

expedienteSchema.index({ equipoIds: 1 });

/** Folio legible y único: LN-AAAA-NNNNNN */
expedienteSchema.statics.siguienteFolio = async function siguienteFolio() {
  const anio = new Date().getFullYear();
  const ultimo = await this.findOne({ folio: new RegExp(`^LN-${anio}-`) }).sort({ folio: -1 }).select('folio').lean();
  const n = ultimo ? Number(ultimo.folio.split('-')[2]) + 1 : 1;
  return `LN-${anio}-${String(n).padStart(6, '0')}`;
};

module.exports = mongoose.model('Expediente', expedienteSchema, 'expedientes');
module.exports.CLAVES_PORTAL = ['dieta', 'recomendaciones', 'citas', 'progreso', 'cumplimiento', 'indicadoresClinicos'];
module.exports.ESTADOS_EXPEDIENTE = ESTADOS_EXPEDIENTE;
