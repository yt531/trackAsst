'use client';

import { DataExportImport } from '@/components/settings/DataExportImport';
import { DataMigration } from '@/components/settings/DataMigration';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DataManagementPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">資料管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            匯出或匯入您的應用程式資料
          </p>
        </div>
      </header>

      <section>
        <DataMigration />
        <DataExportImport />
      </section>
    </div>
  );
}
