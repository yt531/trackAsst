'use client';

import React, { useState, useMemo } from 'react';
import { Search, User, Check, X } from 'lucide-react';
import { LedgerMember } from '@/types';

interface MemberSelectorProps {
  members: LedgerMember[];
  selectedIds: string[];
  onChange: (newIds: string[]) => void;
  currentUserUid?: string;
  footerText?: React.ReactNode;
  className?: string;
  renderMemberExtra?: (member: LedgerMember, isIncluded: boolean) => React.ReactNode;
}

export function MemberSelector({
  members,
  selectedIds,
  onChange,
  currentUserUid,
  footerText,
  className = '',
  renderMemberExtra
}: MemberSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'view' | 'include' | 'exclude'>('include');

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members;
    const lowerSearch = searchTerm.toLowerCase();
    return members.filter(m => 
      (m.nickname && m.nickname.toLowerCase().includes(lowerSearch)) ||
      m.userId.toLowerCase().includes(lowerSearch) ||
      (m.email && m.email.toLowerCase().includes(lowerSearch))
    );
  }, [members, searchTerm]);

  const { included, excluded } = useMemo(() => {
    const inc: LedgerMember[] = [];
    const exc: LedgerMember[] = [];
    
    filteredMembers.forEach(m => {
      if (selectedIds.includes(m.userId)) {
        inc.push(m);
      } else {
        exc.push(m);
      }
    });
    
    return { included: inc, excluded: exc };
  }, [filteredMembers, selectedIds]);

  const handleToggle = (memberId: string, currentStatus: 'included' | 'excluded') => {
    if (activeTab === 'view') return; // View mode is read-only
    
    if (currentStatus === 'included') {
      onChange(selectedIds.filter(id => id !== memberId));
    } else {
      onChange([...selectedIds, memberId]);
    }
  };

  const displayedList = activeTab === 'view' ? included : (activeTab === 'include' ? included : excluded);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-zinc-400" />
        </div>
        <input
          type="text"
          placeholder="搜尋暱稱、ID 或 Email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('view')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'view' ? 'bg-white shadow text-blue-600 dark:bg-zinc-700 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          檢視名單
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('include')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'include' ? 'bg-white shadow text-blue-600 dark:bg-zinc-700 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          包含 ({included.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exclude')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'exclude' ? 'bg-white shadow text-blue-600 dark:bg-zinc-700 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          排除 ({excluded.length})
        </button>
      </div>

      {/* Member List */}
      <div className="flex flex-wrap gap-2 max-h-[35vh] md:max-h-60 overflow-y-auto p-2 border border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700">
        {displayedList.length === 0 ? (
          <div className="w-full text-center py-4 text-xs text-zinc-500">
            {activeTab === 'view' ? '名單為空' : (activeTab === 'include' ? '沒有符合的包含成員' : '沒有排除的成員')}
          </div>
        ) : (
          displayedList.map(m => {
            const isMe = m.userId === currentUserUid;
            const displayName = isMe ? '我' : (m.nickname || m.userId.slice(0, 4));
            const hasBalance = (m.balance || 0) > 0;
            const isIncluded = activeTab === 'view' || activeTab === 'include';

            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => handleToggle(m.userId, isIncluded ? 'included' : 'excluded')}
                disabled={activeTab === 'view'}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                  activeTab === 'view' 
                    ? 'border-blue-200 bg-blue-50 text-blue-700 cursor-default dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300' 
                    : isIncluded 
                      ? 'border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:border-blue-400 dark:bg-blue-900/50 dark:text-blue-100 dark:hover:bg-blue-900/70' 
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>{displayName}</span>
                {hasBalance && !renderMemberExtra && (
                  <span className="ml-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full dark:bg-emerald-900/50 dark:text-emerald-400">
                    ${m.balance}
                  </span>
                )}
                {renderMemberExtra && renderMemberExtra(m, isIncluded)}
                {activeTab !== 'view' && (
                  isIncluded ? <Check className="h-3.5 w-3.5 ml-1 opacity-70" /> : <X className="h-3.5 w-3.5 ml-1 opacity-70" />
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer Text */}
      {footerText && (
        <div className="text-sm font-medium text-blue-600 bg-blue-50 p-2.5 rounded-lg text-center dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
          {footerText}
        </div>
      )}
    </div>
  );
}
