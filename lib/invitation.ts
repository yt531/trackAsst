import { db } from './firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { getLedgerInvitation, addLedgerMember, checkNicknameExists, getLedgerMembers, getLedger, LEDGER_COLLECTIONS } from './ledger';
import { LedgerRole, AppNotification } from '../types';

export const validateInvitation = async (
  inviteCode: string, 
  userEmail: string
): Promise<{ success: boolean; message: string; ledgerId?: string }> => {
  try {
    const invitation = await getLedgerInvitation(inviteCode);
    if (!invitation) return { success: false, message: '找不到此邀請碼' };
    if (invitation.status !== 'active') return { success: false, message: '此邀請碼已失效或被使用過' };
    if (invitation.expiresAt < Date.now()) return { success: false, message: '此邀請碼已過期' };
    
    if (invitation.targetEmailOrId && invitation.targetEmailOrId.toLowerCase() !== userEmail.toLowerCase()) {
      return { success: false, message: '您不是此邀請碼的指定受邀者' };
    }
    
    if (!invitation.targetEmailOrId && invitation.maxUsage !== undefined) {
      if (invitation.usageCount >= invitation.maxUsage) {
        return { success: false, message: '此邀請碼已達使用人數上限' };
      }
    }
    
    return { success: true, message: '邀請碼有效', ledgerId: invitation.ledgerId };
  } catch (error) {
    console.error('Error validating invitation:', error);
    return { success: false, message: '驗證邀請碼時發生錯誤' };
  }
};

export const verifyAndJoinLedger = async (
  inviteCode: string, 
  userEmail: string, 
  userId: string,
  nickname: string
): Promise<{ success: boolean; message: string; ledgerId?: string }> => {
  try {
    // 1. Re-validate invitation
    const validation = await validateInvitation(inviteCode, userEmail);
    if (!validation.success || !validation.ledgerId) {
      return validation;
    }
    
    const invitation = await getLedgerInvitation(inviteCode);
    if (!invitation) return { success: false, message: '找不到此邀請碼' };

    // 2. Check nickname
    const exists = await checkNicknameExists(invitation.ledgerId, nickname, userId);
    if (exists) {
      return { success: false, message: '此暱稱已被帳本中其他成員使用，請換一個' };
    }
    
    const existingMembers = await getLedgerMembers(invitation.ledgerId);
    const existingMember = existingMembers.find(m => m.userId === userId);

    if (existingMember) {
      if (existingMember.status === 'active') {
        return { success: false, message: '您已經是此帳本的成員' };
      }
      // Rejoin logic
      const { setDoc } = await import('firebase/firestore');
      const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, invitation.ledgerId, LEDGER_COLLECTIONS.MEMBERS, userId);
      await updateDoc(docRef, {
        status: 'active',
        role: invitation.defaultRole as LedgerRole,
        joinedAt: Date.now(),
        nickname: nickname
      });
      // Restore userMembership
      const userMembershipRef = doc(db, 'users', userId, 'ledgerMemberships', invitation.ledgerId);
      await setDoc(userMembershipRef, {
        ledgerId: invitation.ledgerId,
        role: invitation.defaultRole as LedgerRole,
        joinedAt: Date.now()
      });
    } else {
      // 3. Add user to ledger
      await addLedgerMember({
        id: userId,
        ledgerId: invitation.ledgerId,
        userId: userId,
        email: userEmail,
        role: invitation.defaultRole as LedgerRole,
        joinedAt: Date.now(),
        status: 'active',
        nickname: nickname,
        notificationPreferences: {
          all: true,
          newTransaction: true,
          updateTransaction: false,
          settlement: true,
          memberJoined: true
        }
      });
    }
    
    // Write to Activity Feed
    try {
      const { createActivityFeedItem } = await import('./transactions');
      await createActivityFeedItem(
        invitation.ledgerId,
        userId,
        'member_joined',
        `${nickname} 加入了帳本`
      );
    } catch (err) {
      console.error('Failed to create activity feed item:', err);
    }
    
    // 4. Update invitation status
    const newUsageCount = (invitation.usageCount || 0) + 1;
    const maxUsage = invitation.targetEmailOrId ? 1 : (invitation.maxUsage || 1);
    const newStatus = newUsageCount >= maxUsage ? 'used' : 'active';
    
    await updateDoc(doc(db, LEDGER_COLLECTIONS.INVITATIONS, inviteCode), {
      status: newStatus,
      usageCount: newUsageCount
    });

    // 5. Send notifications to existing members
    try {
      const ledger = await getLedger(invitation.ledgerId);
      // We already fetched existingMembers above, but we fetch again to get updated list 
      // or we can just use the existing one. Let's fetch again to be safe.
      const updatedMembers = await getLedgerMembers(invitation.ledgerId);
      
      if (ledger) {
        const { writeBatch, collection } = await import('firebase/firestore');
        const batch = writeBatch(db);
        let hasNotifications = false;

        updatedMembers.forEach(member => {
          if (member.userId !== userId && member.status === 'active' && (member.notificationPreferences?.all || member.notificationPreferences?.memberJoined)) {
            const notifRef = doc(collection(db, 'users', member.userId, 'notifications'));
            const notification: AppNotification = {
              id: notifRef.id,
              userId: member.userId,
              type: 'member_joined',
              title: '新成員加入',
              message: `${nickname} 加入了 ${ledger.name}`,
              link: `/ledgers/detail/settings/members?id=${ledger.id}`,
              isRead: false,
              createdAt: Date.now()
            };
            batch.set(notifRef, notification);
            hasNotifications = true;
          }
        });

        if (hasNotifications) {
          await batch.commit();
        }
      }
    } catch (notifErr) {
      console.error('Failed to send member joined notifications:', notifErr);
    }
    
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
