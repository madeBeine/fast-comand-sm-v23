
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// --- Professional UI Sounds (Base64 Encoded for Zero-Latency) ---

// 1. Success: Soft, modern chime (Positive action)
const SOUND_SUCCESS = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'; 
// Note: In a real prod env, these would be optimized .mp3/.ogg files. 
// Using short generated placeholders for the example to ensure valid XML.
// Since I cannot generate binary mp3s here, I will implement a synthetic AudioContext generator 
// which is actually MORE professional for web apps as it requires no downloads.

type SoundType = 'success' | 'error' | 'warning' | 'click' | 'pop' | 'delete';

interface SoundContextType {
  playSound: (type: SoundType) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextType>({
  playSound: () => {},
  isMuted: false,
  toggleMute: () => {},
});

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('app_sound_muted') === 'true';
  });

  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);

  useEffect(() => {
    // Initialize AudioContext on first user interaction to comply with browser policies
    const initAudio = () => {
        if (!audioCtx) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (Ctx) setAudioCtx(new Ctx());
        }
    };
    window.addEventListener('click', initAudio, { once: true });
    return () => window.removeEventListener('click', initAudio);
  }, [audioCtx]);

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    localStorage.setItem('app_sound_muted', String(newState));
  };

  // --- Procedural Sound Generation (The "Pro" Way) ---
  // This creates sounds using math, resulting in crisp, futuristic UI sounds without file downloads.
  const playSound = useCallback((type: SoundType) => {
    if (isMuted || !audioCtx) return;

    // Resume context if suspended (browser policy)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
        case 'success':
            // Bright upward chime
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;

        case 'error':
            // Low thud/buzz
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;

        case 'warning':
            // Two quick tones
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.setValueAtTime(0, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now + 0.15);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;

        case 'click':
            // Very short, high tick (Mechanical feel)
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            gainNode.gain.setValueAtTime(0.02, now); // Very quiet
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.03);
            break;

        case 'pop':
            // Bubble pop sound for modals
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
            
        case 'delete':
            // Crunch/noise
            // Simulating noise with oscillator modulation
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
    }
  }, [isMuted, audioCtx]);

  return (
    <SoundContext.Provider value={{ playSound, isMuted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => useContext(SoundContext);
