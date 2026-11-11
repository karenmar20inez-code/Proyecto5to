const mongoose = require('mongoose');

const ROLES = ['administrador', 'nutriologo', 'asistente'];

/** Profesional o personal que usa el sistema. La contraseña nunca se devuelve. */
const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 120 },
    correo: {
      type: String, required: [true, 'El correo es obligatorio'], trim: true, lowercase: true, unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo no válido'],
    },
    rol: { type: String, enum: { values: ROLES, message: 'Rol no válido' }, required: true },
    cedulaProfesional: { type: String, trim: true, maxlength: 20 },
    contrasenaHash: { type: String, required: true, select: false },
    activo: { type: Boolean, default: true },
    debeCambiarContrasena: { type: Boolean, default: false },
    intentosFallidos: { type: Number, default: 0, select: false },
    bloqueadoHasta: { type: Date, select: false },
    ultimoAcceso: Date,
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
module.exports.ROLES = ROLES;
