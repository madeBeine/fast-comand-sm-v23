
import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { Sparkles, X, Send, Loader2, Volume2, Camera, BrainCircuit, VolumeX, MapPin, Globe, Key, FileText, BarChart3, Search, Volume1, AudioLines, ShoppingBag, ExternalLink, Tag, Image as ImageIcon, Link as LinkIcon, Database, Info, Truck } from 'lucide-react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { useSound } from '../contexts/SoundContext';
import { AuthContext } from '../contexts/AuthContext';
import type { Order, Shipment, Client, DashboardStats } from '../types';

interface Message {
    role: 'user' | 'model';
    text: string;
    image?: string; 
    isCountryPicker?: boolean;
    groundingChunks?: any[];
    audioData?: string; 
    products?: any[];
}

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    shipments: Shipment[];
    clients: Client[];
    stats: DashboardStats | null;
}

// --- Manual Decode Functions as per Guidelines ---
function decodeBase64(base64: string) {
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

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, orders, shipments, clients, stats }) => {
    const { currentUser } = useContext(AuthContext); 
    const { playSound } = useSound();

    const [messages, setMessages] = useState<Message[]>([
        { 
            role: 'model', 
            text: `مرحباً بك يا ${currentUser?.username || 'زميلي'}. أنا مساعدك الذكي في Fast Comand. يمكنني مساعدتك في تتبع الطلبات، تحليل أداء الشحن، أو حتى البحث عن أسعار المنتجات في الأسواق العالمية باستخدام صورة المنتج. كيف يمكنني خدمتك؟` 
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const pendingFileRef = useRef<File | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Prepare a concise context of the system data to feed the AI
    const systemContext = useMemo(() => {
        const activeOrders = orders.slice(0, 20).map(o => ({
            id: o.localOrderId,
            status: o.status,
            client: clients.find(c => c.id === o.clientId)?.name,
            weight: o.weight,
            due: (o.priceInMRU || 0) + (o.commission || 0) + (o.shippingCost || 0) - (o.amountPaid || 0)
        }));

        const activeShipments = shipments.slice(0, 5).map(s => ({
            id: s.shipmentNumber,
            status: s.status,
            eta: s.expectedArrivalDate
        }));

        return JSON.stringify({
            stats: {
                totalOrders: stats?.totalOrders,
                revenue: stats?.revenue,
                profit: stats?.profit,
                debt: stats?.debt
            },
            recentOrders: activeOrders,
            recentShipments: activeShipments
        });
    }, [orders, shipments, clients, stats]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const playVoice = async (base64Audio: string) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') await ctx.resume();
            if (currentSourceRef.current) currentSourceRef.current.stop();

            const audioBytes = decodeBase64(base64Audio);
            const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => setIsSpeaking(false);
            setIsSpeaking(true);
            source.start(0);
            currentSourceRef.current = source;
        } catch (e) {
            console.error("Audio Error:", e);
            setIsSpeaking(false);
        }
    };

    const handleSend = async (overrideText?: string, targetCountry?: string) => {
        const currentFile = attachedFile || pendingFileRef.current;
        const textToSend = overrideText || input;
        
        if (!textToSend.trim() && !currentFile && !targetCountry) return;

        if (currentFile && !targetCountry) {
            const userImgPreview = attachedImage;
            pendingFileRef.current = currentFile;
            setMessages(prev => [...prev, 
                { role: 'user', text: textToSend || 'تحليل هذا المنتج', image: userImgPreview || undefined },
                { role: 'model', text: 'جاري تحليل الصورة... حدد السوق للبحث عن السعر بدقة:', isCountryPicker: true }
            ]);
            setAttachedFile(null);
            setAttachedImage(null);
            setInput('');
            playSound('pop');
            return;
        }

        const newUserMessage: Message = { 
            role: 'user', 
            text: targetCountry ? `بحث في سوق: ${targetCountry}` : textToSend, 
            image: targetCountry ? undefined : (attachedImage || undefined) 
        };
        
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setAttachedImage(null);
        setAttachedFile(null);
        setIsLoading(true);
        playSound('click');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const isShopping = !!targetCountry;
            const modelName = isShopping ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

            const parts: any[] = [{ text: isShopping ? `Analyze image and find exact products in ${targetCountry} online stores. Return structured JSON array.` : textToSend }];
            if (currentFile) parts.push(await fileToGenerativePart(currentFile));

            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    ...messages.filter(m => !m.isCountryPicker).slice(-4).map(m => ({
                        role: m.role,
                        parts: [{ text: m.text }]
                    })),
                    { role: 'user', parts }
                ],
                config: { 
                    systemInstruction: `You are "Fast Comand AI", a professional logistics assistant. 
                    CURRENT SYSTEM CONTEXT: ${systemContext}.
                    Use this context to answer questions about orders, stats, and shipments. 
                    If the user provides an image for a product search, identify it and look for prices in the requested market.
                    Always be professional, concise, and helpful. Use Arabic as the primary language.`,
                    tools: isShopping ? [{ googleSearch: {} }] : undefined,
                    responseMimeType: isShopping ? "application/json" : undefined,
                    responseSchema: isShopping ? {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                price: { type: Type.STRING },
                                store: { type: Type.STRING },
                                url: { type: Type.STRING },
                                image: { type: Type.STRING }
                            },
                            required: ['name', 'price', 'store', 'url']
                        }
                    } : undefined
                }
            });

            const replyText = response.text || 'عذراً، لم أتمكن من المعالجة.';
            const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            
            let products: any[] | undefined = undefined;
            if (isShopping) {
                try { products = JSON.parse(replyText); } catch(e) {}
            }

            setMessages(prev => [...prev, { 
                role: 'model', 
                text: isShopping ? 'بناءً على صورتك وبحثي في المتاجر، إليك أفضل النتائج المتوفرة:' : replyText, 
                groundingChunks: grounding,
                products: products
            }]);
            
            pendingFileRef.current = null;

            if (!isShopping) {
                try {
                    const ttsResponse = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-preview-tts',
                        contents: [{ parts: [{ text: replyText.substring(0, 300) }] }],
                        config: {
                            responseModalities: [Modality.AUDIO],
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
                        }
                    });
                    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) playVoice(base64Audio);
                } catch (e) {}
            }

        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'model', text: `⚠️ عذراً، حدث خطأ: ${e.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[200] flex justify-end transition-all duration-500 ${isOpen ? 'bg-black/60 backdrop-blur-sm' : 'pointer-events-none opacity-0'}`} onClick={onClose}>
            <div className={`w-full md:w-[500px] h-full bg-white dark:bg-slate-950 shadow-2xl flex flex-col transition-transform duration-500 border-l dark:border-slate-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-5 bg-slate-900 text-white shrink-0 flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                            <BrainCircuit size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-base uppercase tracking-wider flex items-center gap-2">
                                Fast Comand AI
                                {isSpeaking && <AudioLines size={14} className="text-emerald-400 animate-pulse"/>}
                            </h2>
                            <p className="text-[10px] text-indigo-300/50 font-bold uppercase">Pro Logistics Assistant</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors"><X size={24}/></button>
                </div>

                {/* Chat Feed */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-black/40 custom-scrollbar">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                            <div className={`max-w-[95%] flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                {m.image && (
                                    <div className="relative group">
                                        <img src={m.image} alt="Input" className="rounded-2xl border-2 border-indigo-500/50 shadow-lg max-w-[150px] transition-transform group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl pointer-events-none"></div>
                                    </div>
                                )}
                                
                                <div className={`p-4 rounded-2xl text-sm shadow-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-tl-none border dark:border-slate-800'}`}>
                                    <div className="whitespace-pre-wrap">{m.text}</div>

                                    {/* Products Grid */}
                                    {m.products && (
                                        <div className="mt-4 grid grid-cols-1 gap-3">
                                            {m.products.map((p, idx) => (
                                                <div key={idx} className="bg-slate-50 dark:bg-black/20 border dark:border-slate-800 rounded-xl p-3 flex gap-3 group hover:border-indigo-500/50 transition-colors">
                                                    <div className="w-16 h-16 bg-white rounded-lg flex-shrink-0 flex items-center justify-center border overflow-hidden">
                                                        {p.image ? <img src={p.image} className="w-full h-full object-contain p-1" alt="p"/> : <ShoppingBag size={24} className="text-slate-300"/>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-bold text-xs truncate dark:text-white">{p.name}</h5>
                                                        <p className="text-emerald-600 dark:text-emerald-400 font-black text-xs mt-1">{p.price}</p>
                                                        <div className="flex justify-between items-center mt-2">
                                                            <span className="text-[10px] text-slate-400 font-bold">{p.store}</span>
                                                            <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors">عرض المتجر</a>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {m.isCountryPicker && (
                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t dark:border-slate-800">
                                            {['دبي 🇦🇪', 'الصين 🇨🇳', 'تركيا 🇹🇷', 'أمريكا 🇺🇸'].map(label => (
                                                <button key={label} onClick={() => handleSend('', label)} className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-600 hover:text-white rounded-xl text-indigo-700 dark:text-indigo-300 font-black text-xs transition-all border border-indigo-100 dark:border-indigo-900">
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {m.groundingChunks && m.groundingChunks.length > 0 && (
                                        <div className="mt-3 pt-3 border-t dark:border-slate-800 space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest"><Globe size={10}/> المصادر المستخدمة في التحليل:</p>
                                            {m.groundingChunks.map((chunk, idx) => chunk.web && (
                                                <a key={idx} href={chunk.web.uri} target="_blank" rel="noreferrer" className="block text-[10px] text-indigo-400 truncate hover:underline">• {chunk.web.title}</a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl rounded-tl-none border dark:border-slate-800 flex items-center gap-3">
                                <Loader2 className="animate-spin text-indigo-500" size={20}/>
                                <span className="text-xs font-bold text-slate-500 animate-pulse">جاري التحليل والبحث...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-950 border-t dark:border-slate-900 shrink-0">
                    <div className="mb-2 flex gap-2">
                        <button onClick={() => handleSend("أعطني ملخصاً عن حالة الطلبات النشطة")} className="text-[9px] font-black bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border dark:border-slate-800 flex items-center gap-1">
                            <BarChart3 size={12}/> ملخص الطلبات
                        </button>
                        <button onClick={() => handleSend("هل هناك شحنات متأخرة؟")} className="text-[9px] font-black bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition-colors border dark:border-slate-800 flex items-center gap-1">
                            {/* FIXED: Added missing Truck icon import from lucide-react */}
                            <Truck size={12}/> شحنات متأخرة
                        </button>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-end gap-2">
                        <div className="relative flex-grow">
                            {attachedImage && (
                                <div className="absolute bottom-full left-0 mb-2 p-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border animate-in slide-in-from-bottom-2">
                                    <div className="relative">
                                        <img src={attachedImage} className="w-16 h-16 object-cover rounded-md" alt="Attached Preview" />
                                        <button type="button" onClick={() => { setAttachedImage(null); setAttachedFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={12}/></button>
                                    </div>
                                </div>
                            )}
                            <textarea 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                placeholder="اطلب ملخصاً أو ابحث بصورة..." 
                                className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-900 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                                rows={1}
                                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute right-3 bottom-2.5 p-1.5 text-slate-400 hover:text-indigo-500 transition-colors" title="إرفاق صورة للبحث">
                                <Camera size={20}/>
                            </button>
                        </div>
                        <button type="submit" disabled={isLoading || (!input.trim() && !attachedFile)} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex-shrink-0 disabled:opacity-50">
                            <Send size={22}/>
                        </button>
                    </form>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            setAttachedFile(file);
                            const reader = new FileReader();
                            reader.onload = () => setAttachedImage(reader.result as string);
                            reader.readAsDataURL(file);
                            playSound('pop');
                        }
                    }} />
                    <p className="mt-3 text-[9px] text-center text-slate-400 font-bold flex items-center justify-center gap-1">
                        <Info size={10}/> المساعد الذكي يستخدم الذكاء الاصطناعي، يرجى مراجعة البيانات الهامة.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
