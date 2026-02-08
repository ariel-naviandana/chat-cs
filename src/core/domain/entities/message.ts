export interface Message {
  id: string;
  chatId: string;
  from: string;
  fromMe: boolean;
  text?: string;
  media?: {
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
    url?: string;
    mimeType?: string;
    fileName?: string;
  };
  quotedMessageId?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  isPinned: boolean;
}