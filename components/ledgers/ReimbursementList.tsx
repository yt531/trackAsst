'use client';

import { Wallet } from 'lucide-react';
import type { Transaction } from '@/types';

// 代墊待撥款清單；管理員／副管理員（canSettle）可核准並撥款，其餘成員只看到等待狀態
export function ReimbursementList({
  reimbursements,
  canSettle,
  onSettle
}: {
  reimbursements: Transaction[];
  canSettle: boolean;
  onSettle: (tx: Transaction) => void;
}) {
  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-bold">代墊待撥款 ({reimbursements.length})</h3>
      </div>
      {reimbursements.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm">
          目前沒有待撥款的代墊項目
        </div>
      ) : (
        <div className="space-y-3">
          {reimbursements.map(tx => (
            <div key={tx.id} className="flex flex-col gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{tx.details}</div>
                  <div className="text-xs text-zinc-500">代墊人: User {tx.userId.slice(0,4)}</div>
                </div>
                <div className="font-bold text-amber-600 dark:text-amber-400">
                  ${tx.amount.toLocaleString()}
                </div>
              </div>
              {canSettle ? (
                <button 
                  onClick={() => onSettle(tx)}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors mt-2"
                >
                  核准並撥款
                </button>
              ) : (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center py-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  等待管理員核准
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
