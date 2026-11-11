const mongoose = require('mongoose');

/**
 * Bitácora de auditoría (accesos y modificaciones). Registra QUIÉN hizo QUÉ
 * sobre QUÉ registro y CUÁNDO. Solo guarda nombres de campos, nunca valores clínicos.
 */
const auditoriaSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now, index: true },
    accion: {
      type: String,
      enum: [
        'crear', 'actualizar', 'anular', 'eliminar', 'consultar', 'ajustar', 'acceso',
        'firmar', 'adenda', 'exportar', 'login', 'login_fallido', 'logout', 'revisar',
      ],
      required: true,
    },
    entidad: { type: String, required: true },
    entidadId: { type: mongoose.Schema.Types.ObjectId },
    pacienteId: { type: mongoose.Schema.Types.ObjectId, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', index: true },
    responsable: { type: String, required: true },
    rol: String,
    ip: String,
    campos: [String],
  },
  { versionKey: false }
);

module.exports = mongoose.model('Auditoria', auditoriaSchema, 'auditoria');
