import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileUp, FileText, HelpCircle, FileWarning, Gavel, Search, ClipboardCopy, History } from 'lucide-react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { WorkflowSelector } from './components/WorkflowSelector';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ChatPanel } from './components/ChatPanel';
import { Footer } from './components/Footer';
import { Workflow, WorkflowOption, HistoryItem, ChatMessage, SpeechRecognition } from './types';
import { startChat, fileToGenerativePart, runWorkflow } from './services/geminiService';
import { HistoryPanel } from './components/HistoryPanel';
import type { Chat, Part } from '@google/genai';

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | object | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [displayedFileName, setDisplayedFileName] = useState<string | undefined>(undefined);
  const [displayedWorkflowTitle, setDisplayedWorkflowTitle] = useState<string | undefined>(undefined);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);

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
      localStorage.setItem('docuIntelliHistory', JSON.stringify(history));
    } catch (e) { console.error("Failed to save history", e); }
  }, [history]);
  
  // Effect to manage chat session reference
  useEffect(() => {
    chatSessionRef.current = chatSession;
  }, [chatSession]);

  const workflowOptions: WorkflowOption[] = useMemo(() => [
    { id: Workflow.EXTRACT_METADATA, title: 'Extract Metadata', description: 'Extract key info like case name, judges, and dates.', icon: FileText },
    { id: Workflow.SUMMARIZE_QA, title: 'Summarize & Q&A', description: 'Generate a summary and potential Q&A from the document.', icon: HelpCircle },
    { id: Workflow.RAG_QUERY, title: 'Query Document (Chat)', description: 'Start an interactive chat about the document contents.', icon: Search, requiresQuery: true },
    { id: Workflow.DRAFT_NOTICE, title: 'Draft Legal Notice', description: 'Generate a draft legal notice based on the document.', icon: Gavel },
    { id: Workflow.DETECT_MISSING_CLAUSES, title: 'Find Missing Clauses', description: 'Analyze contracts for missing standard clauses.', icon: FileWarning },
  ], []);

  const currentWorkflow = useMemo(() => workflowOptions.find(w => w.id === selectedWorkflow), [selectedWorkflow, workflowOptions]);
  
  const handleFileChange = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    handleReset(false);
  };
  
  const handleProcessClick = async () => {
    if (files.length === 0 || !selectedWorkflow || !currentWorkflow) {
      setError('Please select one or more files and a workflow.');
      return;
    }
    if (currentWorkflow.requiresQuery && !query.trim()) {
      setError('Please enter an initial query for this workflow.');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);
    setSelectedHistoryId(null);
    setChatMessages([]);
    setChatSession(null);
    setDisplayedFileName(files.map(f => f.name).join(', '));
    setDisplayedWorkflowTitle(currentWorkflow.title);

    try {
      if (selectedWorkflow === Workflow.RAG_QUERY) {
        const newChatSession = await startChat();
        setChatSession(newChatSession);
        await handleSendChatMessage(query, newChatSession, files);
      } else {
        const apiResult = await runWorkflow(files, selectedWorkflow);
        setResult(apiResult);
        saveToHistory(apiResult);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendChatMessage = async (message: string, session?: Chat | null, initialFiles?: File[]) => {
      const currentSession = session || chatSessionRef.current;
      const documentFiles = initialFiles || files;

      if (documentFiles.length === 0 || (!currentSession && selectedWorkflow !== Workflow.RAG_QUERY)) return;

      const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: message };
      setChatMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      setQuery('');

      const modelMessage: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: '' };
      setChatMessages(prev => [...prev, modelMessage]);

      try {
          const fileParts: Part[] = await Promise.all(
              documentFiles.map(async (file) => ({
                  inlineData: await fileToGenerativePart(file)
              }))
          );
          
          const messagePayload: (string | Part)[] = [
              { text: message },
              ...fileParts
          ];
          
          const stream = await currentSession.sendMessageStream({
            message: messagePayload,
          });

          for await (const chunk of stream) {
              const chunkText = chunk.text;
              if (chunkText) {
                  setChatMessages(prev => prev.map(msg => 
                      msg.id === modelMessage.id ? { ...msg, text: msg.text + chunkText } : msg
                  ));
              }
          }
      } catch (e) {
          console.error(e);
          const errorText = e instanceof Error ? e.message : 'An error occurred while streaming the response.';
          setChatMessages(prev => prev.map(msg => 
              msg.id === modelMessage.id ? { ...msg, text: `Error: ${errorText}` } : msg
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

  const saveToHistory = (data: string | object | ChatMessage[]) => {
    if (files.length === 0 || !currentWorkflow) return;
    
    // Remove previous history entry for the same session if it exists
    const updatedHistory = history.filter(item => item.id !== selectedHistoryId);

    const newItem: HistoryItem = {
      id: selectedHistoryId || Date.now(),
      fileName: files.map(f => f.name).join(', '),
      workflowTitle: currentWorkflow.title,
      workflowId: selectedWorkflow,
      query: Array.isArray(data) ? data.find(m => m.role === 'user')?.text : query,
      timestamp: new Date().toISOString(),
      result: data,
    };
    setHistory([newItem, ...updatedHistory]);
    setSelectedHistoryId(newItem.id);
  };


  const handleReset = (fullReset = true) => {
    if (fullReset) setFiles([]);
    setSelectedWorkflow(null);
    setQuery('');
    setResult(null);
    setIsLoading(false);
    setError(null);
    setSelectedHistoryId(null);
    setDisplayedFileName(undefined);
    setDisplayedWorkflowTitle(undefined);
    setChatMessages([]);
    setChatSession(null);
    chatSessionRef.current = null;
    if (isRecording) handleStopRecording();
    handleStopSpeaking();
  };

  const handleHistoryItemClick = (id: number) => {
    const item = history.find(h => h.id === id);
    if (item) {
      handleReset(false); // Reset state but keep files
      if(item.workflowId === Workflow.RAG_QUERY && Array.isArray(item.result)) {
        setChatMessages(item.result);
        setResult(null);
      } else {
        setResult(item.result);
        setChatMessages([]);
      }
      setSelectedWorkflow(item.workflowId);
      setSelectedHistoryId(item.id);
      setDisplayedFileName(item.fileName);
      setDisplayedWorkflowTitle(item.workflowTitle);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure? This will clear your entire history.')) {
      setHistory([]);
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

  const isProcessButtonDisabled = files.length === 0 || !selectedWorkflow || isLoading || (currentWorkflow?.requiresQuery && !query.trim());
  const isChatActive = selectedWorkflow === Workflow.RAG_QUERY && (chatMessages.length > 0 || isLoading);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-sky-400 mb-4 flex items-center"><span className="bg-sky-400/20 text-sky-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-mono text-lg">1</span> Configure</h2>
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-6">
              <FileUpload files={files} onFileChange={handleFileChange} />
              <WorkflowSelector options={workflowOptions} selected={selectedWorkflow} onSelect={setSelectedWorkflow} />
              {currentWorkflow?.requiresQuery && !isChatActive && (
                <div>
                  <label htmlFor="query" className="block text-sm font-medium text-slate-300 mb-2">Initial Query</label>
                  <input type="text" id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g., What was the final ruling?" className="w-full bg-slate-900 border border-slate-600 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              )}
            </div>
          </div>
          <div className="flex space-x-4">
             <button onClick={handleProcessClick} disabled={isProcessButtonDisabled || isChatActive} className="w-full flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">
              {isLoading && !isChatActive ? 'Processing...' : 'Start Session'}
            </button>
            <button onClick={() => handleReset(true)} className="px-6 py-3 border border-slate-600 text-base font-medium rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Reset</button>
          </div>
        </div>
        
        <div className="lg:col-span-5 flex flex-col">
          <h2 className="text-2xl font-bold text-sky-400 mb-4 flex items-center"><span className="bg-sky-400/20 text-sky-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-mono text-lg">2</span> Results</h2>
          <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
            {isChatActive ? (
                <ChatPanel 
                    messages={chatMessages}
                    isLoading={isLoading}
                    onSendMessage={(msg) => handleSendChatMessage(msg)}
                    query={query}
                    setQuery={setQuery}
                    isRecording={isRecording}
                    onStartRecording={handleStartRecording}
                    onStopRecording={handleStopRecording}
                    onReadAloud={handleReadAloud}
                    currentlySpeakingMessageId={currentlySpeakingMessageId}
                />
            ) : (
                <ResultsDisplay isLoading={isLoading} error={error} result={result} fileName={displayedFileName} workflow={displayedWorkflowTitle} hasHistory={history.length > 0} />
            )}
          </div>
        </div>
        
        <div className="lg:col-span-3 flex flex-col">
            <h2 className="text-2xl font-bold text-sky-400 mb-4 flex items-center"><span className="bg-sky-400/20 text-sky-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-mono text-lg">3</span> History</h2>
            <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                <HistoryPanel history={history} selectedId={selectedHistoryId} onItemClick={handleHistoryItemClick} onClear={handleClearHistory} />
            </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;