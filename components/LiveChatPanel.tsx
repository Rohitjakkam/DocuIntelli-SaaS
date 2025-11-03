import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob, Part } from "@google/genai";
import { Mic, Square, Bot, User, FileUp, Loader2, AudioLines, AlertTriangle } from 'lucide-react';
import { summarizeFilesForVoiceChat, fileToGenerativePart } from '../services/geminiService';
import { FileUpload } from './FileUpload';

// --- Audio Encoding/Decoding Helpers (as per Gemini documentation) ---
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}
// --- End Helpers ---


interface LiveChatPanelProps {
    files: File[];
    onFileChange: (files: File[]) => void;
    setError: (error: string | null) => void;
}

interface TranscriptionItem {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export const LiveChatPanel: React.FC<LiveChatPanelProps> = ({ files, onFileChange, setError: setAppError }) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionItem[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [transcriptionHistory]);

    const cleanup = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        setIsSessionActive(false);
    }, []);

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    const handleStartConversation = async () => {
        if (files.length === 0) {
            setError("Please upload at least one document to start a voice conversation.");
            return;
        }
        setError(null);
        setAppError(null);
        setIsLoadingSummary(true);
        setTranscriptionHistory([]);

        try {
            const fileParts: Part[] = await Promise.all(
                files.map(async (file) => ({
                    inlineData: await fileToGenerativePart(file)
                }))
            );
            const summary = await summarizeFilesForVoiceChat(fileParts);
            setIsLoadingSummary(false);

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            
            let currentInputTranscription = '';
            let currentOutputTranscription = '';

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        setIsSessionActive(true);
                        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription.trim();
                            const fullOutput = currentOutputTranscription.trim();
                            if (fullInput) setTranscriptionHistory(prev => [...prev, {id: `user-${Date.now()}`, role: 'user', text: fullInput}]);
                            if (fullOutput) setTranscriptionHistory(prev => [...prev, {id: `model-${Date.now()}`, role: 'model', text: fullOutput}]);
                            currentInputTranscription = '';
                            currentOutputTranscription = '';
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            const outputCtx = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => sourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(source => source.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError("Connection error. Please try again.");
                        cleanup();
                    },
                    onclose: () => {
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: `You are DocuIntelli, a helpful voice assistant. Use the following summary of the user's documents as context for this conversation:\n\n${summary}`,
                },
            });

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to start voice session.");
            setIsLoadingSummary(false);
            cleanup();
        }
    };

    const handleStopConversation = () => {
        cleanup();
    };

    const renderWelcome = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-sky-400 mb-4">Voice Chat with your Documents</h2>
                <p className="text-slate-400 mb-8">
                    Upload your documents, then start a real-time conversation to ask questions and get insights, all through voice.
                </p>
                <FileUpload files={files} onFileChange={onFileChange} />
                 {error && (
                    <div className="mt-4 bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <p>{error}</p>
                    </div>
                )}
                 <div className="mt-8">
                     <button
                        onClick={handleStartConversation}
                        disabled={files.length === 0 || isLoadingSummary}
                        className="inline-flex items-center justify-center w-full max-w-xs px-6 py-3 border border-transparent text-base font-medium rounded-full text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        {isLoadingSummary ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5 mr-3" />
                                Preparing Context...
                            </>
                        ) : (
                             <>
                                <Mic className="h-5 w-5 mr-3" />
                                Start Voice Conversation
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
    
    const renderActiveSession = () => (
        <div className="h-full flex flex-col p-4">
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                {transcriptionHistory.map(item => (
                    <div key={item.id} className={`flex items-start gap-3 ${item.role === 'user' ? 'justify-end' : ''}`}>
                        {item.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center"><Bot className="w-5 h-5 text-sky-300" /></div>}
                        <div className={`max-w-xl p-3 rounded-lg text-sm ${item.role === 'user' ? 'bg-slate-700 text-slate-200' : 'bg-slate-900/50 text-slate-300'}`}>
                           {item.text}
                        </div>
                        {item.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center"><User className="w-5 h-5 text-slate-200" /></div>}
                    </div>
                ))}
                <div ref={transcriptEndRef} />
            </div>
            <div className="flex-shrink-0 pt-4 text-center">
                 <div className="flex justify-center items-center gap-4 mb-4">
                    <AudioLines className="h-6 w-6 text-sky-400 animate-pulse" />
                    <p className="text-sky-300 font-medium">Live Conversation is Active</p>
                 </div>
                 <button
                    onClick={handleStopConversation}
                    className="inline-flex items-center justify-center w-full max-w-xs px-6 py-3 border border-transparent text-base font-medium rounded-full text-white bg-red-600 hover:bg-red-700"
                >
                    <Square className="h-5 w-5 mr-3" />
                    Stop Conversation
                </button>
            </div>
        </div>
    );

    return isSessionActive ? renderActiveSession() : renderWelcome();
};