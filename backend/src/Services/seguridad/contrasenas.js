/** Contraseñas: scrypt con sal aleatoria (crypto de Node, sin dependencias). */
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const PARAMETROS = { N: 16384, r: 8, p: 1 };
const LARGO = 64;

/** Política mínima: 10+ caracteres con letras y números. */
function validarPolitica(contrasena) {
  const errores = [];
  if (typeof contrasena !== 'string' || contrasena.length < 10) errores.push('Al menos 10 caracteres');
  if (!/[a-záéíóúñ]/i.test(contrasena || '')) errores.push('Al menos una letra');
  if (!/\d/.test(contrasena || '')) errores.push('Al menos un número');
  return errores;
}

async function generarHash(contrasena) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(contrasena, sal, LARGO, PARAMETROS);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

async function verificar(contrasena, guardado) {
  if (typeof contrasena !== 'string' || typeof guardado !== 'string') return false;
  const [algoritmo, sal, hash] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scrypt(contrasena, Buffer.from(sal, 'base64'), esperado.length, PARAMETROS);
  return crypto.timingSafeEqual(esperado, calculado);
}

module.exports = { validarPolitica, generarHash, verificar };
