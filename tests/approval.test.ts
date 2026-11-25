import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIncomeCounted } from '../lib/approval.ts';

// WHY：被退回的繳款曾被算進「可用公積金」。退回代表這筆錢沒有收到，不能計入餘額與已繳金額。

test('已核准的收入計入', () => {
  assert.equal(isIncomeCounted('approved'), true);
});

test('沒有狀態的舊資料（核准機制之前建立的）計入', () => {
  assert.equal(isIncomeCounted(undefined), true);
});

test('待審的收入不計入（它在待審清單，核准後才算）', () => {
  assert.equal(isIncomeCounted('pending'), false);
});

test('被退回的收入不計入', () => {
  assert.equal(isIncomeCounted('rejected'), false);
});

test('已取消的收入不計入', () => {
  assert.equal(isIncomeCounted('cancelled'), false);
});

test('等待刪除審核的收入仍計入（已核准過，審核通過前不會真的刪除）', () => {
  assert.equal(isIncomeCounted('pending_delete'), true);
});
