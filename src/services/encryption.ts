import CryptoJS from "crypto-js";
import * as Crypto from "expo-crypto";

// Polyfill CryptoJS random using Expo's secure PRNG
CryptoJS.lib.WordArray.random = function (nBytes: number) {
  const bytes = Crypto.getRandomBytes(nBytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return CryptoJS.enc.Hex.parse(hex);
};

// PBKDF2 parameters
const SALT_SIZE = 128 / 8; // 16 bytes
const ITERATIONS = 100000;
const KEY_SIZE = 256 / 32; // 8 words = 256 bits

/**
 * Derives a key and a hash from a given master password and salt.
 * If no salt is provided, a new one is generated (for setup).
 */
export const deriveMasterKey = (password: string, saltHex?: string) => {
  const salt = saltHex
    ? CryptoJS.enc.Hex.parse(saltHex)
    : CryptoJS.lib.WordArray.random(SALT_SIZE);

  // Derive the key using PBKDF2
  const derivedKey = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  // Create a separate hash for authentication/validation with the server
  // so we never send the actual derived encryption key or password.
  const authHash = CryptoJS.SHA256(
    derivedKey.toString(CryptoJS.enc.Hex) + "AUTH",
  ).toString();

  return {
    derivedKeyHex: derivedKey.toString(CryptoJS.enc.Hex),
    saltHex: salt.toString(CryptoJS.enc.Hex),
    authHash,
  };
};

/**
 * Encrypt some text (e.g. document content or notes) using the derived master key.
 */
export const encryptData = (plaintext: string, keyHex: string) => {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  // AES implicitly generates a random IV if not provided, and prepends it in the CipherParams
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString(); // Returns Base64 formatted string
};

/**
 * Decrypt some text using the derived master key.
 */
export const decryptData = (ciphertextB64: string, keyHex: string) => {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const decrypted = CryptoJS.AES.decrypt(ciphertextB64, key, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};
