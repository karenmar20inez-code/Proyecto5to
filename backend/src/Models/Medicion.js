const mongoose = require('mongoose');

/**
 * Medición clínica fechada (antropometría, composición corporal,
 * laboratorio, hidratación, actividad física y consumo registrado).
 *
 * Inmutable: una corrección crea una NUEVA versión del mismo `grupoId`
 * y marca la anterior como no vigente. Nada se sobrescribe ni se borra.
 */

/* Unidades fijas de cada campo (se devuelven al cliente para trazabilidad) */
const UNIDADES = {
  pesoKg: 'kg',
  estaturaCm: 'cm',
  cinturaCm: 'cm',
  caderaCm: 'cm',
  grasaPorcentaje: '%',
  masaMuscularKg: 'kg',
  presionSistolica: 'mmHg',
  presionDiastolica: 'mmHg',
  glucosaMgDl: 'mg/dL',
  colesterolTotalMgDl: 'mg/dL',
  hdlMgDl: 'mg/dL',
  ldlMgDl: 'mg/dL',
  trigliceridosMgDl: 'mg/dL',
  hba1cPct: '%',
  aguaMl: 'ml/día',
  actividadMinutos: 'min/día',
  consumoKcal: 'kcal/día',
};

const CAMPOS_VALOR = Object.keys(UNIDADES);

const METODOS = {
  peso: ['bascula_digital', 'bascula_mecanica', 'bioimpedancia', 'autorreporte', 'otro'],
  composicion: ['bioimpedancia', 'plicometria', 'dexa', 'otro'],
  circunferencias: ['cinta_metrica', 'otro'],
  laboratorio: ['laboratorio_clinico', 'glucometro', 'baumanometro', 'otro'],
  registro: ['consulta', 'autorreporte', 'recordatorio_24h', 'otro'],
};

const num = (min, max, etiqueta) => ({
  type: Number,
  min: [min, `${etiqueta} debe ser ≥ ${min}`],
  max: [max, `${etiqueta} debe ser ≤ ${max}`],
});

const metodo = (lista) => ({ type: String, enum: { values: lista, message: 'Método no válido' } });

const medicionSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    fecha: { type: Date, required: [true, 'La fecha de la medición es obligatoria'] },
    consultaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consulta', index: true },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },

    // Valores medidos (todos opcionales; se exige al menos uno)
    pesoKg: num(1, 400, 'El peso'),
    estaturaCm: num(30, 250, 'La estatura'),
    cinturaCm: num(20, 300, 'La cintura'),
    caderaCm: num(20, 300, 'La cadera'),
    grasaPorcentaje: num(1, 75, 'El % de grasa'),
    masaMuscularKg: num(1, 200, 'La masa muscular'),
    presionSistolica: num(50, 300, 'La presión sistólica'),
    presionDiastolica: num(30, 200, 'La presión diastólica'),
    glucosaMgDl: num(10, 1000, 'La glucosa'),
    colesterolTotalMgDl: num(50, 1000, 'El colesterol total'),
    hdlMgDl: num(5, 200, 'El HDL'),
    ldlMgDl: num(5, 600, 'El LDL'),
    trigliceridosMgDl: num(10, 5000, 'Los triglicéridos'),
    hba1cPct: num(2, 20, 'La HbA1c'),
    aguaMl: num(0, 15000, 'El agua'),
    actividadMinutos: num(0, 1440, 'La actividad física'),
    actividadTipo: { type: String, trim: true, maxlength: 80 },
    consumoKcal: num(0, 15000, 'El consumo energético'),

    metodos: {
      peso: metodo(METODOS.peso),
      composicion: metodo(METODOS.composicion),
      circunferencias: metodo(METODOS.circunferencias),
      laboratorio: metodo(METODOS.laboratorio),
      registro: metodo(METODOS.registro),
    },
    notas: { type: String, trim: true, maxlength: 2000 },

    // Trazabilidad
    responsable: { type: String, required: true, trim: true },
    grupoId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, default: 1, min: 1 },
    vigente: { type: Boolean, default: true, index: true },
    reemplazadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicion' },
    motivoCambio: { type: String, trim: true, maxlength: 500 },
    anulada: { type: Boolean, default: false },
    anulacion: {
      fecha: Date,
      responsable: String,
      motivo: { type: String, trim: true, maxlength: 500 },
    },
  },
  { timestamps: true, versionKey: false }
);

medicionSchema.index({ pacienteId: 1, vigente: 1, fecha: 1 });

medicionSchema.pre('validate', function exigirAlMenosUnValor() {
  const tieneValor = CAMPOS_VALOR.some((c) => this[c] !== undefined && this[c] !== null);
  if (!tieneValor) {
    this.invalidate('valores', 'La medición debe incluir al menos un valor');
  }
  if (this.fecha && this.fecha.getTime() > Date.now() + 86400000) {
    this.invalidate('fecha', 'La fecha de la medición no puede ser futura');
  }
});

module.exports = mongoose.model('Medicion', medicionSchema, 'mediciones');
module.exports.UNIDADES = UNIDADES;
module.exports.CAMPOS_VALOR = CAMPOS_VALOR;
module.exports.METODOS = METODOS;
