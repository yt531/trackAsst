// 輕鬆記推播 Worker
// 收到「通知/公告 ID」後：驗證呼叫者是該帳本管理員且為發佈人 → 從 Firestore 讀內容與收件人 → 以 FCM 推播。
// 內容一律由 Worker 自己從 Firestore 讀取，不信任呼叫端傳來的任何文字或收件人。

export interface Env {
  SERVICE_ACCOUNT_JSON: string; // 機密：服務帳戶金鑰（wrangler secret put）
  PROJECT_ID: string;
  DATABASE_ID: string;
  FIREBASE_API_KEY: string; // 公開的網頁 API 金鑰，僅用來驗證使用者的 ID token
  ALLOWED_ORIGINS: string; // 以逗號分隔
}

type FsValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: FsValue[] };
  mapValue?: { fields?: Record<string, FsValue> };
};
interface FsDoc {
  name: string;
  fields?: Record<string, FsValue>;
  updateTime?: string;
}
type Fields = Record<string, unknown>;

interface PushRequest {
  kind: 'notice' | 'announcement';
  ledgerId: string;
  id: string;
}

// Cloudflare 免費方案每次執行最多 50 個對外請求，預留一點餘裕
const MAX_SUBREQUESTS = 48;
// 每位收件人要多讀一次裝置清單，每個裝置要多發一次 FCM，都計入上面的請求額度，
// 因此一次推播最多處理這麼多位收件人（超過的會被略過並回報）
const MAX_RECIPIENTS = 30;
const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

interface Ctx {
  calls: number;
}

class BudgetExceeded extends Error {}

const api = (ctx: Ctx, url: string, init?: RequestInit) => {
  if (ctx.calls >= MAX_SUBREQUESTS) throw new BudgetExceeded('subrequest budget exceeded');
  ctx.calls++;
  return fetch(url, init);
};

// ---------- Firestore 值轉換 ----------
const decode = (v: FsValue): unknown => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue?.fields);
  return null;
};
const decodeFields = (fields?: Record<string, FsValue>): Fields =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, decode(v)]));

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// ---------- Google 驗證 ----------
const toB64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const textB64Url = (s: string) => toB64Url(new TextEncoder().encode(s));

const pemToDer = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

// 以服務帳戶金鑰簽發 JWT，換取 Google API 的存取權杖（同一個執行環境內快取）
const getAccessToken = async (ctx: Ctx, env: Env): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const sa = JSON.parse(env.SERVICE_ACCOUNT_JSON) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    textB64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    textB64Url(JSON.stringify({
      iss: sa.client_email,
      scope: SCOPES,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const res = await api(ctx, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${toB64Url(new Uint8Array(signature))}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
};

// 以 Firebase Identity Toolkit 驗證使用者的 ID token，回傳 uid；無效則回傳 null
const verifyIdToken = async (ctx: Ctx, env: Env, idToken: string): Promise<string | null> => {
  const res = await api(ctx, `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { users?: { localId?: string; disabled?: boolean }[] };
  const user = json.users?.[0];
  return user?.localId && !user.disabled ? user.localId : null;
};

// ---------- Firestore REST ----------
const docsBase = (env: Env) =>
  `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/${env.DATABASE_ID}/documents`;

const authHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

const fsGet = async (ctx: Ctx, env: Env, accessToken: string, path: string): Promise<FsDoc | null> => {
  const res = await api(ctx, `${docsBase(env)}/${path}`, { headers: authHeaders(accessToken) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore get ${path} failed: ${res.status}`);
  return (await res.json()) as FsDoc;
};

const fsList = async (ctx: Ctx, env: Env, accessToken: string, path: string): Promise<FsDoc[]> => {
  const res = await api(ctx, `${docsBase(env)}/${path}?pageSize=300`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error(`firestore list ${path} failed: ${res.status}`);
  return ((await res.json()) as { documents?: FsDoc[] }).documents ?? [];
};

// 以讀取時的 updateTime 當前置條件寫入 pushedAt：同一則只會有一個請求成功「認領」，避免重複推播
const claimPush = async (ctx: Ctx, env: Env, accessToken: string, doc: FsDoc, path: string): Promise<boolean> => {
  if (!doc.updateTime) return false;
  const url =
    `${docsBase(env)}/${path}?updateMask.fieldPaths=pushedAt` +
    `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
  const res = await api(ctx, url, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ fields: { pushedAt: { integerValue: String(Date.now()) } } }),
  });
  return res.ok;
};

interface Device {
  path: string; // 完整文件資源名稱，用於刪除失效的 token
  token: string;
}

// 逐位收件人讀取 users/{uid}/devices：只是一般的集合讀取，不需要任何索引
// （App 使用的 Firestore Enterprise 資料庫不支援設定欄位索引，因此不用集合群組查詢）
const fetchDevices = async (ctx: Ctx, env: Env, accessToken: string, userIds: string[]): Promise<Device[]> => {
  const lists = await Promise.all(userIds.map(async uid => {
    const res = await api(ctx, `${docsBase(env)}/users/${uid}/devices?pageSize=20`, { headers: authHeaders(accessToken) });
    if (!res.ok) throw new Error(`devices list failed: ${res.status}`);
    return ((await res.json()) as { documents?: FsDoc[] }).documents ?? [];
  }));
  const devices: Device[] = [];
  for (const documents of lists) {
    for (const document of documents) {
      const token = str(decodeFields(document.fields).token);
      if (token) devices.push({ path: document.name, token });
    }
  }
  return devices;
};

// ---------- 主流程 ----------
type JsonFn = (status: number, body: unknown) => Response;

const handlePush = async (request: Request, env: Env, json: JsonFn): Promise<Response> => {
  const ctx: Ctx = { calls: 0 };

  const authorization = request.headers.get('Authorization') ?? '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!idToken) return json(401, { error: 'missing token' });

  let body: PushRequest;
  try {
    body = (await request.json()) as PushRequest;
  } catch {
    return json(400, { error: 'invalid json' });
  }
  if (
    (body.kind !== 'notice' && body.kind !== 'announcement') ||
    !ID_PATTERN.test(String(body.ledgerId)) ||
    !ID_PATTERN.test(String(body.id))
  ) {
    return json(400, { error: 'invalid request' });
  }

  const uid = await verifyIdToken(ctx, env, idToken);
  if (!uid) return json(401, { error: 'invalid token' });

  const accessToken = await getAccessToken(ctx, env);
  const { kind, ledgerId, id } = body;

  // 呼叫者必須是該帳本的管理員
  const memberDoc = await fsGet(ctx, env, accessToken, `ledgers/${ledgerId}/members/${uid}`);
  const role = str(decodeFields(memberDoc?.fields).role);
  if (!memberDoc || (role !== 'admin' && role !== 'vice_admin')) return json(403, { error: 'not a ledger manager' });

  const itemPath = `ledgers/${ledgerId}/${kind === 'notice' ? 'notices' : 'announcements'}/${id}`;
  const itemDoc = await fsGet(ctx, env, accessToken, itemPath);
  if (!itemDoc) return json(404, { error: 'not found' });
  const item = decodeFields(itemDoc.fields);

  // 必須是自己發佈的；已刪除、已取消、已過期、已推播過的都不再推播
  if (str(item.authorId) !== uid) return json(403, { error: 'not the author' });
  if (item.pushedAt) return json(409, { error: 'already pushed' });
  if (kind === 'notice' && item.deleted) return json(410, { error: 'notice deleted' });
  if (kind === 'announcement') {
    const expiresAt = typeof item.expiresAt === 'number' ? item.expiresAt : 0;
    if (item.status !== 'active' || (expiresAt && expiresAt <= Date.now())) return json(410, { error: 'announcement inactive' });
  }

  // 收件人：通知 = 被標註者；公告 = 帳本全體成員；皆排除發佈人自己
  let recipientIds: string[];
  if (kind === 'notice') {
    recipientIds = strArray(item.mentionedIds);
  } else {
    const members = await fsList(ctx, env, accessToken, `ledgers/${ledgerId}/members`);
    recipientIds = members
      .map(m => decodeFields(m.fields))
      .filter(m => !m.status || m.status === 'active')
      .map(m => str(m.userId));
  }
  // 收件人 ID 來自資料庫內容，要組成路徑前先驗證格式
  recipientIds = Array.from(new Set(recipientIds.filter(r => r !== uid && ID_PATTERN.test(r))));
  if (recipientIds.length === 0) return json(200, { ok: true, sent: 0, note: 'no recipients' });
  const skippedRecipients = Math.max(0, recipientIds.length - MAX_RECIPIENTS);
  recipientIds = recipientIds.slice(0, MAX_RECIPIENTS);

  const ledgerDoc = await fsGet(ctx, env, accessToken, `ledgers/${ledgerId}`);
  const ledgerName = str(decodeFields(ledgerDoc?.fields).name) || '帳本';

  // 先讀裝置再認領：讀取階段失敗（例如額度不足）時不會誤標成「已推播」
  const devices = await fetchDevices(ctx, env, accessToken, recipientIds);
  if (devices.length === 0) return json(200, { ok: true, sent: 0, note: 'no registered devices', skippedRecipients });

  if (!(await claimPush(ctx, env, accessToken, itemDoc, itemPath))) return json(409, { error: 'already pushed' });

  const content = str(item.content).replace(/\s+/g, ' ').trim().slice(0, 100);
  const data = {
    title: `${ledgerName}：${kind === 'notice' ? '管理員通知' : '新公告'}`,
    body: content,
    url: `/ledgers/detail/timeline?id=${ledgerId}`,
    // 與 App 內本機通知使用相同 tag，兩者同時出現時只會顯示一則
    tag: kind === 'notice' ? `notice_${id}` : `announcement_${id}`,
  };

  // 預留少量請求額度給清理失效 token
  const sendLimit = Math.max(0, MAX_SUBREQUESTS - ctx.calls - 5);
  const targets = devices.slice(0, sendLimit);
  const invalid: Device[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(targets.map(async device => {
    const res = await api(ctx, `https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        message: { token: device.token, data, webpush: { headers: { Urgency: 'high', TTL: '86400' } } },
      }),
    });
    if (res.ok) {
      sent++;
      return;
    }
    failed++;
    // 只有 token 確定已失效（404 / UNREGISTERED）才清理，其他錯誤不動資料
    const errorText = await res.text();
    console.warn('fcm send failed', res.status, errorText.slice(0, 300));
    if (res.status === 404 || errorText.includes('UNREGISTERED')) invalid.push(device);
  }));

  let cleaned = 0;
  for (const device of invalid) {
    if (ctx.calls >= MAX_SUBREQUESTS) break;
    const res = await api(ctx, `https://firestore.googleapis.com/v1/${device.path}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (res.ok) cleaned++;
  }

  return json(200, { ok: true, sent, failed, cleaned, skipped: devices.length - targets.length, skippedRecipients });
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
    const originOk = allowedOrigins.includes(origin);
    const cors: Record<string, string> = originOk
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          Vary: 'Origin',
        }
      : {};
    const json: JsonFn = (status, body) => {
      // 供 `wrangler tail` 查看每次請求的結果（只含狀態與數量，不含任何機密或通知內容）
      console.log('push response', status, JSON.stringify(body));
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
    if (!originOk) return json(403, { error: 'forbidden origin' });

    try {
      return await handlePush(request, env, json);
    } catch (err) {
      console.error('push failed', err);
      return json(500, { error: err instanceof BudgetExceeded ? 'too many recipients' : 'internal error' });
    }
  },
};

export default worker;
