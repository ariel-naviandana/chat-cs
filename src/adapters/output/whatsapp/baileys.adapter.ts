import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { WhatsappPort } from '../../../core/application/ports/output/whatsapp.port';
import { Message } from '../../../core/domain/entities/message';
import { Chat } from '../../../core/domain/entities/chat';

export class BaileysAdapter implements WhatsappPort {
  private sock: any = null;
  private sentMessageIds: Set<string> = new Set();

  async initialize(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info/baileys');
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      syncFullHistory: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('=== QR CODE UNTUK LOGIN WHATSAPP ===');
        qrcode.generate(qr, { small: true });
        console.log('\nScan kotak-kotak di atas pakai WhatsApp → Perangkat Tertaut → Tautkan Perangkat');
        console.log('QR expire dalam ~20 detik. Kalau hilang, stop & jalankan ulang server.');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed. Reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          this.initialize();
        } else {
          console.log('Logged out. Hapus folder auth_info untuk login ulang.');
        }
      }

      if (connection === 'open') {
        console.log('Baileys berhasil terhubung ke WhatsApp!');
      }
    });
  }

  async subscribePresence(chatId: string): Promise<void> {
    if (!this.sock) {
      console.warn('[Baileys] sock belum siap untuk subscribe presence');
      return;
    }

    try {
      await this.sock.presenceSubscribe(chatId);
      console.log('[Baileys] Berhasil subscribe presence untuk chat:', chatId);
    } catch (err) {
      console.error('[Baileys] Gagal subscribe presence untuk', chatId, ':', err);
    }
  }

  onMessage(callback: (message: Message) => Promise<void>): void {
    this.sock.ev.on('messages.upsert', async (m: any) => {
      console.log('[Baileys] RAW messages.upsert:', JSON.stringify(m, null, 2));

      const msg = m.messages?.[0];
      if (!msg) return;

      let chatId = msg.key.remoteJid;

      if (chatId.endsWith('@lid')) {
        chatId = msg.key.remoteJidAlt || msg.key.participant || chatId;
        console.log('[Baileys] Remap LID → JID asli:', chatId);
      }

      if (!msg.message || m.type !== 'notify') {
        console.log('[Baileys] Skip: bukan notify atau tidak ada message');
        return;
      }

      if (msg.key.fromMe) {
        console.log('[Baileys] Skip: pesan outgoing kita sendiri');
        return;
      }

      let text = '';
      if (msg.message.conversation) text = msg.message.conversation;
      else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;

      const parsedMessage: Message = {
        id: msg.key.id!,
        chatId,
        from: msg.key.participant || msg.key.remoteJid!,
        fromMe: msg.key.fromMe === true,
        text,
        status: 'delivered',
        timestamp: new Date((msg.messageTimestamp || 0) * 1000),
        isPinned: false,
      };

      console.log('[Baileys] Processing incoming (remapped):', parsedMessage.id, parsedMessage.text);
      await callback(parsedMessage);
    });
  }

  async sendMessage(
    chatId: string,
    content: { text?: string; quotedId?: string; media?: any }
  ): Promise<{ messageId: string; timestamp: number }> {
    if (!this.sock) throw new Error('Baileys belum diinisialisasi');

    console.log('[Baileys] Mencoba kirim pesan ke:', chatId);

    const msgContent: any = { text: content.text || '' };

    if (content.quotedId) {
      msgContent.quoted = { key: { id: content.quotedId }, message: { conversation: '...' } };
    }

    try {
      const sent = await this.sock.sendMessage(chatId, msgContent);
      const messageId = sent?.key?.id || '';

      if (!messageId) {
        throw new Error('Tidak mendapatkan message ID dari Baileys');
      }

      console.log('[Baileys] Sukses kirim! Message key ID:', messageId);

      this.sentMessageIds.add(messageId);

      return {
        messageId,
        timestamp: sent.messageTimestamp || Math.floor(Date.now() / 1000),
      };
    } catch (err) {
      console.error('[Baileys] GAGAL KIRIM PESAN:', err);
      throw err;
    }
  }

  onPresenceUpdate(callback: (update: { chatId: string; isOnline: boolean; isTyping: boolean; lastSeen?: Date }) => void): void {
    this.sock.ev.on('presence.update', (upd: any) => {
      console.log('[Baileys] RAW presence.update:', JSON.stringify(upd, null, 2));

      const isTyping = upd.presence?.unavailable !== true && upd.presence?.composing;
      const parsed = {
        chatId: upd.id,
        isOnline: upd.presence?.available === true,
        isTyping: !!isTyping,
        lastSeen: upd.lastSeen ? new Date(upd.lastSeen * 1000) : undefined,
      };

      console.log('[Baileys] Parsed presence:', parsed);
      callback(parsed);
    });
  }

  onReceiptUpdate(callback: (update: { messageId: string; status: 'delivered' | 'read' }) => void): void {
    this.sock.ev.on('message-receipt.update', (updates: any[]) => {
      console.log('[Baileys] RAW receipt event:', JSON.stringify(updates, null, 2));

      for (const upd of updates) {
        const key = upd.key?.id;
        if (!key) continue;

        let status: 'delivered' | 'read' | undefined;
        if (upd.receipt?.readTimestamp) status = 'read';
        else if (upd.receipt?.deliveryTimestamp) status = 'delivered';

        if (status) {
          console.log('[Baileys] Receipt detected:', { messageId: key, status });
          callback({ messageId: key, status });
        }
      }
    });
  }

  async sendTyping(chatId: string, isTyping: boolean): Promise<void> {
    if (!this.sock) return;
    await this.sock.presenceSubscribe(chatId);
    await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', chatId);
  }

  async pinMessage(chatId: string, messageId: string, pin: boolean): Promise<void> {
    if (!this.sock) return;
    await this.sock.chatModify(
      { pin: { action: pin ? 'pin' : 'unpin', messageId } },
      chatId
    );
  }

  async getChat(chatId: string): Promise<Chat | null> {
    if (!this.sock) return null;

    const isGroup = chatId.includes('@g.us');
    let participants: string[] = [];

    if (isGroup) {
      try {
        const metadata = await this.sock.groupMetadata(chatId);
        participants = metadata.participants.map((p: any) => p.id);
      } catch {}
    }

    return {
      id: chatId,
      isGroup,
      participants,
      unreadCount: 0,
    };
  }
}