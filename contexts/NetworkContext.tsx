
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from './ToastContext';

interface SyncItem {
    id: string;
    table: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    timestamp: number;
}

interface NetworkContextType {
    isOnline: boolean;
    queueOfflineAction: (table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => void;
    pendingCount: number;
}

export const NetworkContext = createContext<NetworkContextType>({
    isOnline: true,
    queueOfflineAction: () => {},
    pendingCount: 0,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncQueue, setSyncQueue] = useState<SyncItem[]>(() => {
        try {
            const saved = localStorage.getItem('offline_sync_queue');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const { showToast } = useToast();

    // 1. Listen to Network Status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            showToast('عاد الاتصال بالإنترنت. جاري المزامنة...', 'success');
            processQueue();
        };
        const handleOffline = () => {
            setIsOnline(false);
            showToast('انقطع الاتصال. سيتم حفظ التغييرات محلياً.', 'warning');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. Persist Queue
    useEffect(() => {
        localStorage.setItem('offline_sync_queue', JSON.stringify(syncQueue));
    }, [syncQueue]);

    // 3. Queue Action
    const queueOfflineAction = useCallback((table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
        const newItem: SyncItem = {
            id: Math.random().toString(36).substr(2, 9),
            table,
            action,
            payload,
            timestamp: Date.now()
        };
        setSyncQueue(prev => [...prev, newItem]);
        if (!isOnline) {
            showToast('تم الحفظ محلياً (في الانتظار)', 'info');
        }
    }, [isOnline]);

    // 4. Process Queue (Sync)
    const processQueue = async () => {
        const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        if (queue.length === 0) return;

        let processedCount = 0;
        const remainingQueue: SyncItem[] = [];

        for (const item of queue) {
            try {
                if (!supabase) throw new Error("No connection");

                let error = null;
                // Remove local/temp ID for INSERT to let DB generate real ID
                const { id, ...cleanPayload } = item.payload; 
                
                if (item.action === 'INSERT') {
                    // Check if payload has a real ID (from previous failed attempt that might have partially succeeded?) 
                    // Usually we omit ID for insert.
                    const { error: err } = await supabase.from(item.table).insert(cleanPayload);
                    error = err;
                } else if (item.action === 'UPDATE') {
                    const { error: err } = await supabase.from(item.table).update(cleanPayload).eq('id', item.payload.id);
                    error = err;
                } else if (item.action === 'DELETE') {
                    const { error: err } = await supabase.from(item.table).delete().eq('id', item.payload.id);
                    error = err;
                }

                if (error) throw error;
                processedCount++;

            } catch (err) {
                console.error("Sync failed for item", item, err);
                remainingQueue.push(item); // Keep in queue if failed
            }
        }

        setSyncQueue(remainingQueue);
        if (processedCount > 0) {
            showToast(`تمت مزامنة ${processedCount} عملية بنجاح`, 'success');
            // Trigger a reload or re-fetch here if needed
            window.location.reload(); 
        }
    };

    return (
        <NetworkContext.Provider value={{ isOnline, queueOfflineAction, pendingCount: syncQueue.length }}>
            {children}
        </NetworkContext.Provider>
    );
};
