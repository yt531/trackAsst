/**
 * WebAuthn (生物辨識) 工具
 * 用於前端純 UI 鎖定。此實作不會將憑證傳送至後端驗證，
 * 僅作為前端解鎖捷徑。
 */

// 產生隨機的 Challenge (為了滿足 WebAuthn API 要求)
const generateChallenge = () => window.crypto.getRandomValues(new Uint8Array(32));

/**
 * 檢查裝置是否支援 WebAuthn
 */
export async function isWebAuthnSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

/**
 * 註冊新的生物辨識憑證
 * @param username 使用者名稱 (僅用於顯示)
 * @returns Base64URL 格式的 credential ID
 */
export async function registerBiometric(username: string = 'LocalUser'): Promise<string> {
  if (!(await isWebAuthnSupported())) {
    throw new Error('此裝置不支援生物辨識。');
  }

  const userId = window.crypto.getRandomValues(new Uint8Array(16));
  
  const createOptions: PublicKeyCredentialCreationOptions = {
    challenge: generateChallenge(),
    rp: {
      name: 'FinTrack Security',
      // id: 如果在 localhost 開發，通常不填或填 localhost
    },
    user: {
      id: userId,
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // 限制為平台驗證器 (Face ID, Touch ID, Windows Hello)
      userVerification: 'required', // 要求驗證
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none'
  };

  const credential = await navigator.credentials.create({ publicKey: createOptions }) as PublicKeyCredential;
  
  if (!credential) {
    throw new Error('生物辨識註冊失敗。');
  }

  // 將 ArrayBuffer 轉為 base64url，儲存於 localStorage
  return arrayBufferToBase64Url(credential.rawId);
}

/**
 * 驗證生物辨識憑證
 * @param credentialIdBase64Url 之前註冊的 credential ID
 */
export async function authenticateBiometric(credentialIdBase64Url: string): Promise<boolean> {
  if (!(await isWebAuthnSupported())) {
    throw new Error('此裝置不支援生物辨識。');
  }

  const getOptions: PublicKeyCredentialRequestOptions = {
    challenge: generateChallenge(),
    allowCredentials: [
      {
        id: base64UrlToArrayBuffer(credentialIdBase64Url),
        type: 'public-key',
        transports: ['internal'],
      }
    ],
    userVerification: 'required',
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey: getOptions });
    return !!assertion;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
}

// Helpers for ArrayBuffer <-> Base64URL conversion
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = base64.length % 4;
  const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
  
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
