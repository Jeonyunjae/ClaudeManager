export type MessageSender = 'user' | 'main';
export type MessageType = 'text' | 'approval_request' | 'progress' | 'system';

export type ChatMessage = {
  id: string;
  sender: MessageSender;
  content: string;
  messageType: MessageType;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ChatSendRequest = {
  content: string;
};

export type ChatMessagesQuery = {
  page?: number;
  limit?: number;
  before?: string;
};
