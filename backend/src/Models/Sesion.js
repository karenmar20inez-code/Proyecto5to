const mongoose = require('mongoose');

/** Sesión activa. Solo se guarda el hash SHA-256 del token, nunca el token. */
const sesionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    expira: { type: Date, required: true },
    ultimaActividad: { type: Date, default: Date.now },
    ip: String,
    agente: { type: String, maxlength: 300 },
    revocada: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

// MongoDB elimina automáticamente las sesiones expiradas
sesionSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Sesion', sesionSchema, 'sesiones');
