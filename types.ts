// FIX: Import React to resolve 'Cannot find namespace 'React'' error.
import React from 'react';

export enum Workflow {
  EXTRACT_METADATA = 'EXTRACT_METADATA',
  SUMMARIZE_QA = 'SUMMARIZE_QA',
  RAG_QUERY = 'RAG_QUERY',
  DRAFT_NOTICE = 'DRAFT_NOTICE',
  DETECT_MISSING_CLAUSES = 'DETECT_MISSING_CLAUSES',
}

export interface WorkflowOption {
  id: Workflow;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresQuery?: boolean;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export interface HistoryItem {
  id: number;
  fileName: string;
  workflowTitle: string;
  workflowId: Workflow;
  query?: string;
  timestamp: string;
  result: string | object | ChatMessage[];
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
  }
}
