const mongoose = require('mongoose');

/**
 * Prescripción definida por el nutriólogo (valores PRESCRITOS).
 * Cada cambio crea un documento nuevo; el anterior queda como histórico
 * (vigente = false). Se aplica desde `fechaInicio`.
 */
const num = (min, max, etiqueta) => ({
  type: Number,
  min: [min, `${etiqueta} debe ser ≥ ${min}`],
  max: [max, `${etiqueta} debe ser ≤ ${max}`],
});

const prescripcionSchema = new mongoose.Schema(
  {
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: true, index: true },
    fechaInicio: { type: Date, required: [true, 'La fecha de inicio es obligatoria'] },

    pesoObjetivoKg: num(1, 400, 'El peso objetivo'),
    cinturaObjetivoCm: num(20, 300, 'La cintura objetivo'),
    grasaObjetivoPct: num(1, 75, 'El % de grasa objetivo'),
    kcalObjetivo: num(500, 10000, 'La energía prescrita'),
    factorActividad: num(1, 2.5, 'El factor de actividad'),
    proteinasPct: num(0, 100, 'El % de proteínas'),
    carbohidratosPct: num(0, 100, 'El % de carbohidratos'),
    grasasPct: num(0, 100, 'El % de grasas'),
    proteinaGKg: num(0.3, 3.5, 'La proteína por kg'),
    aguaMlKg: num(20, 50, 'El agua por kg'),
    aguaObjetivoMl: num(0, 15000, 'El agua objetivo'),
    actividadObjetivoMinSemana: num(0, 5000, 'La actividad objetivo'),
    notas: { type: String, trim: true, maxlength: 2000 },

    responsable: { type: String, required: true, trim: true },
    vigente: { type: Boolean, default: true, index: true },
    reemplazadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescripcion' },
  },
  { timestamps: true, versionKey: false }
);

prescripcionSchema.pre('validate', function validarMacros() {
  const macros = [this.proteinasPct, this.carbohidratosPct, this.grasasPct];
  const definidos = macros.filter((m) => m !== undefined && m !== null);
  if (definidos.length && definidos.length < 3) {
    this.invalidate('macronutrientes', 'Indica los tres porcentajes de macronutrientes o ninguno');
  } else if (definidos.length === 3) {
    const suma = definidos.reduce((a, b) => a + b, 0);
    if (Math.abs(suma - 100) > 0.5) {
      this.invalidate('macronutrientes', `Los porcentajes deben sumar 100 % (suman ${suma} %)`);
    }
  }
});

module.exports = mongoose.model('Prescripcion', prescripcionSchema, 'prescripciones');
