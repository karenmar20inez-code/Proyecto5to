const mongoose = require('mongoose');

/**
 * Consultorio u organización. Sirve de ámbito: el personal ligado a un consultorio
 * (administradores, administrativos) solo ve y gestiona cuentas y pacientes de ese consultorio.
 * Quien no tiene consultorio asignado conserva el ámbito general (comportamiento anterior).
 * No se borran: se desactivan.
 */
const consultorioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: [true, 'El nombre del consultorio es obligatorio'], trim: true, minlength: 3, maxlength: 120, unique: true },
    direccion: { type: String, trim: true, maxlength: 250 },
    telefono: { type: String, trim: true, match: [/^[0-9+()\-\s]{7,20}$/, 'Teléfono no válido'] },
    correo: { type: String, trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo no válido'] },
    activo: { type: Boolean, default: true },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Consultorio', consultorioSchema, 'consultorios');
