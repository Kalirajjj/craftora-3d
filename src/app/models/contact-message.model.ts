export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  isRead?: boolean;
  read?: boolean;
  createdAt: string;
}

export interface MessagesListResponse {
  messages: ContactMessage[];
  totalCount: number;
  unreadCount: number;
  readCount: number;
}
