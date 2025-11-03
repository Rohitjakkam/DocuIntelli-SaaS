// FIX: Import React to resolve 'Cannot find namespace 'React'' error.
import React from 'react';

export interface Source {
    uri: string;
    title: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    sources?: Source[];
}

export interface HistoryItem {
  id: number;
  title: string;
  timestamp: string;
  messages: ChatMessage[];
  fileNames: string[];
}

// FIX: Add types for Web Speech API to resolve 'SpeechRecognition' not found errors in App.tsx.
export interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: () => void;
  onerror: (event: any) => void;
  onresult: (event: any) => void;
  onstart: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
    // FIX: Add webkitAudioContext to the Window interface to fix type errors in LiveChatPanel.tsx for older Safari browsers.
    webkitAudioContext: typeof AudioContext;
  }
}
