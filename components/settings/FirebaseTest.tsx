'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function FirebaseTest() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const testConnection = async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      // Create a dummy query just to verify connection works
      const q = query(collection(db, 'users'), limit(1));
      await getDocs(q);
      setStatus('success');
    } catch (error: any) {
      console.error("Firebase connection test failed:", error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to connect to Firebase Firestore');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">System Status</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
              status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
              'bg-zinc-100 dark:bg-zinc-800'
            }`}>
              <Activity className={`h-5 w-5 ${
                status === 'success' ? 'text-green-600 dark:text-green-400' :
                status === 'error' ? 'text-red-600 dark:text-red-400' :
                'text-zinc-500'
              }`} />
            </div>
            <div>
              <div className="font-medium">Firebase Connection</div>
              <div className="text-sm text-zinc-500">
                Test the connection to Firestore Database
              </div>
            </div>
          </div>

          <button
            onClick={testConnection}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'loading' ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {status === 'success' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/20">
            <CheckCircle2 className="h-4 w-4" />
            Connection successful!
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 flex flex-col gap-1 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4" />
              Connection failed
            </div>
            <p className="text-xs break-words font-mono mt-1 opacity-80">{errorMessage}</p>
            <p className="text-xs mt-2 text-zinc-600 dark:text-zinc-400">
              Ensure you have set the NEXT_PUBLIC_FIREBASE_* environment variables in .env.local and restarted the app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
