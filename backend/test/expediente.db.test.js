/**
 * Pruebas de integración CON base de datos (flujo clínico completo, con
 * usuarios, roles y sesiones reales).
 *
 * Solo se ejecutan si existe MONGO_URI_TEST y apunta a una base distinta de
 * MONGO_URI (nunca contra producción). Todos los datos se identifican como
 * "PRUEBA" y se eliminan al terminar.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const URI = process.env.MONGO_URI_TEST;
const omitir = !URI
  ? 'Define MONGO_URI_TEST para ejecutar las pruebas con base de datos'
  : URI === process.env.MONGO_URI ? 'MONGO_URI_TEST no puede ser la base de producción' : false;

test('Flujo clínico completo con control de acceso', { skip: omitir, timeout: 180000 }, async (t) => {
  if (!process.env.CLAVE_CIFRADO) process.env.CLAVE_CIFRADO = crypto.randomBytes(32).toString('base64');
  const mongoose = require('mongoose');
  const app = require('../src/app');
  const Usuario = require('../src/Models/Usuario');
  const Paciente = require('../src/Models/Paciente');
  const Consulta = require('../src/Models/Consulta');
  const { generarHash } = require('../src/Services/seguridad/contrasenas');

  await mongoose.connect(URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  if (!/prueba/i.test(db.databaseName)) throw new Error('La base de pruebas debe contener "prueba" en su nombre');
  for (const { name } of await db.listCollections().toArray()) await db.collection(name).deleteMany({}); // base exclusiva de pruebas

  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (token, m, ruta, cuerpo) => {
    const r = await fetch(base + ruta, {
      method: m,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  try {
    const CLAVE = 'PruebaSegura2026';
    const hash = await generarHash(CLAVE);
    await Usuario.create([
      { nombre: 'PRUEBA Admin', correo: 'admin@prueba.test', rol: 'administrador', contrasenaHash: hash },
      { nombre: 'PRUEBA Nutrióloga A', correo: 'nutri.a@prueba.test', rol: 'nutriologo', cedulaProfesional: '0000001', contrasenaHash: hash },
      { nombre: 'PRUEBA Nutriólogo B', correo: 'nutri.b@prueba.test', rol: 'nutriologo', contrasenaHash: hash },
      { nombre: 'PRUEBA Asistente', correo: 'asist@prueba.test', rol: 'asistente', contrasenaHash: hash },
    ]);

    const tokens = {};
    await t.test('login, bloqueo por intentos y sesión', async () => {
      assert.equal((await pedir(null, 'POST', '/api/auth/login', { correo: 'nutri.a@prueba.test', contrasena: 'incorrecta123' })).status, 401);
      for (const [k, correo] of [['admin', 'admin@prueba.test'], ['a', 'nutri.a@prueba.test'], ['b', 'nutri.b@prueba.test'], ['asist', 'asist@prueba.test']]) {
        const r = await pedir(null, 'POST', '/api/auth/login', { correo, contrasena: CLAVE });
        assert.equal(r.status, 200, correo);
        assert.ok(r.json.token && !r.json.usuario.contrasenaHash);
        tokens[k] = r.json.token;
      }
      assert.equal((await pedir(tokens.a, 'GET', '/api/auth/yo')).json.rol, 'nutriologo');
      for (let i = 0; i < 5; i += 1) await pedir(null, 'POST', '/api/auth/login', { correo: 'asist@prueba.test', contrasena: 'mala-clave-1' });
      assert.equal((await pedir(null, 'POST', '/api/auth/login', { correo: 'asist@prueba.test', contrasena: CLAVE })).status, 423);
    });

    let pid;
    await t.test('alta de paciente crea expediente con folio; datos de contacto cifrados en reposo', async () => {
      const r = await pedir(tokens.a, 'POST', '/api/pacientes', {
        nombreCompleto: 'PRUEBA Paciente Uno', fechaNacimiento: '1990-03-14', sexo: 'Femenino', correo: 'paciente1@prueba.test',
        telefono: '5512345678', objetivo: 'Reducción de peso', peso: 80, estatura: 165,
        contactoEmergencia: { nombre: 'Contacto Prueba', parentesco: 'Hermana', telefono: '5598765432' },
      });
      assert.equal(r.status, 201);
      pid = r.json._id;
      assert.match(r.json.expediente.folio, /^LN-\d{4}-\d{6}$/);
      assert.equal(r.json.telefono, '5512345678');
      const crudo = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(pid) });
      assert.ok(crudo.telefono.startsWith('enc:v1:'));
      assert.ok(crudo.contactoEmergencia.telefono.startsWith('enc:v1:'));
      const leido = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}`);
      assert.equal(leido.json.contactoEmergencia.telefono, '5598765432');
    });

    await t.test('control de acceso por expediente y rol', async () => {
      assert.equal((await pedir(tokens.b, 'GET', `/api/pacientes/${pid}/expediente`)).status, 403);
      assert.equal((await pedir(tokens.b, 'GET', `/api/pacientes/${pid}`)).status, 403);
      assert.equal((await pedir(tokens.b, 'GET', '/api/pacientes')).json.length, 0);
      assert.equal((await pedir(tokens.admin, 'GET', `/api/pacientes/${pid}/expediente`)).status, 200);
    });

    let consultaId;
    await t.test('historia clínica versionada y nota SOAP con firma y adendas', async () => {
      const a1 = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/antecedentes`, { categoria: 'alergia', descripcion: 'Alergia al huevo', estado: 'activo', detalle: { reaccion: 'urticaria' } });
      assert.equal(a1.status, 201);
      const a2 = await pedir(tokens.a, 'PUT', `/api/antecedentes/${a1.json._id}`, { observaciones: 'Confirmada por alergólogo', motivoCambio: 'Nueva evidencia' });
      assert.equal(a2.json.version, 2);
      assert.equal((await pedir(tokens.a, 'GET', `/api/antecedentes/${a2.json._id}/versiones`)).json.length, 2);
      await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/antecedentes`, { categoria: 'medicamento', descripcion: 'Metformina 850 mg', detalle: { dosis: '850 mg', frecuencia: 'c/12 h' } });

      const c = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/consultas`, { motivo: 'Valoración inicial' });
      assert.equal(c.status, 201);
      assert.equal(c.json.tipo, 'primera_vez');
      consultaId = c.json._id;
      await pedir(tokens.a, 'PUT', `/api/consultas/${consultaId}/borrador`, { soap: { subjetivo: 'Refiere ansiedad nocturna' }, autoguardado: true });
      await pedir(tokens.a, 'PUT', `/api/consultas/${consultaId}/borrador`, { soap: { objetivo: 'Peso 80 kg' }, autoguardado: true });
      assert.equal((await pedir(tokens.b, 'PUT', `/api/consultas/${consultaId}/borrador`, { soap: { plan: 'x' } })).status, 403);
      const incompleta = await pedir(tokens.a, 'POST', `/api/consultas/${consultaId}/firmar`, { confirmacion: true });
      assert.equal(incompleta.status, 400);
      await pedir(tokens.a, 'PUT', `/api/consultas/${consultaId}/borrador`, { soap: { analisis: 'Exceso de ingesta energética', plan: 'Plan 1700 kcal' } });
      assert.equal((await pedir(tokens.a, 'POST', `/api/consultas/${consultaId}/firmar`, {})).status, 400);
      const firmada = await pedir(tokens.a, 'POST', `/api/consultas/${consultaId}/firmar`, { confirmacion: true });
      assert.equal(firmada.json.estado, 'firmada');
      assert.equal((await pedir(tokens.a, 'PUT', `/api/consultas/${consultaId}/borrador`, { soap: { plan: 'cambio' } })).status, 409);
      const ad = await pedir(tokens.a, 'POST', `/api/consultas/${consultaId}/adendas`, { tipo: 'correccion', texto: 'El peso correcto es 80.4 kg' });
      assert.equal(ad.json.adendas.length, 1);
      const detalle = await pedir(tokens.a, 'GET', `/api/consultas/${consultaId}`);
      assert.equal(detalle.json.integridad, 'verificada');
      assert.equal(detalle.json.soap.subjetivo, 'Refiere ansiedad nocturna');
      const crudo = await db.collection('consultas').findOne({ _id: new mongoose.Types.ObjectId(consultaId) });
      assert.ok(crudo.soap.plan.startsWith('enc:v1:') && crudo.adendas[0].texto.startsWith('enc:v1:'));
      // alteración directa en la base → la integridad se detecta
      await Consulta.updateOne({ _id: consultaId }, { $set: { 'soap.plan': 'Plan alterado' } });
      assert.equal((await pedir(tokens.a, 'GET', `/api/consultas/${consultaId}`)).json.integridad, 'ALTERADA');
    });

    let diagnosticoId; let objetivoId; let medicionId;
    await t.test('medición → evaluación → diagnóstico → objetivo → plan', async () => {
      await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/prescripciones`, { fechaInicio: '2026-01-01', kcalObjetivo: 1700, factorActividad: 1.4, proteinasPct: 25, carbohidratosPct: 45, grasasPct: 30 });
      const m1 = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/mediciones`, { fecha: '2026-03-01', pesoKg: 80, cinturaCm: 96, consultaId, metodos: { peso: 'bascula_digital' } });
      assert.equal(m1.status, 201);
      assert.equal(m1.json.evaluacion.entradas.edad, 35); // edad en la fecha de la medición
      const m2 = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/mediciones`, { fecha: '2026-06-01', pesoKg: 75, cinturaCm: 91 });
      medicionId = m2.json.medicion._id;

      const otro = await pedir(tokens.a, 'POST', '/api/pacientes', { nombreCompleto: 'PRUEBA Paciente Dos', fechaNacimiento: '1985-01-01', correo: 'p2@prueba.test', telefono: '5500000000', objetivo: 'x' });
      const ajena = await pedir(tokens.a, 'POST', `/api/pacientes/${otro.json._id}/mediciones`, { fecha: '2026-03-01', pesoKg: 60 });
      const malo = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/diagnosticos`, { problema: 'x', evidencia: { medicionId: ajena.json.medicion._id } });
      assert.equal(malo.status, 400); // evidencia de otro paciente

      const d = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/diagnosticos`, {
        problema: 'Ingesta energética excesiva', etiologia: 'Hábitos de colación nocturna', signosSintomas: 'Aumento de peso',
        consultaId, evidencia: { evaluacionId: m1.json.evaluacion._id, medicionId: m1.json.medicion._id },
      });
      assert.equal(d.status, 201);
      diagnosticoId = d.json._id;

      const o = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/objetivos`, { diagnosticoId, descripcion: 'Reducir peso a 72 kg', indicador: 'pesoKg', valorInicial: 80, valorMeta: 72, periodo: { inicio: '2026-03-01' } });
      assert.equal(o.status, 201);
      objetivoId = o.json._id;
      const lista = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/objetivos`);
      assert.equal(lista.json.objetivos[0].progreso, 62.5); // (80-75)/(80-72)
      const rev = await pedir(tokens.a, 'POST', `/api/objetivos/${objetivoId}/revisiones`, { comentario: 'Buen avance' });
      assert.equal(rev.json.revisiones.length, 1);

      const plan = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/planes`, {
        nombre: 'Plan reducción', vigencia: { inicio: '2026-06-01' }, objetivoIds: [objetivoId], dietaId: 'semana-2', alimentos: ['Huevo', 'Pan integral'],
      });
      assert.equal(plan.status, 201);
      assert.equal(plan.json.requerimientos.kcal, 1700);
      assert.equal((await pedir(tokens.a, 'POST', `/api/planes/${plan.json._id}/activar`)).json.estado, 'vigente');
    });

    await t.test('laboratorio, alertas, ficha, línea de tiempo y comparación', async () => {
      const lab = await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/laboratorios`, {
        fechaMuestra: '2026-06-01', analito: 'glucosa_ayuno', valor: 112, unidad: 'mg/dL', rangoReferencia: { min: 70, max: 100 }, procedencia: 'Laboratorio PRUEBA', consultaId,
      });
      assert.equal(lab.status, 201);
      assert.equal(lab.json.fueraDeRango, 'alto');
      assert.equal((await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/laboratorios`, { fechaMuestra: '2026-06-01', analito: 'glucosa_ayuno', valor: 90, unidad: 'mg/dL' })).status, 400); // sin procedencia
      await esperar(1500); // las alertas se evalúan en segundo plano

      const ficha = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/expediente`);
      assert.equal(ficha.status, 200);
      const tipos = ficha.json.alertas.map((a) => a.tipo);
      assert.ok(tipos.includes('laboratorio_fuera_rango_lab'), tipos.join());
      assert.ok(tipos.includes('alergia_en_plan'), tipos.join());
      assert.ok(tipos.includes('datos_incompletos'), tipos.join()); // falta consentimiento
      assert.equal(ficha.json.indicadores.peso.valor, 75);
      assert.equal(ficha.json.indicadores.peso.anterior.delta, -5);
      assert.equal(ficha.json.indicadores.peso.origen, 'medido');
      assert.equal(ficha.json.ficha.alergias[0].descripcion, 'Alergia al huevo');
      assert.equal(ficha.json.ficha.medicamentos.length, 1);
      assert.match(ficha.json.expediente.folio, /^LN-/);

      const alergia = ficha.json.alertas.find((a) => a.tipo === 'alergia_en_plan');
      assert.equal((await pedir(tokens.a, 'PUT', `/api/alertas/${alergia._id}`, { estado: 'descartada' })).status, 400); // requiere nota
      assert.equal((await pedir(tokens.a, 'PUT', `/api/alertas/${alergia._id}`, { estado: 'revisada', nota: 'Se sustituye el huevo' })).json.estado, 'revisada');

      await pedir(tokens.a, 'POST', `/api/pacientes/${pid}/consentimientos`, { tipo: 'datos_sensibles', versionDocumento: 'AP-2026-1', medio: 'firma_autografa' });
      await esperar(1500);
      const ficha2 = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/expediente`);
      assert.ok(!ficha2.json.alertas.some((a) => a.tipo === 'datos_incompletos' && /consentimiento/.test(a.motivo)));

      const lt = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/linea-tiempo`);
      const tiposEv = new Set(lt.json.eventos.map((e) => e.tipo));
      ['primera_consulta', 'adenda', 'medicion', 'laboratorio', 'diagnostico', 'objetivo', 'revision_objetivo', 'plan', 'tratamiento', 'alerta_revisada']
        .forEach((tipo) => assert.ok(tiposEv.has(tipo), `falta ${tipo}`));
      assert.ok(lt.json.eventos.every((e) => e.ref?.id && e.ref?.pestana));
      const soloLab = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/linea-tiempo?tipos=laboratorio`);
      assert.ok(soloLab.json.eventos.every((e) => e.tipo === 'laboratorio'));

      const comp = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/comparacion`);
      assert.equal(comp.json.filas.find((f) => f.campo === 'pesoKg').delta, -5);
    });

    await t.test('reportes: historia completa vs minimización para terceros', async () => {
      const hc = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/reportes/historia_clinica`);
      assert.equal(hc.status, 200);
      assert.ok(hc.json.paciente.telefono);
      assert.equal((await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/reportes/historia_clinica?terceros=1`)).status, 400);
      const rc = await pedir(tokens.a, 'GET', `/api/pacientes/${pid}/reportes/resumen_consulta?terceros=1`);
      assert.equal(rc.json.paciente.telefono, undefined);
      assert.equal(rc.json.secciones.consulta.soap.subjetivo, undefined);
      assert.ok(rc.json.secciones.consulta.soap.plan);
      assert.equal(rc.json.secciones.consulta.adendas.length, 0);
    });

    await t.test('FHIR, estadísticas por ámbito y conservación del expediente', async () => {
      const p = await pedir(tokens.a, 'GET', `/api/fhir/Patient/${pid}`);
      assert.equal(p.json.resourceType, 'Patient');
      assert.equal(p.json.gender, 'female');
      const obs = await pedir(tokens.a, 'GET', `/api/fhir/Observation?patient=${pid}`);
      assert.ok(obs.json.entry.some((e) => e.resource.code.coding[0]?.code === '29463-7'));
      assert.equal((await pedir(tokens.b, 'GET', `/api/fhir/Patient/${pid}`)).status, 403);

      const resumenA = await pedir(tokens.a, 'GET', '/api/estadisticas/resumen?anio=2026');
      const resumenB = await pedir(tokens.b, 'GET', '/api/estadisticas/resumen?anio=2026');
      assert.ok(resumenA.json.kpis.activos >= 2);
      assert.equal(resumenB.json.kpis.activos, 0);

      assert.equal((await pedir(tokens.admin, 'DELETE', `/api/pacientes/${pid}`)).status, 409); // tiene información clínica
      const auditoria = await pedir(tokens.admin, 'GET', `/api/auditoria?pacienteId=${pid}&limite=500`);
      const acciones = new Set(auditoria.json.map((a) => a.accion));
      ['crear', 'firmar', 'adenda', 'acceso', 'exportar', 'revisar'].forEach((a) => assert.ok(acciones.has(a), `auditoría sin ${a}`));
      assert.ok(auditoria.json.every((a) => a.usuarioId && a.responsable));
    });

    await t.test('cierre de sesión revoca el token', async () => {
      await pedir(tokens.b, 'POST', '/api/auth/logout');
      assert.equal((await pedir(tokens.b, 'GET', '/api/auth/yo')).status, 401);
    });

    void medicionId; void Paciente;
  } finally {
    servidor.close();
    for (const { name } of await db.listCollections().toArray()) await db.collection(name).drop().catch(() => {});
    await mongoose.disconnect();
  }
});
