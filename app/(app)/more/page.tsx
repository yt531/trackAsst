'use client';

import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { Target, BarChart2, Users, ChevronRight, Settings } from 'lucide-react';

export default function MoreFeaturesPage() {
  const moreFeatures = [
    { 
      name: '共享帳本', 
      href: '/ledgers', 
      icon: Users,
      description: '與朋友、家人一起記帳與分帳',
      color: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30'
    },
    { 
      name: '存錢目標', 
      href: '/saving-goals', 
      icon: Target,
      description: '設定並追蹤您的存錢計畫',
      color: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30'
    },
    { 
      name: '報表分析', 
      href: '/reports', 
      icon: BarChart2,
      description: '透過圖表了解您的收支狀況',
      color: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30'
    },
    { 
      name: '系統設定', 
      href: '/settings', 
      icon: Settings,
      description: '管理您的個人資料與應用程式偏好',
      color: 'text-zinc-500 dark:text-zinc-400',
      bg: 'bg-zinc-100 dark:bg-zinc-800'
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">更多功能</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          探索更多進階的財務管理工具
        </p>
      </header>

      <div className="grid gap-4">
        {moreFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link 
              key={feature.name}
              href={feature.href} 
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${feature.bg}`}>
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{feature.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{feature.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
