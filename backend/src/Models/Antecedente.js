const mongoose = require('mongoose');
const { pluginCifrado } = require('../Services/seguridad/cifrado');

/** Categorías de la historia clínica (NOM-004 · historia clínica + valoración nutricional) */
const CATEGORIAS = {
  heredofamiliar: 'Heredofamiliares',
  personal_patologico: 'Personales patológicos',
  no_patologico: 'Personales no patológicos',
  enfermedad: 'Enfermedades diagnosticadas',
  alergia: 'Alergias',
  intolerancia: 'Intolerancias alimentarias',
  medicamento: 'Medicamentos',
  suplemento: 'Suplementos',
  cirugia: 'Cirugías',
  hospitalizacion: 'Hospitalizaciones',
  nutricional: 'Antecedentes nutricionales',
  habito_alimentario: 'Hábitos alimenticios',
  actividad_fisica: 'Actividad física',
  sueno: 'Sueño',
  alcohol: 'Consumo de alcohol',
  tabaco: 'Consumo de tabaco',
  ginecoobstetrico: 'Ginecoobstétricos',
};

const ESTADOS_ANTECEDENTE = ['activo', 'resuelto', 'suspendido', 'negado'];

/**
 * Antecedente estructurado y versionado: una actualización crea una nueva
 * versión del mismo `grupoId`; la ficha vigente usa `vigente: true`.
 * `detalle` guarda campos propios de la categoría (dosis, frecuencia,
 * parentesco, reacción, horas de sueño, gestas, etc.).
 */
const antecedenteSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    consultaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consulta' },
    categoria: { type: String, enum: { values: Object.keys(CATEGORIAS), message: 'Categoría no válida' }, required: true },
    descripcion: { type: String, required: [true, 'La descripción es obligatoria'], trim: true },
    codigo: { sistema: String, codigo: String, texto: String }, // referencia a catálogo (p. ej. CIE-10)
    detalle: { type: mongoose.Schema.Types.Mixed, default: {} },
    fechaInicio: Date,
    fechaFin: Date,
    estado: { type: String, enum: { values: ESTADOS_ANTECEDENTE, message: 'Estado no válido' }, default: 'activo' },
    observaciones: { type: String, trim: true },

    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    registradoPorNombre: String,
    grupoId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, default: 1 },
    vigente: { type: Boolean, default: true },
    motivoCambio: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false }
);

antecedenteSchema.index({ pacienteId: 1, vigente: 1, categoria: 1 });
antecedenteSchema.plugin(pluginCifrado, { rutas: ['descripcion', 'observaciones'] });

module.exports = mongoose.model('Antecedente', antecedenteSchema, 'antecedentes');
module.exports.CATEGORIAS = CATEGORIAS;
module.exports.ESTADOS_ANTECEDENTE = ESTADOS_ANTECEDENTE;
