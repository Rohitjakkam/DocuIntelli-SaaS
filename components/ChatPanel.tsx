import React, { useRef, useEffect } from 'react';
import { Send, Mic, Square, Volume2, Bot, User } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
    messages: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (message: string) => void;
    query: string;
    setQuery: (query: string) => void;
    isRecording: boolean;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onReadAloud: (text: string, messageId: string) => void;
    currentlySpeakingMessageId: string | null;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></div>
        <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
);

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
    messages, 
    isLoading, 
    onSendMessage,
    query,
    setQuery,
    isRecording,
    onStartRecording,
    onStopRecording,
    onReadAloud,
    currentlySpeakingMessageId
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSendMessage(query);
        }
    };
    
    const handleMicClick = () => {
        if(isRecording) {
            onStopRecording();
        } else {
            onStartRecording();
        }
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow p-4 overflow-y-auto space-y-6">
                {messages.map((msg, index) => (
                    <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-sky-300" />
                            </div>
                        )}
                        <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-slate-700 text-slate-200' : 'bg-slate-900/50 text-slate-300'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                             {msg.role === 'model' && msg.text && (
                                <button
                                    onClick={() => onReadAloud(msg.text, msg.id)}
                                    className={`mt-2 p-1 rounded-full transition-colors ${currentlySpeakingMessageId === msg.id ? 'bg-sky-500 text-white' : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                    aria-label="Read aloud"
                                >
                                    <Volume2 size={14} />
                                </button>
                             )}
                        </div>
                        {msg.role === 'user' && (
                             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                                <User className="w-5 h-5 text-slate-200" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                     <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-sky-300" />
                        </div>
                        <div className="max-w-md p-3 rounded-lg bg-slate-900/50 text-slate-300">
                           <LoadingSpinner />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-slate-700">
                <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={handleMicClick}
                        className={`p-2 rounded-full transition-colors ${isRecording ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                    >
                        {isRecording ? <Square size={20} /> : <Mic size={20} />}
                    </button>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type your question or use the mic..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};
