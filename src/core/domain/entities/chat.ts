import { Message } from './message';

export interface Chat {
  id: string;
  isGroup: boolean;
  participants: string[];
  assignedAgent?: string;
  lastMessage?: Message;
  unreadCount: number;
}