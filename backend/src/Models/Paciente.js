const mongoose = require('mongoose');
const { pluginCifrado, estaCifrado } = require('../Services/seguridad/cifrado');

const ESTADOS = ['activo', 'baja'];
const SEXOS = ['Femenino', 'Masculino', 'Otro'];

/** Edad cumplida a una fecha dada (por omisión, hoy). */
function edadEnFecha(fechaNacimiento, fecha = new Date()) {
  if (!fechaNacimiento) return null;
  const n = new Date(fechaNacimiento);
  const f = new Date(fecha);
  let edad = f.getUTCFullYear() - n.getUTCFullYear();
  const m = f.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && f.getUTCDate() < n.getUTCDate())) edad -= 1;
  return edad;
}

/* Valida un formato solo si el valor no está cifrado (el cifrado ocurre al guardar) */
const formato = (regex) => (v) => !v || estaCifrado(v) || regex.test(v);

/**
 * Identificación del paciente. Los datos clínicos viven en colecciones
 * propias ligadas por `pacienteId` (ver docs/arquitectura-clinica.md).
 * Teléfono, dirección y contacto de emergencia se guardan cifrados.
 */
const pacienteSchema = new mongoose.Schema(
  {
    nombreCompleto: {
      type: String,
      required: [true, 'El nombre completo es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre completo debe tener al menos 3 caracteres'],
      maxlength: [120, 'El nombre completo no puede exceder 120 caracteres'],
    },
    fechaNacimiento: {
      type: Date,
      validate: {
        validator: (v) => !v || (v <= new Date() && v >= new Date('1900-01-01')),
        message: 'Fecha de nacimiento no válida',
      },
    },
    // Edad declarada (registros anteriores). Si hay fecha de nacimiento se recalcula al guardar.
    edad: {
      type: Number,
      min: [0, 'La edad no puede ser negativa'],
      max: [120, 'La edad no puede ser mayor a 120 años'],
      validate: { validator: Number.isInteger, message: 'La edad debe ser un número entero' },
    },
    curp: {
      type: String, trim: true, uppercase: true,
      validate: { validator: formato(/^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/), message: 'CURP con formato no válido' },
    },
    correo: {
      type: String,
      required: [true, 'El correo electrónico es obligatorio'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El correo electrónico no es válido'],
    },
    telefono: {
      type: String,
      required: [true, 'El teléfono es obligatorio'],
      trim: true,
      validate: { validator: formato(/^[0-9+()\-\s]{7,20}$/), message: 'El teléfono no es válido' },
    },
    direccion: { type: String, trim: true },
    ocupacion: { type: String, trim: true, maxlength: 120 },
    contactoEmergencia: {
      nombre: { type: String, trim: true },
      parentesco: { type: String, trim: true, maxlength: 60 },
      telefono: { type: String, trim: true, validate: { validator: formato(/^[0-9+()\-\s]{7,20}$/), message: 'Teléfono de emergencia no válido' } },
    },
    sexo: {
      type: String,
      enum: { values: SEXOS, message: 'El sexo debe ser Femenino, Masculino u Otro' },
    },
    objetivo: {
      type: String,
      required: [true, 'El objetivo nutricional es obligatorio'],
      trim: true,
      maxlength: [200, 'El objetivo no puede exceder 200 caracteres'],
    },
    peso: { type: Number, min: [1, 'El peso debe ser mayor a 0 kg'], max: [400, 'El peso no puede exceder 400 kg'] },
    estatura: { type: Number, min: [30, 'La estatura debe ser de al menos 30 cm'], max: [250, 'La estatura no puede exceder 250 cm'] },
    fechaRegistro: { type: Date, default: Date.now },
    estado: {
      type: String,
      enum: { values: ESTADOS, message: 'El estado debe ser "activo" o "baja"' },
      default: 'activo',
    },
    // Plan de alimentación asignado (catálogo de dietas del frontend)
    dietaId: { type: String, trim: true, default: '' },
  },
  { timestamps: true, versionKey: false }
);

pacienteSchema.pre('validate', function completarEdad() {
  if (this.fechaNacimiento) this.edad = edadEnFecha(this.fechaNacimiento);
  if (this.edad === undefined || this.edad === null) {
    this.invalidate('fechaNacimiento', 'Indica la fecha de nacimiento (o la edad en registros anteriores)');
  }
});

pacienteSchema.plugin(pluginCifrado, {
  rutas: ['telefono', 'direccion', 'contactoEmergencia.nombre', 'contactoEmergencia.telefono'],
});

module.exports = mongoose.model('Paciente', pacienteSchema);
module.exports.ESTADOS = ESTADOS;
module.exports.SEXOS = SEXOS;
module.exports.edadEnFecha = edadEnFecha;
