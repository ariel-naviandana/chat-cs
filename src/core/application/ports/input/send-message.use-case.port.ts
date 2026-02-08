export interface SendMessageUseCasePort {
  execute(dto: {
    chatId: string;
    text?: string;
    quotedId?: string;
    media?: { type: string; buffer: Buffer; mimeType: string };
    tempId?: string;
  }): Promise<string>;
}