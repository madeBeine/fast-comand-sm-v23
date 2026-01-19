
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

    // 1. Listen to Network Status & Auto-Sync
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Trigger sync immediately when back online
            if (syncQueue.length > 0) {
                showToast('عاد الاتصال بالإنترنت. جاري مزامنة البيانات...', 'info');
                processQueue();
            }
        };
        const handleOffline = () => {
            setIsOnline(false);
            showToast('انقطع الاتصال. سيتم حفظ التغييرات محلياً وإرسالها لاحقاً.', 'warning');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncQueue.length]); // Dependency on queue length ensures we re-evaluate if queue changes while offline

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
        
        // Immediate feedback provided by the calling component usually, but we can ensure consistency here
        // Note: We do NOT show toast here to avoid duplicates if the calling component also shows one.
    }, []);

    // 4. Process Queue (Sync Engine)
    const processQueue = async () => {
        // Reload from local storage to ensure we have the latest state (in case of race conditions)
        const currentQueue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        if (currentQueue.length === 0) return;

        let processedCount = 0;
        const failedItems: SyncItem[] = [];

        // Process sequentially to maintain data integrity
        for (const item of currentQueue) {
            try {
                if (!supabase) throw new Error("No database client");

                // Prepare payload
                const { id, ...cleanPayload } = item.payload; 
                // Note: For offline items, 'id' might be a temp ID (e.g. 'temp-123').
                // Ideally, we should remove it for INSERT so DB generates a real one, 
                // OR we generate a real UUID v4 on client-side creation.
                // Here we attempt to insert. If it's a temp ID, Supabase might reject if column is UUID type 
                // unless we strip it. Let's strip ID for INSERTs to be safe.
                
                const payloadToSend = item.action === 'INSERT' ? cleanPayload : item.payload;

                if (item.action === 'INSERT') {
                    const { error } = await supabase.from(item.table).insert(payloadToSend);
                    if (error) throw error;
                } else if (item.action === 'UPDATE') {
                    // For updates, we need the ID
                    const { error } = await supabase.from(item.table).update(payloadToSend).eq('id', item.payload.id);
                    if (error) throw error;
                } else if (item.action === 'DELETE') {
                    const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
                    if (error) throw error;
                }

                processedCount++;

            } catch (err: any) {
                console.error("Sync failed for item:", item, err);
                // Keep in queue only if it's a network error or server error (5xx).
                // If it's a constraint error (e.g. duplicate key), we might want to discard or flag it.
                // For now, we keep it to retry.
                failedItems.push(item);
            }
        }

        setSyncQueue(failedItems);
        
        if (processedCount > 0) {
            showToast(`تمت مزامنة ${processedCount} عملية بنجاح مع الخادم`, 'success');
            // Allow a small delay for DB propagation then reload to refresh data
            setTimeout(() => {
                window.location.reload(); 
            }, 1000);
        }
    };

    return (
        <NetworkContext.Provider value={{ isOnline, queueOfflineAction, pendingCount: syncQueue.length }}>
            {children}
        </NetworkContext.Provider>
    );
};
