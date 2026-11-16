/**
 * Migración de roles al nuevo esquema RBAC (segura e idempotente: no borra nada).
 *
 *   npm run migrar-roles               → solo MUESTRA lo que cambiaría (simulación)
 *   npm run migrar-roles -- --aplicar  → aplica los cambios
 *
 * Cambios:
 *  - "administrador" existentes → "superusuario": antes el administrador veía todo, incluidos
 *    los expedientes; el nuevo administrador de sistemas ya no tiene acceso clínico. Así las
 *    cuentas actuales conservan lo que hacían (decisión de la responsable del consultorio).
 *  - "asistente" → "administrativo" con nivel "recepcion" (mismos permisos que tenía).
 * Cada cambio queda en la bitácora de auditoría. Se recomienda `npm run respaldo` antes.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Usuario = require('../src/Models/Usuario');
const Auditoria = require('../src/Models/Auditoria');

const CAMBIOS = [
  { de: 'administrador', a: { rol: 'superusuario' } },
  { de: 'asistente', a: { rol: 'administrativo', nivel: 'recepcion' } },
];

(async () => {
  const aplicar = process.argv.includes('--aplicar');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log(`Base: ${mongoose.connection.name} · modo: ${aplicar ? 'APLICAR' : 'simulación (usa --aplicar para guardar)'}`);

  let total = 0;
  for (const { de, a } of CAMBIOS) {
    // eslint-disable-next-line no-await-in-loop
    const cuentas = await Usuario.find({ rol: de }).select('nombre correo rol').lean();
    for (const c of cuentas) {
      total += 1;
      console.log(`  ${c.nombre} <${c.correo}>: ${de} → ${a.rol}${a.nivel ? ` (${a.nivel})` : ''}`);
      if (!aplicar) continue; // eslint-disable-line no-continue
      // eslint-disable-next-line no-await-in-loop
      await Usuario.updateOne({ _id: c._id, rol: de }, { $set: a });
      // eslint-disable-next-line no-await-in-loop
      await Auditoria.create({
        accion: 'actualizar', entidad: 'Usuario', entidadId: c._id, campos: Object.keys(a),
        responsable: 'Migración de roles (script)', rol: 'sistema',
      });
    }
  }
  console.log(total ? `${total} cuenta(s) ${aplicar ? 'migradas' : 'por migrar'}.` : 'Nada que migrar: todas las cuentas ya usan los roles nuevos.');
  await mongoose.disconnect();
})().catch((e) => { console.log('Error:', e.message.split('mongodb')[0]); process.exitCode = 1; });
