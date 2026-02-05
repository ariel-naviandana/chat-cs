import { Message } from './message';

export interface Chat {
  id: string;                  // JID chat
  isGroup: boolean;
  participants: string[];      // Array JID peserta (untuk group)
  assignedAgent?: string;      // ID agent CS yang handle chat ini
  lastMessage?: Message;       // Referensi pesan terakhir (opsional)
  unreadCount: number;
}