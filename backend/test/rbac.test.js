/**
 * Control de acceso por roles (RBAC): matriz de permisos, jerarquía, protección contra
 * escalamiento de privilegios y rechazo de la API por rol. No requiere base de datos:
 * la sesión se sustituye por un doble de prueba y solo se comprueba la autorización.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

process.env.CLAVE_CIFRADO = process.env.CLAVE_CIFRADO || crypto.randomBytes(32).toString('base64');
mongoose.set('bufferCommands', false);

const {
  ROLES, CATALOGO_PERMISOS, permisosDe, tienePermiso, accesoClinico, rolesAsignables,
  puedeGestionar, permisosConcedibles, alcanceGlobal,
} = require('../src/Services/seguridad/permisos');
const Usuario = require('../src/Models/Usuario');

const id = () => new mongoose.Types.ObjectId();
const u = (rol, extra = {}) => ({ _id: id(), nombre: `Prueba ${rol}`, rol, activo: true, ...extra });

/* ---------------- Matriz de permisos ---------------- */

test('Cada permiso de cada rol existe en el catálogo', () => {
  Object.entries(ROLES).forEach(([rol, r]) => {
    const todos = [...r.permisos, ...Object.values(r.niveles || {}).flatMap((n) => n.permisos)];
    todos.filter((p) => p !== '*').forEach((p) => assert.ok(CATALOGO_PERMISOS[p], `${rol}: permiso desconocido ${p}`));
  });
});

test('Superusuario: control global y acceso clínico de supervisión', () => {
  const s = u('superusuario');
  ['plataforma:administrar', 'usuarios:crear', 'clinico:leer', 'auditoria:leer'].forEach((p) => assert.equal(tienePermiso(s, p), true, p));
  assert.equal(alcanceGlobal(s), true);
});

test('Administrador de sistemas: gestiona cuentas, sin acceso clínico ni a la plataforma', () => {
  const a = u('administrador');
  ['usuarios:crear', 'usuarios:editar', 'usuarios:estado', 'auditoria:leer', 'configuracion:gestionar'].forEach((p) => assert.equal(tienePermiso(a, p), true, p));
  ['clinico:leer', 'clinico:escribir', 'notas:firmar', 'plataforma:administrar', 'pacientes:eliminar'].forEach((p) => assert.equal(tienePermiso(a, p), false, p));
  assert.equal(alcanceGlobal(a), false);
});

test('Nutriólogo: trabajo clínico, sin administrar usuarios', () => {
  const n = u('nutriologo');
  ['pacientes:escribir', 'clinico:escribir', 'notas:firmar', 'dietas:escribir', 'reportes:generar'].forEach((p) => assert.equal(tienePermiso(n, p), true, p));
  ['usuarios:leer', 'administracion', 'auditoria:leer', 'pacientes:eliminar'].forEach((p) => assert.equal(tienePermiso(n, p), false, p));
});

test('Docente: estadísticas anónimas y dietas; nada clínico ni de pacientes', () => {
  const d = u('docente');
  assert.deepEqual(permisosDe(d).sort(), ['dietas:leer', 'estadisticas:leer']);
  ['clinico:leer', 'pacientes:leer', 'reportes:generar', 'agenda:leer'].forEach((p) => assert.equal(tienePermiso(d, p), false, p));
});

test('Administrativo: los niveles amplían permisos sin acceso clínico', () => {
  const rec = u('administrativo', { nivel: 'recepcion' });
  const ges = u('administrativo', { nivel: 'gestion' });
  const sup = u('administrativo', { nivel: 'supervisor' });
  assert.equal(tienePermiso(rec, 'agenda:escribir'), true);
  assert.equal(tienePermiso(rec, 'estadisticas:leer'), false);
  assert.equal(tienePermiso(ges, 'estadisticas:leer'), true);
  assert.equal(tienePermiso(sup, 'usuarios:leer'), true);
  assert.equal(tienePermiso(sup, 'usuarios:crear'), false);
  [rec, ges, sup].forEach((x) => ['clinico:leer', 'notas:firmar', 'reportes:generar'].forEach((p) => assert.equal(tienePermiso(x, p), false, `${x.nivel}: ${p}`)));
  assert.equal(tienePermiso(u('administrativo'), 'agenda:leer'), true, 'sin nivel = recepción');
});

test('Paciente: solo su portal', () => {
  assert.deepEqual(permisosDe(u('paciente', { pacienteId: id() })), ['portal:propio']);
});

test('Rol heredado "asistente" equivale a recepción hasta migrarlo', () => {
  const a = u('asistente');
  assert.equal(tienePermiso(a, 'agenda:escribir'), true);
  assert.equal(tienePermiso(a, 'clinico:leer'), false);
});

test('Permisos extra y revocados por cuenta; una cuenta inactiva no tiene permisos', () => {
  const d = u('docente', { permisosExtra: ['agenda:leer'], permisosRevocados: ['dietas:leer'] });
  assert.equal(tienePermiso(d, 'agenda:leer'), true);
  assert.equal(tienePermiso(d, 'dietas:leer'), false);
  assert.equal(tienePermiso(u('docente', { permisosExtra: ['plataforma:administrar', '*'] }), 'plataforma:administrar'), false, 'no concedibles se ignoran');
  assert.deepEqual(permisosDe(u('nutriologo', { activo: false })), []);
  assert.equal(tienePermiso(u('superusuario', { permisosRevocados: ['*'] }), 'usuarios:crear'), true, 'el comodín no se revoca');
});

test('Acceso clínico por expediente: responsable, equipo o superusuario', () => {
  const n = u('nutriologo');
  const otro = u('nutriologo');
  const exp = { responsableId: n._id, equipoIds: [] };
  assert.equal(accesoClinico(n, exp), true);
  assert.equal(accesoClinico(otro, exp), false, 'otro profesional no ve pacientes ajenos');
  assert.equal(accesoClinico(otro, { ...exp, equipoIds: [otro._id] }), true);
  assert.equal(accesoClinico(u('superusuario'), exp), true);
  ['administrador', 'docente', 'administrativo', 'paciente'].forEach((r) => assert.equal(accesoClinico(u(r, { _id: n._id }), exp), false, r));
  // Acceso clínico expreso a un administrador: solo en expedientes donde esté en el equipo
  const adminConPermiso = u('administrador', { permisosExtra: ['clinico:leer'] });
  assert.equal(accesoClinico(adminConPermiso, exp), false);
  assert.equal(accesoClinico(adminConPermiso, { ...exp, equipoIds: [adminConPermiso._id] }), true);
});

/* ---------------- Jerarquía y escalamiento de privilegios ---------------- */

test('Solo se asignan roles de nivel inferior; nadie crea superusuarios', () => {
  assert.ok(!rolesAsignables(u('superusuario')).includes('superusuario'));
  assert.ok(rolesAsignables(u('superusuario')).includes('administrador'));
  const delAdmin = rolesAsignables(u('administrador'));
  assert.deepEqual(delAdmin.sort(), ['administrativo', 'docente', 'nutriologo', 'paciente']);
  assert.ok(!rolesAsignables(u('nutriologo')).includes('nutriologo'));
  assert.ok(!rolesAsignables(u('superusuario')).includes('asistente'), 'el rol heredado no se asigna');
});

test('Nadie gestiona su propia cuenta ni cuentas de su nivel o superior', () => {
  const s = u('superusuario');
  const a = u('administrador');
  const a2 = u('administrador');
  assert.equal(puedeGestionar(s, a), true);
  assert.equal(puedeGestionar(a, s), false);
  assert.equal(puedeGestionar(a, a2), false);
  assert.equal(puedeGestionar(a, a), false);
  assert.equal(puedeGestionar(s, s), false);
  assert.equal(puedeGestionar(a, u('nutriologo')), true);
});

test('Solo se conceden permisos que uno mismo tiene', () => {
  const admin = permisosConcedibles(u('administrador'));
  assert.ok(admin.includes('usuarios:leer'));
  assert.ok(!admin.includes('clinico:leer'), 'el administrador no puede dar acceso clínico');
  assert.ok(!admin.includes('plataforma:administrar'));
  const sup = permisosConcedibles(u('superusuario'));
  assert.ok(sup.includes('clinico:leer'));
  assert.ok(!sup.includes('plataforma:administrar') && !sup.includes('*'));
});

/* ---------------- Modelo de usuario ---------------- */

test('Modelo: roles nuevos válidos y reglas de coherencia', async () => {
  const base = { nombre: 'Prueba', correo: 'p@prueba.test', contrasenaHash: 'x' };
  assert.equal(new Usuario({ ...base, rol: 'docente' }).validateSync(), undefined);
  const adm = new Usuario({ ...base, rol: 'administrativo' });
  assert.equal(adm.validateSync(), undefined);
  assert.equal(adm.nivel, 'recepcion', 'nivel por omisión');
  assert.ok(new Usuario({ ...base, rol: 'paciente' }).validateSync().errors.pacienteId, 'paciente sin paciente ligado');
  assert.ok(new Usuario({ ...base, rol: 'rey' }).validateSync().errors.rol);
  assert.ok(new Usuario({ ...base, rol: 'docente', permisosExtra: ['inventado'] }).validateSync().errors['permisosExtra.0']);
  const n = new Usuario({ ...base, rol: 'nutriologo', nivel: 'gestion' });
  await n.validate(); // ejecuta también el hook de coherencia (como al guardar)
  assert.equal(n.nivel, undefined, 'el nivel solo aplica al rol administrativo');
});

/* ---------------- API: rechazos por rol (sin base de datos) ---------------- */

const sesiones = require('../src/Services/seguridad/sesiones');
const CUENTAS = {
  super: u('superusuario'),
  admin: u('administrador'),
  nutri: u('nutriologo'),
  docente: u('docente'),
  recepcion: u('administrativo', { nivel: 'recepcion' }),
  supervisor: u('administrativo', { nivel: 'supervisor' }),
  paciente: u('paciente', { pacienteId: id() }),
  temporal: u('nutriologo', { debeCambiarContrasena: true }),
};
const verificarOriginal = sesiones.verificarSesion;
const app = require('../src/app');
let servidor;
let base;

test.before(async () => {
  sesiones.verificarSesion = async (t) => (CUENTAS[t] ? { usuario: CUENTAS[t], sesion: {} } : null);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => { servidor.close(); sesiones.verificarSesion = verificarOriginal; });

const pedir = async (cuenta, metodo, ruta, cuerpo) => {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cuenta}` },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return r.status;
};
const PID = '64b7f0c2a1b2c3d4e5f60718';

test('API: cada rol es rechazado (403) fuera de sus permisos', async () => {
  const casos = [
    ['admin', 'GET', `/api/pacientes/${PID}/expediente`], // sin acceso clínico
    ['admin', 'POST', '/api/dietas', {}],
    ['admin', 'DELETE', `/api/pacientes/${PID}`], // eliminar pacientes: solo superusuario
    ['nutri', 'GET', '/api/usuarios'],
    ['nutri', 'GET', '/api/auditoria'],
    ['nutri', 'POST', '/api/alertas/reglas', {}],
    ['docente', 'GET', '/api/pacientes'],
    ['docente', 'GET', '/api/citas'],
    ['docente', 'POST', '/api/dietas', {}],
    ['docente', 'GET', `/api/pacientes/${PID}/expediente`],
    ['recepcion', 'GET', `/api/pacientes/${PID}/consultas`],
    ['recepcion', 'GET', '/api/usuarios'],
    ['recepcion', 'GET', '/api/estadisticas/resumen'],
    ['supervisor', 'POST', '/api/usuarios', { rol: 'administrativo' }],
    ['paciente', 'GET', '/api/pacientes'],
    ['paciente', 'GET', '/api/dietas'],
    ['paciente', 'GET', '/api/catalogos'],
    ['paciente', 'GET', '/api/usuarios/profesionales'],
    ['paciente', 'GET', `/api/pacientes/${PID}/expediente`],
    ['paciente', 'PUT', `/api/pacientes/${PID}/expediente`, { portal: { indicadoresClinicos: true } }],
    ['nutri', 'GET', '/api/portal'],
    ['docente', 'GET', '/api/portal'],
    ['recepcion', 'GET', '/api/portal'],
  ];
  for (const [cuenta, metodo, ruta, cuerpo] of casos) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal(await pedir(cuenta, metodo, ruta, cuerpo), 403, `${cuenta} ${metodo} ${ruta}`);
  }
});

test('API: los roles con permiso pasan la autorización (no 401/403)', async () => {
  const casos = [
    ['super', 'GET', '/api/usuarios'],
    ['admin', 'GET', '/api/usuarios'],
    ['admin', 'GET', '/api/auditoria'],
    ['supervisor', 'GET', '/api/usuarios'],
    ['nutri', 'GET', '/api/pacientes'],
    ['recepcion', 'GET', '/api/citas'],
    ['docente', 'GET', '/api/dietas'],
    ['docente', 'GET', '/api/estadisticas/resumen'],
    ['paciente', 'GET', '/api/portal'],
    ['paciente', 'GET', '/api/auth/yo'],
  ];
  for (const [cuenta, metodo, ruta] of casos) {
    // eslint-disable-next-line no-await-in-loop
    const s = await pedir(cuenta, metodo, ruta);
    assert.ok(s !== 401 && s !== 403, `${cuenta} ${metodo} ${ruta} → ${s}`);
  }
});

test('API: nadie modifica su propia cuenta ni crea roles superiores', async () => {
  assert.equal(await pedir('admin', 'PUT', `/api/usuarios/${CUENTAS.admin._id}`, { rol: 'superusuario' }), 403);
  assert.equal(await pedir('super', 'PUT', `/api/usuarios/${CUENTAS.super._id}`, { activo: false }), 403);
  assert.equal(await pedir('admin', 'POST', '/api/usuarios', { rol: 'superusuario', nombre: 'X', correo: 'x@x.test' }), 403);
  assert.equal(await pedir('admin', 'POST', '/api/usuarios', { rol: 'administrador', nombre: 'X', correo: 'x@x.test' }), 403);
  assert.equal(await pedir('admin', 'POST', '/api/usuarios', {
    rol: 'docente', nombre: 'X', correo: 'x@x.test', permisosExtra: ['clinico:leer'],
  }), 403, 'no puede conceder acceso clínico que no tiene');
});

test('API: con contraseña temporal solo se puede consultar la sesión y cambiarla', async () => {
  assert.equal(await pedir('temporal', 'GET', '/api/pacientes'), 403);
  assert.equal(await pedir('temporal', 'GET', '/api/dietas'), 403);
  assert.equal(await pedir('temporal', 'GET', '/api/auth/yo'), 200);
});
