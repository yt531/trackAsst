import { db } from './firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { getLedgerInvitation, addLedgerMember, LEDGER_COLLECTIONS } from './ledger';
import { LedgerRole } from '../types';

export const verifyAndJoinLedger = async (
  inviteCode: string, 
  userEmail: string, 
  userId: string
): Promise<{ success: boolean; message: string; ledgerId?: string }> => {
  try {
    // 1. Get the invitation
    const invitation = await getLedgerInvitation(inviteCode);
    
    if (!invitation) {
      return { success: false, message: '找不到此邀請碼' };
    }
    
    // 2. Check if active
    if (invitation.status !== 'active') {
      return { success: false, message: '此邀請碼已失效或被使用過' };
    }
    
    // 3. Check expiration
    if (invitation.expiresAt < Date.now()) {
      return { success: false, message: '此邀請碼已過期' };
    }
    
    // 4. Check email (if specified)
    if (invitation.targetEmailOrId && invitation.targetEmailOrId.toLowerCase() !== userEmail.toLowerCase()) {
      return { success: false, message: '您不是此邀請碼的指定受邀者' };
    }
    
    // 4.5. Check maxUsage if no target email is specified
    if (!invitation.targetEmailOrId && invitation.maxUsage !== undefined) {
      if (invitation.usageCount >= invitation.maxUsage) {
        return { success: false, message: '此邀請碼已達使用人數上限' };
      }
    }
    
    // 5. Add user to ledger
    await addLedgerMember({
      id: userId,
      ledgerId: invitation.ledgerId,
      userId: userId,
      role: invitation.defaultRole as LedgerRole,
      joinedAt: Date.now(),
      status: 'active',
      notificationPreferences: {
        all: true,
        newTransaction: true,
        updateTransaction: false,
        settlement: true
      }
    });
    
    // 6. Update invitation status
    const newUsageCount = (invitation.usageCount || 0) + 1;
    const maxUsage = invitation.targetEmailOrId ? 1 : (invitation.maxUsage || 1);
    const newStatus = newUsageCount >= maxUsage ? 'used' : 'active';
    
    await updateDoc(doc(db, LEDGER_COLLECTIONS.INVITATIONS, inviteCode), {
      status: newStatus,
      usageCount: newUsageCount
    });
    
    return { 
      success: true, 
      message: '成功加入帳本', 
      ledgerId: invitation.ledgerId 
    };
  } catch (error) {
    console.error('Error joining ledger:', error);
    return { success: false, message: '加入帳本時發生錯誤' };
  }
};

export const generateShortCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
