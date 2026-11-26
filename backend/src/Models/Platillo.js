const mongoose = require('mongoose');
const { TIEMPOS, ALERGENOS, KCAL_EQUIVALENTE } = require('../Services/nutricion/generadorDietas');

/**
 * Catálogo de platillos que usa el generador de planes (colección `platillos`).
 * Cada platillo guarda sus equivalentes del SMAE (las kcal se calculan a partir de ellos), los
 * alérgenos y lo que contiene (carnes, alcohol, miel) para que el filtro sea por etiqueta y por texto.
 * El catálogo inicial llega con `validado: false`: el nutriólogo lo revisa y lo marca como validado.
 * Los platillos no se borran: se desactivan (`activo: false`) para no romper los planes ya emitidos.
 */
const PROTEINAS = ['pollo', 'res', 'cerdo', 'pescado', 'mariscos', 'huevo', 'lacteo', 'leguminosa', 'ninguna'];
const CONTIENE = ['pollo', 'pavo', 'res', 'cerdo', 'alcohol', 'miel'];
const ETIQUETAS = ['rapido', 'sin-coccion', 'alto-sodio', 'azucar-anadida'];

const ingredienteSchema = new mongoose.Schema({
  alimento: { type: String, required: [true, 'Cada ingrediente necesita un alimento'], trim: true, maxlength: 120 },
  cantidad: { type: String, trim: true, maxlength: 80, default: '' },
}, { _id: false });

const equivalentesSchema = new mongoose.Schema(
  Object.fromEntries(Object.keys(KCAL_EQUIVALENTE).map((g) => [g, { type: Number, min: [0, 'Equivalentes no válidos'], max: [10, 'Equivalentes no válidos'], default: 0 }])),
  { _id: false }
);

const platilloSchema = new mongoose.Schema(
  {
    clave: {
      type: String, required: true, unique: true, trim: true, lowercase: true,
      match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Clave no válida'], maxlength: 60,
    },
    nombre: { type: String, required: [true, 'El nombre del platillo es obligatorio'], trim: true, minlength: 3, maxlength: 150 },
    tiempos: {
      type: [{ type: String, enum: { values: Object.keys(TIEMPOS), message: 'Tiempo de comida no válido' } }],
      validate: { validator: (t) => t.length >= 1, message: 'Indica al menos un tiempo de comida' },
    },
    proteina: { type: String, enum: { values: PROTEINAS, message: 'Fuente de proteína no válida' }, default: 'ninguna' },
    ingredientes: {
      type: [ingredienteSchema],
      validate: { validator: (i) => i.length >= 1 && i.length <= 25, message: 'El platillo necesita entre 1 y 25 ingredientes' },
    },
    equivalentes: { type: equivalentesSchema, default: () => ({}) },
    alergenos: [{ type: String, enum: { values: Object.keys(ALERGENOS), message: 'Alérgeno no válido' } }],
    contiene: [{ type: String, enum: { values: CONTIENE, message: 'Valor no válido en «contiene»' } }],
    etiquetas: [{ type: String, enum: { values: ETIQUETAS, message: 'Etiqueta no válida' } }],
    activo: { type: Boolean, default: true, index: true },
    validado: { type: Boolean, default: false },
    validadoPor: String,
    creadoPor: String,
    actualizadoPor: String,
  },
  { timestamps: true, versionKey: false }
);

platilloSchema.path('equivalentes').validate(function alMenosUnEquivalente(eq) {
  return Object.keys(KCAL_EQUIVALENTE).some((g) => Number(eq?.[g]) > 0);
}, 'Indica los equivalentes del platillo');

module.exports = mongoose.model('Platillo', platilloSchema, 'platillos');
module.exports.PROTEINAS = PROTEINAS;
module.exports.CONTIENE = CONTIENE;
module.exports.ETIQUETAS = ETIQUETAS;
