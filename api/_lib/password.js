// Password hashing — scrypt via Node's built-in crypto, no external dependency
// (this is what Node's own docs recommend scrypt for). Stored format is
// "scrypt$<salt-hex>$<hash-hex>". Existing accounts still have a bare plaintext
// string with no "scrypt$" prefix; verifyPassword() falls back to a direct
// compare for those, and the caller re-hashes on a successful login so each
// account upgrades itself the next time its owner signs in (see api/login.js).

import crypto from 'node:crypto';

const KEYLEN = 64;

export const hashPassword = (plain) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.scrypt(plain, salt, KEYLEN, (err, derivedKey) => {
    if (err) { reject(err); return; }
    resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
  });
});

export const isLegacyPlaintext = (stored) => !!stored && !stored.startsWith('scrypt$');

export const verifyPassword = (plain, stored) => new Promise((resolve) => {
  if (!stored) { resolve(false); return; }
  if (isLegacyPlaintext(stored)) {
    resolve(stored === plain);
    return;
  }
  const [, salt, hashHex] = stored.split('$');
  crypto.scrypt(plain, salt, KEYLEN, (err, derivedKey) => {
    if (err) { resolve(false); return; }
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (storedBuf.length !== derivedKey.length) { resolve(false); return; }
    resolve(crypto.timingSafeEqual(storedBuf, derivedKey));
  });
});
