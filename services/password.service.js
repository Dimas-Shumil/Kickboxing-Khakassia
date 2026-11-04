import argon2 from 'argon2';
import {scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt);
const ARGON2_OPTIONS={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1,hashLength:32};
async function hashPassword(password){return argon2.hash(password,ARGON2_OPTIONS);}
async function verifyPassword(password,encoded){
 if(encoded?.startsWith('$argon2'))return argon2.verify(encoded,password).catch(()=>false);
 // Совместимость с собственным патчем 08.2: старый хеш обновится после правильного входа.
 const [kind,salt,hex]=(encoded||'').split('$');
 if(kind!=='scrypt'||!salt||!/^[a-f0-9]{128}$/.test(hex||''))return false;
 const hash=await scrypt(password,salt,64);return timingSafeEqual(hash,Buffer.from(hex,'hex'));
}
export {hashPassword,verifyPassword};
