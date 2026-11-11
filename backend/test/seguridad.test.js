/* Pruebas unitarias de seguridad: cifrado, contraseñas, permisos, firma de notas */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

process.env.CLAVE_CIFRADO = crypto.randomBytes(32).toString('base64');
const cifrado = require('../src/Services/seguridad/cifrado');
const contrasenas = require('../src/Services/seguridad/contrasenas');
const { tienePermiso, accesoClinico } = require('../src/Services/seguridad/permisos');
const { hashNota } = require('../src/Controllers/consultaController');
const Paciente = require('../src/Models/Paciente');

test('Cifrado AES-256-GCM: ida y vuelta, IV aleatorio, prefijo versionado', () => {
  const a = cifrado.cifrar('55 1234 5678');
  const b = cifrado.cifrar('55 1234 5678');
  assert.ok(a.startsWith('enc:v1:'));
  assert.notEqual(a, b); // IV distinto en cada cifrado
  assert.equal(cifrado.descifrar(a), '55 1234 5678');
  assert.equal(cifrado.cifrar(a), a); // no cifra dos veces
  assert.equal(cifrado.cifrar(''), '');
  assert.equal(cifrado.descifrar('texto plano'), 'texto plano');
});

test('Cifrado detecta manipulación (GCM)', () => {
  const c = cifrado.cifrar('dato clínico');
  const partes = c.split(':');
  const datos = Buffer.from(partes[4], 'base64');
  datos[0] ^= 1;
  partes[4] = datos.toString('base64');
  assert.throws(() => cifrado.descifrar(partes.join(':')));
});

test('Cifrado de rutas anidadas y arreglos', () => {
  const doc = { soap: { plan: 'Plan A' }, adendas: [{ texto: 'uno' }, { texto: 'dos' }] };
  cifrado.aplicarRutas(doc, ['soap.plan', 'adendas.texto'], cifrado.cifrar);
  assert.ok(doc.soap.plan.startsWith('enc:v1:'));
  assert.ok(doc.adendas.every((a) => a.texto.startsWith('enc:v1:')));
  cifrado.aplicarRutas(doc, ['soap.plan', 'adendas.texto'], cifrado.descifrar);
  assert.deepEqual(doc, { soap: { plan: 'Plan A' }, adendas: [{ texto: 'uno' }, { texto: 'dos' }] });
});

test('Sin CLAVE_CIFRADO no se cifra', () => {
  const k = process.env.CLAVE_CIFRADO;
  delete process.env.CLAVE_CIFRADO;
  cifrado._reiniciarClave();
  assert.throws(() => cifrado.cifrar('x'), /CLAVE_CIFRADO/);
  process.env.CLAVE_CIFRADO = k;
  cifrado._reiniciarClave();
});

test('Contraseñas: política, hash con sal y verificación', async () => {
  assert.deepEqual(contrasenas.validarPolitica('corta1'), ['Al menos 10 caracteres']);
  assert.ok(contrasenas.validarPolitica('sololetrasaqui').includes('Al menos un número'));
  assert.deepEqual(contrasenas.validarPolitica('nutria2026segura'), []);
  const h1 = await contrasenas.generarHash('nutria2026segura');
  const h2 = await contrasenas.generarHash('nutria2026segura');
  assert.notEqual(h1, h2);
  assert.equal(await contrasenas.verificar('nutria2026segura', h1), true);
  assert.equal(await contrasenas.verificar('otra-clave-2026', h1), false);
  assert.equal(await contrasenas.verificar('x', 'formato-invalido'), false);
});

test('Permisos por rol', () => {
  const admin = { rol: 'administrador' };
  const nutri = { rol: 'nutriologo' };
  const asist = { rol: 'asistente' };
  assert.equal(tienePermiso(admin, 'administracion'), true);
  assert.equal(tienePermiso(nutri, 'administracion'), false);
  assert.equal(tienePermiso(nutri, 'notas:firmar'), true);
  assert.equal(tienePermiso(asist, 'clinico:leer'), false);
  assert.equal(tienePermiso(asist, 'agenda:escribir'), true);
  assert.equal(tienePermiso(undefined, 'pacientes:leer'), false);
});

test('Acceso clínico: responsable, equipo, administrador; nunca asistente', () => {
  const a = new mongoose.Types.ObjectId();
  const b = new mongoose.Types.ObjectId();
  const exp = { responsableId: a, equipoIds: [b] };
  assert.equal(accesoClinico({ _id: a, rol: 'nutriologo' }, exp), true);
  assert.equal(accesoClinico({ _id: b, rol: 'nutriologo' }, exp), true);
  assert.equal(accesoClinico({ _id: new mongoose.Types.ObjectId(), rol: 'nutriologo' }, exp), false);
  assert.equal(accesoClinico({ _id: a, rol: 'asistente' }, exp), false);
  assert.equal(accesoClinico({ rol: 'administrador' }, exp), true);
});

test('Hash de firma cambia si se altera el contenido', () => {
  const nota = { pacienteId: 'p1', fecha: new Date('2026-11-01T10:00:00Z'), soap: { subjetivo: 'a', objetivo: 'b', analisis: 'c', plan: 'd' }, firma: { usuarioId: 'u1', fecha: new Date('2026-11-01T11:00:00Z') } };
  const h = hashNota(nota);
  assert.equal(hashNota({ ...nota }), h);
  assert.notEqual(hashNota({ ...nota, soap: { ...nota.soap, plan: 'd.' } }), h);
});

test('Edad calculada a una fecha', () => {
  assert.equal(Paciente.edadEnFecha('1990-06-15', '2026-06-14'), 35);
  assert.equal(Paciente.edadEnFecha('1990-06-15', '2026-06-15'), 36);
  assert.equal(Paciente.edadEnFecha(null), null);
});

test('Paciente: teléfono cifrado sigue validándose y exige fecha de nacimiento o edad', async () => {
  const base = { nombreCompleto: 'Prueba Paciente', correo: 'p@example.com', objetivo: 'x' };
  const sinEdad = new Paciente({ ...base, telefono: '5512345678' });
  await assert.rejects(sinEdad.validate(), /fecha de nacimiento/);
  const malo = new Paciente({ ...base, telefono: 'abc', fechaNacimiento: '1990-01-01' });
  await assert.rejects(malo.validate(), /teléfono/);
  const bueno = new Paciente({ ...base, telefono: '5512345678', fechaNacimiento: '1990-01-01' });
  await bueno.validate();
  assert.ok(bueno.edad >= 36);
});
