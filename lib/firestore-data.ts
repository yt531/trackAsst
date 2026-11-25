// Firestore 不接受 undefined 的欄位值：呼叫 set()／update() 時會在送出前就丟出
// "Unsupported field value: undefined"。寫入前先用這個移除值為 undefined 的欄位。
export function withoutUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}
