import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileUp, Search, History } from 'lucide-react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ChatPanel } from './components/ChatPanel';
import { Footer } from './components/Footer';
import { HistoryItem, ChatMessage, SpeechRecognition } from './types';
import { continueChat, fileToGenerativePart } from './services/geminiService';
import { HistoryPanel } from './components/HistoryPanel';
import type { Part } from '@google/genai';
import { PDFDocument } from 'pdf-lib';

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  // Unified Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Speech recognition state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Speech synthesis state
  const [currentlySpeakingMessageId, setCurrentlySpeakingMessageId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('docuIntelliHistory');
      if (storedHistory) setHistory(JSON.parse(storedHistory));
    } catch (e) { console.error("Failed to load history", e); }
  }, []);

  useEffect(() => {
    try {
      // Don't save empty chat sessions to history
      if (history.some(item => item.messages.length > 0)) {
        localStorage.setItem('docuIntelliHistory', JSON.stringify(history));
      }
    } catch (e) { console.error("Failed to save history", e); }
  }, [history]);

  const handleFileChange = async (selectedFiles: File[]) => {
    setError(null);

    // Handle case where files are cleared
    if (selectedFiles.length === 0) {
      setFiles([]);
      handleReset(false);
      return;
    }

    setIsLoading(true);

    try {
      for (const file of selectedFiles) {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          try {
            const pdfDoc = await PDFDocument.load(arrayBuffer, {
              ignoreEncryption: true,
            });
            const pageCount = pdfDoc.getPageCount();

            if (pageCount > 1000) {
              throw new Error(
                `'${file.name}' (${pageCount} pages) exceeds the 1000-page limit.`
              );
            }
          } catch (pdfError) {
            console.error('PDF processing error:', pdfError);
            throw new Error(
              `Failed to process '${file.name}'. The file may be corrupt or encrypted.`
            );
          }
        }
      }

      // If all files are valid
      setFiles(selectedFiles);
      handleReset(false);

    } catch (e: any) {
      setError(e.message || 'An error occurred during file validation.');
      setFiles([]); // Clear files on error to force re-upload
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendMessage = async (message: string) => {
    if (files.length === 0 && chatMessages.length === 0) {
      setError('Please upload at least one document to start the chat.');
      return;
    }

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: message };
    const currentChatHistory = [...chatMessages, userMessage];

    setChatMessages(currentChatHistory);
    setIsLoading(true);
    setError(null);
    setQuery('');
    setSuggestedQuestions([]);
    
    // Create a placeholder for the model's response
    const modelMessageId = `model-${Date.now()}`;
    const modelMessagePlaceholder: ChatMessage = { id: modelMessageId, role: 'model', text: '' };
    setChatMessages(prev => [...prev, modelMessagePlaceholder]);

    try {
      // Only include files in the first message of a session
      const fileParts: Part[] = chatMessages.length === 0 
        ? await Promise.all(
            files.map(async (file) => ({
                inlineData: await fileToGenerativePart(file)
            }))
          ) 
        : [];
        
      const result = await continueChat(currentChatHistory, fileParts);
      
      // Update the placeholder with the actual response
      setChatMessages(prev => prev.map(msg => 
        msg.id === modelMessageId ? { ...msg, text: result.response } : msg
      ));
      
      setSuggestedQuestions(result.suggestions || []);

    } catch (e) {
      console.error(e);
      const errorText = e instanceof Error ? e.message : 'An unknown error occurred.';
       setChatMessages(prev => prev.map(msg => 
        msg.id === modelMessageId ? { ...msg, text: `Error: ${errorText}` } : msg
      ));
    } finally {
      setIsLoading(false);
      // Save the full chat history after the stream is complete
      setChatMessages(prev => {
        saveToHistory(prev);
        return prev;
      });
    }
  };

  const saveToHistory = (messages: ChatMessage[]) => {
    if (messages.length === 0) return;
    
    // Use the first user message as the title, or a generic title
    const firstUserMessage = messages.find(m => m.role === 'user')?.text;
    const title = firstUserMessage ? (firstUserMessage.length > 40 ? firstUserMessage.substring(0, 37) + '...' : firstUserMessage) : "New Chat Session";

    const newItem: HistoryItem = {
      id: selectedHistoryId || Date.now(),
      title: title,
      timestamp: new Date().toISOString(),
      messages: messages,
      fileNames: files.map(f => f.name),
    };

    // Remove previous history entry for the same session if it exists, then add the new one
    const updatedHistory = history.filter(item => item.id !== newItem.id);
    setHistory([newItem, ...updatedHistory]);
    setSelectedHistoryId(newItem.id);
  };


  const handleReset = (fullReset = true) => {
    if (fullReset) setFiles([]);
    setQuery('');
    setIsLoading(false);
    setError(null);
    setSelectedHistoryId(null);
    setChatMessages([]);
    setSuggestedQuestions([]);
    if (isRecording) handleStopRecording();
    handleStopSpeaking();
  };

  const handleHistoryItemClick = (id: number) => {
    const item = history.find(h => h.id === id);
    if (item) {
      handleReset(false); // Reset state but keep files
      setChatMessages(item.messages);
      setSelectedHistoryId(item.id);
      // Note: We can't re-select the original files, but we can show their names.
      // The context of those files is baked into the saved conversation history.
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure? This will clear your entire history.')) {
      setHistory([]);
      localStorage.removeItem('docuIntelliHistory');
      handleReset();
    }
  };

  // --- Speech Recognition Logic ---
  const handleStartRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.interimResults = true;
    recognitionRef.current.continuous = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => setIsRecording(true);
    recognitionRef.current.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
    };
    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
    };

    let finalTranscript = '';
    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setQuery(finalTranscript + interimTranscript);
    };

    recognitionRef.current.start();
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };
  
  // --- Speech Synthesis Logic ---
  const handleReadAloud = (text: string, messageId: string) => {
    if (currentlySpeakingMessageId === messageId) {
        handleStopSpeaking();
        return;
    }
    setError(null); // Clear previous errors
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setCurrentlySpeakingMessageId(messageId);
    utterance.onend = () => setCurrentlySpeakingMessageId(null);
    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      console.error("Speech synthesis error:", e.error, e);
      setCurrentlySpeakingMessageId(null);
      setError(`Speech synthesis error: ${e.error}. Please check your browser audio settings.`);
    }
    window.speechSynthesis.cancel(); // Stop any previous speech
    window.speechSynthesis.speak(utterance);
  };
  
  const handleStopSpeaking = () => {
    window.speechSynthesis.cancel();
    setCurrentlySpeakingMessageId(null);
  };

  const handleSuggestionClick = (question: string) => {
    setQuery(question); // Set query for user visibility
    handleSendMessage(question);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col">
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                <ChatPanel 
                    messages={chatMessages}
                    isLoading={isLoading}
                    onSendMessage={handleSendMessage}
                    query={query}
                    setQuery={setQuery}
                    isRecording={isRecording}
                    onStartRecording={handleStartRecording}
                    onStopRecording={handleStopRecording}
                    onReadAloud={handleReadAloud}
                    currentlySpeakingMessageId={currentlySpeakingMessageId}
                    files={files}
                    onFileChange={handleFileChange}
                    error={error}
                    suggestedQuestions={suggestedQuestions}
                    onSuggestionClick={handleSuggestionClick}
                    onNewChat={() => handleReset(true)}
                />
            </div>
            
            <div className="lg:col-span-4 flex flex-col">
                <h2 className="text-2xl font-bold text-sky-400 mb-4 flex items-center"><History className="h-6 w-6 mr-3 text-sky-400/80" /> History</h2>
                <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                    <HistoryPanel history={history} selectedId={selectedHistoryId} onItemClick={handleHistoryItemClick} onClear={handleClearHistory} />
                </div>
            </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;