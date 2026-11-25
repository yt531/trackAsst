import type { Transaction } from '../types';

// 公積金收入是否要計入餘額與「已繳」：
// - pending（待審）：尚未核准，另外列在待審清單，不計入
// - rejected（被退回）、cancelled（已取消）：不成立，不計入
// - approved、pending_delete（已核准、等待刪除審核，尚未真的刪除）與沒有狀態的舊資料：計入
export const isIncomeCounted = (status?: Transaction['approvalStatus']): boolean =>
  status !== 'pending' && status !== 'rejected' && status !== 'cancelled';
