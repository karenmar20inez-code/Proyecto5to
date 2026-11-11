/**
 * Genera una clave aleatoria para CLAVE_CIFRADO (AES-256 → 32 bytes).
 * Uso: npm run generar-clave
 * Copia la línea en backend/.env y GUARDA UNA COPIA SEGURA fuera del repositorio:
 * si se pierde, los datos cifrados no podrán recuperarse.
 */
const crypto = require('crypto');

console.log('\nAgrega esta línea a backend/.env (no la compartas ni la subas a Git):\n');
console.log(`CLAVE_CIFRADO=${crypto.randomBytes(32).toString('base64')}\n`);
