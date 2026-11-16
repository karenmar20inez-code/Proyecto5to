/**
 * Crea la primera cuenta de la plataforma: superusuario por omisión
 * (o administrador / nutriólogo con --rol administrador | --rol nutriologo).
 * Uso:
 *   npm run crear-administrador -- --correo tu@correo.com --nombre "Nombre Apellido" [--rol nutriologo] [--cedula 1234567]
 * La contraseña se pide en la terminal (no queda en el historial).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const readline = require('readline');
const mongoose = require('mongoose');
const Usuario = require('../src/Models/Usuario');
const { generarHash, validarPolitica } = require('../src/Services/seguridad/contrasenas');

const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function preguntarOculto(texto) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = function escribir(s) { if (!rl.stdoutMuted || s.includes(texto)) rl.output.write(s); else rl.output.write('*'); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write('\n'); ok(r); });
  });
}

(async () => {
  const correo = arg('correo');
  const nombre = arg('nombre');
  const rol = arg('rol') || 'superusuario';
  if (!correo || !nombre) {
    console.log('Uso: npm run crear-administrador -- --correo tu@correo.com --nombre "Nombre Apellido" [--rol nutriologo] [--cedula 1234567]');
    process.exit(1);
  }
  const contrasena = await preguntarOculto('Contraseña (mín. 10 caracteres, letras y números): ');
  const errores = validarPolitica(contrasena);
  if (errores.length) { console.log(`Contraseña insegura: ${errores.join(', ')}`); process.exit(1); }
  const confirmacion = await preguntarOculto('Repite la contraseña: ');
  if (confirmacion !== contrasena) { console.log('Las contraseñas no coinciden'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const u = await Usuario.create({ nombre, correo, rol, cedulaProfesional: arg('cedula'), contrasenaHash: await generarHash(contrasena) });
    console.log(`Usuario creado: ${u.nombre} <${u.correo}> · rol ${u.rol}`);
  } catch (e) {
    console.log(e.code === 11000 ? 'Ya existe un usuario con ese correo' : `Error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
