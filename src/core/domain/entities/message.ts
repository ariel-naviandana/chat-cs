export interface Message {
  id: string;                  // ID pesan dari WhatsApp (key.id)
  chatId: string;              // JID chat: '628123456789@s.whatsapp.net' atau group JID
  from: string;                // Pengirim (JID atau 'me' kalau dari agent)
  fromMe: boolean;
  text?: string;               // Isi teks pesan
  media?: {
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
    url?: string;              // URL setelah di-download (nanti kita handle)
    mimeType?: string;
    fileName?: string;
  };
  quotedMessageId?: string;    // ID pesan yang di-reply
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  isPinned: boolean;
}