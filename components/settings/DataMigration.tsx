'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function DataMigration() {
  const { user } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [migratedCount, setMigratedCount] = useState(0);

  const handleMigrate = async () => {
    if (!user) return;
    if (!confirm('即將進行資料庫升級，把舊的「備註」欄位移轉為「交易明細」。確定要執行嗎？')) return;

    setIsMigrating(true);
    setMigrationStatus('idle');
    try {
      const txRef = collection(db, 'users', user.uid, 'transactions');
      const snapshot = await getDocs(txRef);
      
      let count = 0;
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      snapshot.forEach((document) => {
        const data = document.data();
        if (data.notes !== undefined) {
          const docRef = doc(db, 'users', user.uid, 'transactions', document.id);
          const newData = { ...data };
          newData.details = data.notes || '';
          delete newData.notes;
          
          currentBatch.set(docRef, newData);
          count++;
          opCount++;

          if (opCount === 490) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            opCount = 0;
          }
        }
      });

      if (opCount > 0) {
        batches.push(currentBatch);
      }

      for (const batch of batches) {
        await batch.commit();
      }

      setMigratedCount(count);
      setMigrationStatus('success');
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationStatus('error');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div>
          <h3 className="font-medium text-blue-900 dark:text-blue-100">資料庫結構升級 (一次性)</h3>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            請點擊下方按鈕，將現有交易紀錄中的「備註」欄位全面升級為新的「交易明細」欄位，避免舊資料遺失。
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleMigrate}
              disabled={isMigrating || migrationStatus === 'success'}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isMigrating ? '升級中...' : '執行資料庫升級'}
            </button>
            {migrationStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> 成功升級 {migratedCount} 筆資料！
              </span>
            )}
            {migrationStatus === 'error' && (
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                升級失敗，請重試或聯繫開發者。
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
