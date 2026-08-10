/**
 * 使用 PBKDF2 和 AES-GCM 進行加密解密
 */

const ENCRYPTION_ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;

// 將字串轉為 Uint8Array
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * 從 PIN 碼產生加密金鑰 (使用 PBKDF2)
 */
export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ENCRYPTION_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密字串
 * 回傳的格式為 base64(salt + iv + ciphertext)
 */
export async function encryptData(pin: string, data: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));
  const key = await deriveKey(pin, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  // 組合 salt + iv + ciphertext
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);

  // 轉為 Base64 (使用瀏覽器內建 btoa, 需要將 Uint8Array 轉字串)
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * 解密字串
 */
export async function decryptData(pin: string, encryptedBase64: string): Promise<string> {
  const binary = atob(encryptedBase64);
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    combined[i] = binary.charCodeAt(i);
  }

  const salt = combined.slice(0, SALT_SIZE);
  const iv = combined.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
  const ciphertext = combined.slice(SALT_SIZE + IV_SIZE);

  const key = await deriveKey(pin, salt);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error('解密失敗，PIN 碼可能錯誤。');
  }
}
