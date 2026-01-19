
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useSound } from './SoundContext';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType>({
    showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const { playSound } = useSound();

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        
        // Play sound based on type
        if (type === 'success') playSound('success');
        else if (type === 'error') playSound('error');
        else if (type === 'warning') playSound('warning');
        else playSound('pop'); // Info

        setToasts((prev) => [...prev, { id, message, type }]);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    }, [playSound]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none items-center w-full px-4">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-5 py-4 rounded-lg shadow-2xl transform transition-all duration-300 animate-in slide-in-from-top-full pointer-events-auto border-r-4 ${
                            toast.type === 'success' ? 'bg-green-600 text-white border-green-800' :
                            toast.type === 'error' ? 'bg-red-600 text-white border-red-800' :
                            toast.type === 'warning' ? 'bg-yellow-500 text-white border-yellow-700' :
                            'bg-blue-600 text-white border-blue-800'
                        }`}
                        style={{ minWidth: '300px', maxWidth: '450px' }}
                    >
                        <div className="flex-shrink-0">
                            {toast.type === 'success' && <CheckCircle size={24} />}
                            {toast.type === 'error' && <XCircle size={24} />}
                            {toast.type === 'warning' && <AlertTriangle size={24} />}
                            {toast.type === 'info' && <Info size={24} />}
                        </div>
                        <p className="flex-grow text-base font-bold leading-tight">{toast.message}</p>
                        <button 
                            onClick={() => removeToast(toast.id)} 
                            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/20"
                        >
                            <X size={20} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
