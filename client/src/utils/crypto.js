/**
 * Client-Side End-to-End Encryption (E2EE) Module
 * Standard: AES-GCM (256-bit) with PBKDF2 (SHA-256, 100,000 iterations)
 * Uses browser native Web Crypto API (SubtleCrypto) - Zero third-party dependencies
 */

// Convert ArrayBuffer to Hex string
function buf2hex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

// Convert Hex string to Uint8Array
function hex2buf(hexString) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Derive 256-bit AES-GCM key from user passphrase and salt using PBKDF2
 */
async function deriveKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plain text using AES-GCM with unique random IV and Salt
 * @returns {Promise<{ ciphertext: string, iv: string, salt: string }>}
 */
export async function encryptText(plainText, passphrase) {
  if (!passphrase || !plainText) return null;

  try {
    const enc = new TextEncoder();
    const encodedData = enc.encode(plainText);

    // 16 bytes salt for PBKDF2
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    // 12 bytes IV recommended for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKey(passphrase, salt);

    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    return {
      ciphertext: buf2hex(encryptedContent),
      iv: buf2hex(iv),
      salt: buf2hex(salt),
      version: 1
    };
  } catch (err) {
    console.error('Encryption failed:', err);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt ciphertext using AES-GCM
 * @returns {Promise<string>}
 */
export async function decryptText(encryptedMeta, passphrase) {
  if (!encryptedMeta || !passphrase) return null;

  try {
    const { ciphertext, iv, salt } = typeof encryptedMeta === 'string' ? JSON.parse(encryptedMeta) : encryptedMeta;

    if (!ciphertext || !iv || !salt) {
      return null;
    }

    const saltBytes = hex2buf(salt);
    const ivBytes = hex2buf(iv);
    const cipherBytes = hex2buf(ciphertext);

    const key = await deriveKey(passphrase, saltBytes);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    // Decryption fails when passphrase does not match
    return null;
  }
}

/**
 * Generate visual safety numbers fingerprint (Signal-style) from passphrase
 * Allows both users to verify out-of-band that their secret keys match
 */
export async function generateSafetyFingerprint(passphrase) {
  if (!passphrase) return '';

  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(passphrase));
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert into 6 blocks of 5 digits (like Signal)
  let digits = '';
  for (let i = 0; i < hashArray.length; i += 2) {
    const num = ((hashArray[i] << 8) | hashArray[i + 1]) % 100000;
    digits += num.toString().padStart(5, '0') + ' ';
    if (digits.trim().split(' ').length >= 6) break;
  }

  return digits.trim();
}
