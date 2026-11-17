const mongoose = require('mongoose');
const { ROLES: CONFIG_ROLES, CATALOGO_PERMISOS } = require('../Services/seguridad/permisos');

/* Incluye el rol heredado "asistente" para no invalidar cuentas existentes antes de migrarlas */
const ROLES = Object.keys(CONFIG_ROLES);
const NIVELES_ADMINISTRATIVO = Object.keys(CONFIG_ROLES.administrativo.niveles);
const PERMISOS_VALIDOS = Object.keys(CATALOGO_PERMISOS);

/** Persona que usa el sistema (personal del consultorio o paciente). La contraseña nunca se devuelve. */
const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 120 },
    correo: {
      type: String, required: [true, 'El correo es obligatorio'], trim: true, lowercase: true, unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo no válido'],
    },
    telefono: { type: String, trim: true, match: [/^[0-9+()\-\s]{7,20}$/, 'Teléfono no válido'] },
    rol: { type: String, enum: { values: ROLES, message: 'Rol no válido' }, required: true },
    /* Solo para el rol administrativo: recepcion | gestion | supervisor */
    nivel: {
      type: String, enum: { values: NIVELES_ADMINISTRATIVO, message: 'Nivel administrativo no válido' },
      default() { return this.rol === 'administrativo' ? CONFIG_ROLES.administrativo.nivelPorOmision : undefined; },
    },
    /* Ajustes por cuenta sobre los permisos del rol (validados contra el catálogo) */
    permisosExtra: { type: [{ type: String, enum: { values: PERMISOS_VALIDOS, message: 'Permiso no válido' } }], default: [] },
    permisosRevocados: { type: [{ type: String, enum: { values: PERMISOS_VALIDOS, message: 'Permiso no válido' } }], default: [] },
    cedulaProfesional: { type: String, trim: true, maxlength: 20 },
    especialidad: { type: String, trim: true, maxlength: 120 },
    /* Cuenta de paciente: a qué paciente pertenece (solo verá su propia información) */
    /* Consultorio u organización (ámbito de trabajo). Sin consultorio = ámbito general */
    consultorioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultorio', index: true },
    pacienteId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', index: true, sparse: true,
      required: [function esPaciente() { return this.rol === 'paciente'; }, 'La cuenta de paciente debe estar ligada a un paciente'],
    },
    contrasenaHash: { type: String, required: true, select: false },
    activo: { type: Boolean, default: true },
    debeCambiarContrasena: { type: Boolean, default: false },
    intentosFallidos: { type: Number, default: 0, select: false },
    bloqueadoHasta: { type: Date, select: false },
    ultimoAcceso: Date,
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    /* Cuenta eliminada: ya no existe para el sistema (no entra, no aparece en listas, su correo queda libre),
       pero se conserva su nombre como autor de los registros clínicos y de auditoría. */
    eliminado: { type: Boolean, default: false, index: true },
    eliminadoEn: Date,
    eliminadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { timestamps: true, versionKey: false }
);

/* Coherencia entre rol y campos propios del rol */
usuarioSchema.pre('validate', function coherencia() {
  if (this.rol === 'administrativo' && !this.nivel) this.nivel = CONFIG_ROLES.administrativo.nivelPorOmision;
  if (this.rol !== 'administrativo') this.nivel = undefined;
  if (this.rol !== 'paciente') this.pacienteId = undefined;
});

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
module.exports.ROLES = ROLES;
module.exports.NIVELES_ADMINISTRATIVO = NIVELES_ADMINISTRATIVO;
