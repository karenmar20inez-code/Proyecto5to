const mongoose = require('mongoose');

/**
 * Catálogo de dietas (menús semanales) que se asignan a los pacientes.
 * `clave` es el identificador estable que guardan Paciente.dietaId,
 * PlanNutricional.dietaId y Adherencia.dietaId (p. ej. "semana-2"); no cambia al editar.
 * Las dietas no se borran: se archivan (`activa: false`) para no romper
 * el historial de cumplimiento ni los planes emitidos.
 */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const ingredienteSchema = new mongoose.Schema({
  alimento: { type: String, required: [true, 'Cada ingrediente necesita un alimento'], trim: true, maxlength: 120 },
  cantidad: { type: String, trim: true, maxlength: 80, default: '' },
}, { _id: false });

const comidaSchema = new mongoose.Schema({
  tiempo: { type: String, required: [true, 'Indica el tiempo de comida'], trim: true, maxlength: 40 },
  platillo: { type: String, trim: true, maxlength: 150, default: null },
  pendiente: { type: String, trim: true, maxlength: 300 },
  ingredientes: { type: [ingredienteSchema], default: [] },
}, { _id: false });

const diaSchema = new mongoose.Schema({
  dia: { type: String, required: [true, 'Cada día necesita un nombre'], trim: true, maxlength: 20 },
  fecha: { type: String, required: [true, 'Cada día necesita una fecha'], match: [FECHA, 'Fecha no válida (AAAA-MM-DD)'] },
  comidas: { type: [comidaSchema], default: [] },
  pendiente: { type: String, trim: true, maxlength: 300 },
}, { _id: false });

const dietaSchema = new mongoose.Schema(
  {
    clave: {
      type: String, required: true, unique: true, trim: true, lowercase: true,
      match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Clave no válida'], maxlength: 60,
    },
    nombre: { type: String, required: [true, 'El nombre de la dieta es obligatorio'], trim: true, minlength: 3, maxlength: 120 },
    inicio: { type: String, required: [true, 'La fecha de inicio es obligatoria'], match: [FECHA, 'Fecha no válida (AAAA-MM-DD)'] },
    fin: { type: String, required: [true, 'La fecha de fin es obligatoria'], match: [FECHA, 'Fecha no válida (AAAA-MM-DD)'] },
    nota: { type: String, trim: true, maxlength: 1000 },
    dias: {
      type: [diaSchema],
      validate: { validator: (d) => d.length >= 1 && d.length <= 14, message: 'La dieta debe tener entre 1 y 14 días' },
    },
    activa: { type: Boolean, default: true, index: true },
    creadoPor: String,
    actualizadoPor: String,
  },
  { timestamps: true, versionKey: false }
);

dietaSchema.path('fin').validate(function validarFin(fin) {
  return !this.inicio || !fin || fin >= this.inicio;
}, 'La fecha de fin no puede ser anterior al inicio');

module.exports = mongoose.model('Dieta', dietaSchema, 'dietas');
