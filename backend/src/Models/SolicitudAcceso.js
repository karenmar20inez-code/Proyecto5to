const mongoose = require('mongoose');

/**
 * Solicitud de acceso hecha por una persona desde la pantalla de inicio de sesión.
 * No da acceso por sí misma: un superusuario o administrador la aprueba (creando la
 * cuenta con el rol que corresponda) o la rechaza. La contraseña elegida se guarda
 * solo como hash y pasa a la cuenta al aprobarse.
 */
const ROLES_SOLICITABLES = ['nutriologo', 'administrativo', 'docente', 'paciente'];
const ESTADOS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada'];

const solicitudSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, minlength: [3, 'El nombre es muy corto'], maxlength: 120 },
    correo: {
      type: String, required: [true, 'El correo es obligatorio'], trim: true, lowercase: true, maxlength: 160,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo no válido'],
    },
    telefono: { type: String, trim: true, match: [/^[0-9+()\-\s]{7,20}$/, 'Teléfono no válido'] },
    rolSolicitado: { type: String, enum: { values: ROLES_SOLICITABLES, message: 'Tipo de acceso no válido' }, required: [true, 'Elige el tipo de acceso'] },
    cedulaProfesional: { type: String, trim: true, maxlength: 20 },
    mensaje: { type: String, trim: true, maxlength: 500 },
    contrasenaHash: { type: String, required: true, select: false },
    estado: { type: String, enum: ESTADOS_SOLICITUD, default: 'pendiente', index: true },
    motivoRechazo: { type: String, trim: true, maxlength: 300 },
    revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    revisadoPorNombre: String,
    revisadoEn: Date,
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }, // cuenta creada al aprobarse
    ip: String,
  },
  { timestamps: true, versionKey: false }
);

solicitudSchema.index({ correo: 1, estado: 1 });

module.exports = mongoose.model('SolicitudAcceso', solicitudSchema, 'solicitudes_acceso');
module.exports.ROLES_SOLICITABLES = ROLES_SOLICITABLES;
module.exports.ESTADOS_SOLICITUD = ESTADOS_SOLICITUD;
