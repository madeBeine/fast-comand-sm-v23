
import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { Sparkles, X, Send, Bot, Loader2, TrendingUp, Volume2, Globe, Truck, BrainCircuit, VolumeX, MapPin, Key, AlertCircle, ExternalLink as LinkIcon, Mic, MicOff, StopCircle } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useLanguage } from '../contexts/LanguageContext';
import { useSound } from '../contexts/SoundContext';
import { AuthContext } from '../contexts/AuthContext';
import type { Order, Shipment, Client, DashboardStats } from '../types';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    groundingMetadata?: any;
    isSpeaking?: boolean;
}

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    shipments: Shipment[];
    clients: Client[];
    stats: DashboardStats | null;
}

// --- Audio Helpers ---
function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, orders, shipments, clients, stats }) => {
    const { currentUser } = useContext(AuthContext); 
    const isAdmin = currentUser?.role === 'admin';
    const isViewer = currentUser?.role === 'viewer';
    const isEmployee = currentUser?.role === 'employee';

    const [hasApiKey, setHasApiKey] = useState<boolean>(!!process.env.API_KEY);
    const [messages, setMessages] = useState<Message[]>([
        { 
            id: 'init',
            role: 'model', 
            text: `أهلاً بك **${currentUser?.username || 'سيدي'}** في **Fast Comand AI** 🚀\n\nأنا مساعدك الذكي المتطور. يمكنني مساعدتك في تحليل بيانات الطلبات، الشحنات، والبحث عن معلومات في الويب.\n\nكيف يمكنني مساعدتك اليوم؟` 
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            checkKey();
        }
        return () => {
            stopAudio(); 
        };
    }, [isOpen]);

    const checkKey = async () => {
        if (process.env.API_KEY) {
            setHasApiKey(true);
            return;
        }
        if ((window as any).aistudio?.hasSelectedApiKey) {
            const has = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(has);
        }
    };

    const handleSelectKey = async () => {
        if ((window as any).aistudio?.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
            setHasApiKey(true); 
        }
    };

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isLoading, isListening]);

    // --- Speech to Text ---
    const toggleListening = () => {
        if (isListening) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) {
            alert("متصفحك لا يدعم خاصية التعرف على الصوت.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        };
        
        recognition.start();
    };

    // --- Gemini TTS ---
    const playGeminiTTS = async (text: string, messageId: string) => {
        if (!hasApiKey || isPlayingAudio) {
            stopAudio();
            if (isPlayingAudio) return;
        }

        setIsPlayingAudio(true);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isSpeaking: true } : { ...m, isSpeaking: false }));

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const cleanText = text.replace(/[*_#`]/g, '');

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: cleanText }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data");

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const binary = decodeAudio(base64Audio);
            const float32Array = new Float32Array(binary.length / 2);
            const dataView = new DataView(binary.buffer);

            for (let i = 0; i < float32Array.length; i++) {
                float32Array[i] = dataView.getInt16(i * 2, true) / 32768.0;
            }

            const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
            audioBuffer.getChannelData(0).set(float32Array);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            
            source.onended = () => {
                setIsPlayingAudio(false);
                setMessages(prev => prev.map(m => ({ ...m, isSpeaking: false })));
            };

            audioSourceRef.current = source;
            source.start();

        } catch (e) {
            console.error("TTS Error", e);
            setIsPlayingAudio(false);
            setMessages(prev => prev.map(m => ({ ...m, isSpeaking: false })));
        }
    };

    const stopAudio = () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }
        setIsPlayingAudio(false);
        setMessages(prev => prev.map(m => ({ ...m, isSpeaking: false })));
    };

    const secureContext = useMemo(() => {
        let ctx = `DATABASE SNAPSHOT:
        - Clients Count: ${clients.length}
        - Total Orders: ${orders.length}
        - Active Orders: ${orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length}
        - Completed Orders: ${orders.filter(o => o.status === 'completed').length}
        - Total Shipments: ${shipments.length}
        `;

        // FINANCIAL PRIVACY: Only show money to admin/viewer
        if (isAdmin || isViewer) {
            ctx += `
            FINANCIAL ACCESS GRANTED:
            - Net Profit: ${stats?.profit || 0} MRU
            - Total Debt: ${stats?.debt || 0} MRU
            - Total Revenue: ${stats?.revenue || 0} MRU
            - Cash Collected: ${stats?.cash || 0} MRU
            `;
        } else {
            ctx += `
            FINANCIAL PRIVACY ENABLED: You DO NOT have access to money details. 
            If the user asks about profit, revenue, or debts, tell them: "عذراً، ليس لدي صلاحية الوصول للبيانات المالية في حسابك الحالي."
            `;
        }
        return ctx;
    }, [isAdmin, isViewer, stats, clients.length, orders, shipments.length]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessageText = input.trim();
        const newUserMessage: Message = { id: Date.now().toString(), role: 'user', text: userMessageText };
        
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const systemInstruction = `You are "Fast Comand AI", a highly efficient logistics intelligence.
            ${secureContext}
            Rules:
            1. Use Google Search for tracking data or market prices if needed.
            2. Professional and direct tone. 
            3. Answer in Arabic. 
            4. If asked about user roles, you know the current user is an ${currentUser?.role}.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                    ...messages.slice(-10).map(m => ({
                        role: m.role,
                        parts: [{ text: m.text }]
                    })),
                    { role: 'user', parts: [{ text: userMessageText }] }
                ],
                config: { 
                    systemInstruction, 
                    tools: [{ googleSearch: {} }] 
                }
            });

            const replyText = response.text || 'عذراً، لم أتمكن من الحصول على رد.';
            const grounding = response.candidates?.[0]?.groundingMetadata;

            setMessages(prev => [...prev, { 
                id: Date.now().toString(),
                role: 'model', 
                text: replyText,
                groundingMetadata: grounding
            }]);
        } catch (e: any) {
            console.error("AI Error:", e);
            let errMsg = "حدث خطأ في الاتصال بالمساعد الذكي.";
            if (e.message?.includes('429')) errMsg = "لقد وصلت للحد الأقصى للاستخدام المجاني حالياً.";
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: errMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[200] flex justify-end transition-all duration-500 ${isOpen ? 'bg-black/60 backdrop-blur-md' : 'pointer-events-none'}`} onClick={onClose}>
            <div className={`w-full md:w-[600px] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-transform duration-500 ease-out border-l dark:border-slate-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b dark:border-slate-800 bg-slate-900 text-white shrink-0">
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20"><BrainCircuit size={28} className="text-white" /></div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight flex items-center gap-2">Fast Comand AI <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-indigo-300">FLASH v3</span></h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Intelligence</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                    </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-black/40 custom-scrollbar">
                    {!hasApiKey ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
                            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shadow-lg">
                                <Key size={40} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">مفتاح API مطلوب</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">يرجى تفعيل مفتاح API للوصول لميزات الذكاء الاصطناعي المتقدمة والصوت والبحث في الويب.</p>
                            </div>
                            <button onClick={handleSelectKey} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-3"><Sparkles size={20}/> تفعيل المساعد الآن</button>
                        </div>
                    ) : (
                        <>
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-3`}>
                                    <div className={`max-w-[90%] flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className="relative group">
                                            <div className={`p-5 rounded-3xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'}`}>
                                                <div className="whitespace-pre-wrap font-medium">{m.text}</div>
                                                
                                                {m.groundingMetadata?.groundingChunks && (
                                                    <div className="mt-4 pt-3 border-t dark:border-gray-700/50">
                                                        <p className="text-[10px] opacity-70 font-bold uppercase mb-2 flex items-center gap-1"><Globe size={10}/> المصادر:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {m.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => chunk.web && (
                                                                <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/5 dark:bg-white/10 rounded-lg text-[10px] hover:bg-indigo-500 hover:text-white transition-colors font-bold truncate max-w-[200px]">
                                                                    <LinkIcon size={10}/> {chunk.web.title || 'رابط'}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {m.role === 'model' && (
                                                <button 
                                                    onClick={() => playGeminiTTS(m.text, m.id)} 
                                                    className={`absolute -left-10 bottom-0 p-2 rounded-full transition-all ${m.isSpeaking ? 'text-red-500 bg-red-100 animate-pulse' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 opacity-0 group-hover:opacity-100'}`}
                                                >
                                                    {m.isSpeaking ? <StopCircle size={20} fill="currentColor"/> : <Volume2 size={20}/>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                    {isLoading && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 p-4 rounded-3xl rounded-tl-none border shadow-lg flex items-center gap-3"><Loader2 className="animate-spin text-indigo-500" size={18}/><span className="text-[10px] text-slate-400 font-black uppercase animate-pulse">جاري المعالجة...</span></div></div>}
                </div>

                {hasApiKey && (
                    <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shadow-2xl shrink-0">
                        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center gap-2">
                            <input 
                                type="text" 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                placeholder={isListening ? "جاري الاستماع..." : "اسأل عن أي شيء..."}
                                className="flex-1 py-4 px-5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 border-none transition-all font-bold text-slate-800 dark:text-white shadow-inner"
                            />

                            <button type="button" onClick={toggleListening} className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500'}`} title="تحدث">
                                {isListening ? <MicOff size={22}/> : <Mic size={22}/>}
                            </button>

                            <button type="submit" disabled={isLoading || !input.trim()} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                                <Send size={22}/>
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIAssistant;
