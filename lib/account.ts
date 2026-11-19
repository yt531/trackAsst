import { signInWithPopup, signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, doc, setDoc, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// 存在 localStorage 但不分帳號的項目：登出或換帳號時必須清除，避免下一位使用者繼承
// （pinHash 登入後會由雲端還原；其餘為此裝置的本機設定）
const ACCOUNT_BOUND_KEYS = [
  'pinHash',
  'lockScope',
  'idleTimeout',
  'biometricCredentialId',
  'cachedHomePrivacyLevel',
  'cachedDefaultPrivacyLevel',
  'cachedLedgerPrivacyLevel',
  'transactionsPrivacyLevel',
  'trackAsst_activeLedgerId',
];

// 離線時待同步的寫入永遠不會完成，逾時就視為「有尚未同步的資料」
export const hasUnsyncedWrites = async (timeoutMs = 3000): Promise<boolean> => {
  const synced = await Promise.race([
    waitForPendingWrites(db).then(() => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
  ]);
  return !synced;
};

const clearLocalAccountData = async () => {
  ACCOUNT_BOUND_KEYS.forEach(key => localStorage.removeItem(key));
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (e) {
    // 例如其他分頁仍開著而無法清除快取；不阻擋登出／切換
    console.warn('Failed to clear Firestore local cache', e);
  }
};

export const logout = async () => {
  await signOut(auth);
  await clearLocalAccountData();
  window.location.replace('/login');
};

// 直接在使用者點擊中開啟 Google 帳號選擇；成功換到不同帳號後才清理本機資料。
// 取消或失敗時目前帳號與本機資料都不會變動。
export const switchAccount = async (): Promise<'switched' | 'same'> => {
  const previousUid = auth.currentUser?.uid;
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user.uid === previousUid) return 'same';

  await setDoc(doc(db, 'users', result.user.uid), {
    email: result.user.email,
    displayName: result.user.displayName,
    lastLoginAt: Date.now(),
  }, { merge: true });
  await clearLocalAccountData();
  window.location.replace('/');
  return 'switched';
};
