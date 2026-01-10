
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
    const initAudio = () => {
        if (!audioCtx) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            if (Ctx) setAudioCtx(new Ctx());
        }
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('touchstart', initAudio);
    }
  }, [audioCtx]);

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    localStorage.setItem('app_sound_muted', String(newState));
  };

  // --- High-Tech Sound Design ---
  const playSound = useCallback((type: SoundType) => {
    if (isMuted || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    switch (type) {
        case 'click':
            // Ultra-short, crisp mechanical click
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;

        case 'pop':
            // Soft interface "bloop"
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.08);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
            break;

        case 'success':
            // "Confident" Fast Major Chord Arpeggio (C6 -> E6)
            {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);

                osc.type = 'sine';
                osc2.type = 'triangle'; // Add texture

                // Note 1
                osc.frequency.setValueAtTime(1046.50, now); // C6
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                // Note 2 (Very fast delay)
                osc2.frequency.setValueAtTime(1318.51, now + 0.05); // E6
                gain2.gain.setValueAtTime(0, now);
                gain2.gain.setValueAtTime(0.1, now + 0.05);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

                osc.start(now);
                osc.stop(now + 0.2);
                osc2.start(now);
                osc2.stop(now + 0.3);
            }
            break;

        case 'error':
            // Subtle low warning buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.15);
            
            // Low pass filter to remove harshness
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            osc.disconnect();
            osc.connect(filter);
            filter.connect(gainNode);

            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;

        case 'warning':
            // Double tap
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.setValueAtTime(0, now + 0.05);
            gainNode.gain.setValueAtTime(0.05, now + 0.1);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
            
        case 'delete':
            // Quick crumple sound
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
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
