const mongoose = require('mongoose');

/** Indicadores que el sistema puede medir automáticamente */
const INDICADORES = {
  pesoKg: { nombre: 'Peso', unidad: 'kg', fuente: 'medicion' },
  cinturaCm: { nombre: 'Cintura', unidad: 'cm', fuente: 'medicion' },
  grasaPorcentaje: { nombre: 'Grasa corporal', unidad: '%', fuente: 'medicion' },
  masaMuscularKg: { nombre: 'Masa muscular', unidad: 'kg', fuente: 'medicion' },
  imc: { nombre: 'IMC', unidad: 'kg/m²', fuente: 'evaluacion' },
  adherencia: { nombre: 'Adherencia al plan', unidad: '%', fuente: 'adherencia' },
  laboratorio: { nombre: 'Resultado de laboratorio', unidad: '', fuente: 'laboratorio' },
  cualitativo: { nombre: 'Objetivo cualitativo', unidad: '', fuente: 'revision' },
};

/**
 * Objetivo terapéutico ligado a su diagnóstico, con indicador, valores,
 * periodo y revisiones periódicas del profesional.
 */
const objetivoSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    diagnosticoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Diagnostico' },
    descripcion: { type: String, required: [true, 'Describe el objetivo'], trim: true, maxlength: 300 },
    indicador: { type: String, enum: { values: Object.keys(INDICADORES), message: 'Indicador no válido' }, required: true },
    analito: { type: String, trim: true }, // cuando indicador = laboratorio
    valorInicial: Number,
    valorMeta: Number,
    unidad: { type: String, trim: true },
    periodo: {
      inicio: { type: Date, required: [true, 'Fecha de inicio obligatoria'] },
      fin: Date,
    },
    frecuenciaRevisionDias: { type: Number, min: 1, max: 365, default: 30 },
    estado: { type: String, enum: ['activo', 'logrado', 'no_logrado', 'suspendido'], default: 'activo' },
    revisiones: [{
      fecha: { type: Date, default: Date.now },
      usuarioId: mongoose.Schema.Types.ObjectId,
      usuario: String,
      valorObservado: Number,
      avance: Number,
      comentario: { type: String, maxlength: 1000 },
    }],
    profesionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
  { timestamps: true, versionKey: false }
);

objetivoSchema.pre('validate', function validar() {
  if (this.indicador !== 'cualitativo' && (this.valorMeta === undefined || this.valorMeta === null)) {
    this.invalidate('valorMeta', 'Indica el valor meta del indicador');
  }
  if (this.indicador === 'laboratorio' && !this.analito) this.invalidate('analito', 'Indica el analito');
  if (this.periodo?.fin && this.periodo?.inicio && this.periodo.fin < this.periodo.inicio) {
    this.invalidate('periodo.fin', 'La fecha final debe ser posterior al inicio');
  }
});

module.exports = mongoose.model('Objetivo', objetivoSchema, 'objetivos');
module.exports.INDICADORES = INDICADORES;
