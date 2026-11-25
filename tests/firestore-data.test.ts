import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutUndefined } from '../lib/firestore-data.ts';

// WHY：Firestore 的 set()／update() 遇到 undefined 欄位值會直接丟錯（"Unsupported field value: undefined"），
// 「發起收款」在每人固定金額模式（totalAmount 為 undefined）就曾因此整個失敗。

test('移除值為 undefined 的欄位，其餘照舊', () => {
  assert.deepEqual(
    withoutUndefined({ title: '11月公積金', targetAmount: 200, totalAmount: undefined }),
    { title: '11月公積金', targetAmount: 200 },
  );
});

test('0、空字串、false、null 是有效值，必須保留（只移除 undefined）', () => {
  assert.deepEqual(
    withoutUndefined({ a: 0, b: '', c: false, d: null, e: undefined }),
    { a: 0, b: '', c: false, d: null },
  );
});

test('結果不含 undefined 欄位（連 key 都不存在），才不會被 Firestore 拒絕', () => {
  const result = withoutUndefined({ totalAmount: undefined, paidAmount: 0 });
  assert.equal('totalAmount' in result, false);
});

test('不修改傳入的原物件', () => {
  const input = { x: 1, y: undefined };
  withoutUndefined(input);
  assert.ok('y' in input);
});
