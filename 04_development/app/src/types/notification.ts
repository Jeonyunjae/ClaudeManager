export type NotificationType =
  | 'approval'
  | 'error'
  | 'complete'
  | 'cost'
  | 'recovery'
  | 'info'
  | 'warning'
  | 'key_expiry_warning';

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  sourceAgentId?: string;
  targetUrl?: string;
  isRead: boolean;
  createdAt: string;
};
