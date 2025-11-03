import React, { useRef, useEffect } from 'react';
import { Send, Mic, Square, Volume2, Bot, User, FileUp, Sparkles, PlusCircle, Link } from 'lucide-react';
import { ChatMessage } from '../types';
import { FileUpload } from './FileUpload';

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
    files: File[];
    onFileChange: (files: File[]) => void;
    error: string | null;
    suggestedQuestions: string[];
    onSuggestionClick: (question: string) => void;
    onNewChat: () => void;
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
    currentlySpeakingMessageId,
    files,
    onFileChange,
    error,
    suggestedQuestions,
    onSuggestionClick,
    onNewChat
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasStartedChat = messages.length > 0;

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

    const renderWelcomeScreen = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-sky-400 mb-4">Welcome to DocuIntelli SaaS</h2>
                <p className="text-slate-400 mb-8">
                    Your AI-powered legal assistant. Upload documents for analysis or ask general questions powered by Google Search.
                </p>
                <FileUpload files={files} onFileChange={onFileChange} />
                
                {files.length > 0 && !isLoading && (
                  <div className="mt-6 w-full">
                      <p className="text-sm text-slate-400 mb-3">Ready to start? Try a quick action:</p>
                      <button
                          onClick={() => onSendMessage(`Please summarize the provided document${files.length > 1 ? 's' : ''}.`)}
                          className="inline-flex items-center justify-center w-full max-w-xs px-4 py-2 border border-sky-500/50 text-sky-300 bg-sky-500/10 rounded-full hover:bg-sky-500/20 transition-colors"
                      >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Summarize Document{files.length > 1 ? 's' : ''}
                      </button>
                  </div>
                )}

                 {error && (
                    <div className="mt-4 bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm">
                        <p>{error}</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderChatInterface = () => (
         <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <div className="overflow-hidden">
                    <h3 className="font-semibold text-slate-200 truncate">Current Session</h3>
                    <p className="text-xs text-slate-400 truncate" title={files.map(f => f.name).join(', ')}>
                       {files.length > 0 ? files.map(f => f.name).join(', ') : 'General Chat'}
                    </p>
                </div>
                <button 
                    onClick={onNewChat}
                    className="flex items-center text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md transition-colors"
                >
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    New Chat
                </button>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-6">
                {messages.map((msg, index) => (
                    <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-sky-300" />
                            </div>
                        )}
                        <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-slate-700 text-slate-200' : 'bg-slate-900/50 text-slate-300'}`}>
                            <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }}></div>

                             {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-700/50">
                                    <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
                                        <Link size={12} /> Sources
                                    </h4>
                                    <ul className="space-y-1">
                                    {msg.sources.map((source, i) => (
                                        <li key={i} className="flex">
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline truncate" title={source.uri}>
                                                {i+1}. {source.title || source.uri}
                                            </a>
                                        </li>
                                    ))}
                                    </ul>
                                </div>
                            )}

                             {msg.role === 'model' && msg.text && !isLoading && (
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
                {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                     <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-sky-300" />
                        </div>
                        <div className="max-w-md p-3 rounded-lg bg-slate-900/50 text-slate-300">
                           <LoadingSpinner />
                        </div>
                    </div>
                )}
                 {!isLoading && suggestedQuestions.length > 0 && (
                    <div className="flex items-start gap-3">
                         <div className="flex-shrink-0 w-8 h-8 rounded-full bg-transparent flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-sky-400/70" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {suggestedQuestions.map((q, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onSuggestionClick(q)}
                                    className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 text-slate-300 text-sm rounded-full hover:bg-slate-700 hover:border-slate-500 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
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
                        placeholder="Ask a follow-up question..."
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

    return hasStartedChat || files.length > 0 ? renderChatInterface() : renderWelcomeScreen();
};
