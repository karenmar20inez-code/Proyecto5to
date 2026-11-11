/**
 * Migración al modelo clínico longitudinal (idempotente: puede ejecutarse varias veces).
 *  1. Crea un Expediente para cada paciente que no lo tenga (responsable indicado).
 *  2. Re-guarda pacientes para cifrar teléfono/dirección/contacto si estaban en texto plano.
 *  3. Copia los valores de laboratorio que estaban en Medicion a ResultadoLaboratorio
 *     (procedencia "Migrado de medición"; NO inventa rangos de referencia).
 *  4. Instala las reglas de alerta por omisión si no existen.
 *
 * Uso: npm run migrar -- --responsable correo@del.nutriologo [--simular]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Paciente = require('../src/Models/Paciente');
const Expediente = require('../src/Models/Expediente');
const Usuario = require('../src/Models/Usuario');
const Medicion = require('../src/Models/Medicion');
const ResultadoLaboratorio = require('../src/Models/ResultadoLaboratorio');
const { ANALITOS } = require('../src/Services/clinica/analitos');
const { asegurarReglasPorOmision } = require('../src/Services/clinica/alertas');
const { estaCifrado } = require('../src/Services/seguridad/cifrado');

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const simular = process.argv.includes('--simular');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const resumen = { expedientesCreados: 0, pacientesCifrados: 0, laboratoriosMigrados: 0 };
  try {
    const pacientes = await Paciente.find();
    const sinExpediente = [];
    for (const p of pacientes) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await Expediente.exists({ pacienteId: p._id }))) sinExpediente.push(p);
    }

    let responsable = null;
    if (sinExpediente.length) {
      const correo = arg('responsable');
      responsable = correo && await Usuario.findOne({ correo: correo.toLowerCase(), rol: { $in: ['nutriologo', 'administrador'] } });
      if (!responsable) throw new Error(`${sinExpediente.length} paciente(s) sin expediente: indica --responsable <correo de un nutriólogo existente>`);
    }

    for (const p of sinExpediente) {
      if (!simular) {
        // eslint-disable-next-line no-await-in-loop
        await Expediente.create({ pacienteId: p._id, folio: await Expediente.siguienteFolio(), responsableId: responsable._id, fechaIngreso: p.fechaRegistro || p.createdAt });
      }
      resumen.expedientesCreados += 1;
    }

    for (const p of pacientes) {
      const crudo = await Paciente.collection.findOne({ _id: p._id }, { projection: { telefono: 1 } }); // eslint-disable-line no-await-in-loop
      if (crudo?.telefono && !estaCifrado(crudo.telefono)) {
        if (!simular) {
          p.markModified('telefono');
          await p.save({ validateBeforeSave: false }); // eslint-disable-line no-await-in-loop
        }
        resumen.pacientesCifrados += 1;
      }
    }

    const conLab = Object.entries(ANALITOS).filter(([, a]) => a.campoMedicion);
    const mediciones = await Medicion.find({ vigente: true, anulada: false, $or: conLab.map(([, a]) => ({ [a.campoMedicion]: { $ne: null } })) }).lean();
    for (const m of mediciones) {
      for (const [clave, a] of conLab) {
        if (m[a.campoMedicion] == null) continue;
        // eslint-disable-next-line no-await-in-loop
        if (await ResultadoLaboratorio.exists({ origenMedicionId: m._id, analito: clave })) continue;
        if (!simular) {
          // eslint-disable-next-line no-await-in-loop
          await ResultadoLaboratorio.create({
            pacienteId: m.pacienteId, consultaId: m.consultaId, fechaMuestra: m.fecha, analito: clave, nombre: a.nombre,
            valor: m[a.campoMedicion], unidad: a.unidad, procedencia: 'Migrado de medición (sin rango de referencia)',
            origen: 'migracion', origenMedicionId: m._id, registradoPorNombre: m.responsable,
            grupoId: new mongoose.Types.ObjectId(),
          });
        }
        resumen.laboratoriosMigrados += 1;
      }
    }

    if (!simular) await asegurarReglasPorOmision();
    console.log(simular ? 'SIMULACIÓN (no se guardó nada):' : 'Migración completada:', resumen);
  } catch (e) {
    console.log('Migración detenida:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
