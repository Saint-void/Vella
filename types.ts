
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface SidebarChat {
  id: string;
  userId: string; // Linked to user
  title: string;
  timestamp: number;
  messages: Message[];
  isTitleGenerated?: boolean;
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
}

export interface VoiceSettings {
  voiceName: string;
  playbackRate: number;
}
