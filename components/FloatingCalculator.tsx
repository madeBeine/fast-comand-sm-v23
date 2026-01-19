
import React, { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';
import QuickCalculator from './QuickCalculator';
import type { Currency, AppSettings } from '../types';

interface FloatingCalculatorProps {
    currencies: Currency[];
    settings: AppSettings;
}

const FloatingCalculator: React.FC<FloatingCalculatorProps> = ({ currencies, settings }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 150 });
    const [isDragging, setIsDragging] = useState(false);
    const [isIdle, setIsIdle] = useState(false); // Track inactivity
    
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const initialPosRef = useRef<{ x: number, y: number } | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load saved position
    useEffect(() => {
        const savedPos = localStorage.getItem('calcPosition');
        if (savedPos) {
            try {
                const parsed = JSON.parse(savedPos);
                setPosition({ x: 20, y: parsed.y }); 
            } catch {}
        }
        resetIdleTimer();
    }, []);

    const resetIdleTimer = () => {
        setIsIdle(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            // Only go idle if not open and not dragging
            if (!isOpen && !isDragging) {
                setIsIdle(true);
            }
        }, 2500); 
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Prevent drag initiation if clicking inside the modal (though modal is now overlaid)
        if ((e.target as HTMLElement).closest('.calc-modal-content')) return; 
        
        resetIdleTimer();
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialPosRef.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !dragStartRef.current || !initialPosRef.current) return;
        
        resetIdleTimer();
        e.preventDefault();
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        setPosition({
            x: initialPosRef.current.x + deltaX,
            y: initialPosRef.current.y + deltaY
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        resetIdleTimer();
        if (!isDragging) return;
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        
        // Snap Logic: Force Left Side Only
        const margin = 20;
        const newX = margin; 
        
        let newY = position.y;
        const screenHeight = window.innerHeight;
        const buttonSize = 60;
        
        // Constrain Vertical Movement
        if (newY < margin) newY = margin;
        // Avoid overlapping with bottom nav on mobile
        const bottomOffset = window.innerWidth < 768 ? 100 : margin;
        if (newY > screenHeight - buttonSize - bottomOffset) newY = screenHeight - buttonSize - bottomOffset;

        setPosition({ x: newX, y: newY });
        localStorage.setItem('calcPosition', JSON.stringify({ x: newX, y: newY }));
    };

    // Manage Idle Timer when modal state changes
    useEffect(() => {
        if (isOpen) {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            setIsIdle(false);
        } else {
            // Re-trigger idle timer when modal closes
            resetIdleTimer();
        }
    }, [isOpen]);

    return (
        <>
            {/* Draggable Floating Button */}
            {/* Only render/interact with this if modal is NOT open, or keep it but lower z-index */}
            <div 
                style={{ 
                    // If idle, pull it slightly off-screen (negative x)
                    left: `${isIdle ? -15 : position.x}px`, 
                    top: `${position.y}px`,
                    touchAction: 'none'
                }}
                className={`
                    fixed z-[90] cursor-move select-none 
                    ${isDragging ? 'transition-none' : 'transition-all duration-500 cubic-bezier(0.18, 0.89, 0.32, 1.28)'}
                    ${isIdle ? 'opacity-50 hover:opacity-100 hover:translate-x-2' : 'opacity-100'}
                    ${isOpen ? 'opacity-0 pointer-events-none' : ''} 
                `}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerEnter={resetIdleTimer}
                onClick={() => {
                    if (!isDragging) {
                        setIsOpen(true);
                        resetIdleTimer();
                    }
                }}
            >
                <button 
                    className={`
                        bg-indigo-600/90 backdrop-blur-xl hover:bg-indigo-700 text-white 
                        p-3.5 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 
                        flex items-center justify-center 
                        ${isDragging ? 'scale-110 shadow-xl' : 'hover:scale-110 active:scale-95'}
                        transition-transform duration-200
                    `}
                    title="الحاسبة السريعة"
                >
                    <Calculator size={24} strokeWidth={2.5} />
                </button>
            </div>

            {/* Overlay Modal - FULL SCREEN CENTERED */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4"
                    onClick={() => setIsOpen(false)}
                    style={{ height: '100dvh' }} // Dynamic viewport height for mobile browsers
                >
                    <div 
                        onClick={e => e.stopPropagation()} 
                        className="calc-modal-content w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar relative"
                    >
                        <QuickCalculator 
                            currencies={currencies} 
                            settings={settings} 
                            isFloating={true}
                            onClose={() => setIsOpen(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingCalculator;
