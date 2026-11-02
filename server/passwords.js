const {randomBytes, scrypt: rawScrypt, timingSafeEqual} = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(rawScrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return 'scrypt$' + salt + '$' + hash.toString('hex');
}
async function verifyPassword(password, encoded) {
  const [kind, salt, hex] = (encoded || '').split('$');
  if (kind !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const hash = await scrypt(password, salt, 64);
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
module.exports = {hashPassword, verifyPassword};
