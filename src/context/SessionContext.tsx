import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { DatabaseService } from '../services/DatabaseService';

interface SessionContextType {
    currentTableId: string | null;
    sessionId: string | null;
    sessionStatus: 'OPEN' | 'CLOSED' | 'PAID' | null;
    loading: boolean;
    joinSession: (tableId: string, restaurantId: string) => Promise<boolean>;
    exitSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // State
    const [currentTableId, setCurrentTableId] = useState<string | null>(() => localStorage.getItem('tableId'));
    const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('sessionId'));
    const [sessionStatus, setSessionStatus] = useState<'OPEN' | 'CLOSED' | 'PAID' | null>(null);
    const [loading, setLoading] = useState(false);

    // 1. URL Listener & Auto-Logout Logic
    // Detects if the user scans a NEW QR code for a DIFFERENT table
    useEffect(() => {
        // Extract tableId from URL pattern: /client/table/:tableId
        const match = location.pathname.match(/\/client\/table\/([a-f0-9-]+)/i);
        const urlTableId = match ? match[1] : null;

        if (urlTableId && currentTableId && urlTableId !== currentTableId) {
            console.log('Detected Table Switch: Clearing old session');
            exitSession(); // Clear previous session immediately
            // The new component mounting in the route will handle joining the new session
        }
    }, [location.pathname]);

    // 2. Real-time Kick-Out Logic
    // Subscribes to table_sessions updates. If status changes to CLOSED/PAID, kick user out.
    useEffect(() => {
        if (!sessionId) return;

        const channel = supabase
            .channel(`session_monitor_${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'table_sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload) => {
                    const newStatus = payload.new.status;
                    console.log('Session Status Update:', newStatus);

                    if (newStatus === 'CLOSED' || newStatus === 'PAID') {
                        toast.info('Il tavolo è stato chiuso. Grazie della visita!');
                        exitSession(); // Force logout
                        navigate('/'); // Redirect to home/login
                    } else {
                        setSessionStatus(newStatus);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, navigate]);


    const joinSession = useCallback(async (tableId: string, restaurantId: string): Promise<boolean> => {
        setLoading(true);
        try {
            // Use RPC to get or create session atomically
            const { data: rpcSessionId, error } = await supabase.rpc('get_or_create_table_session', {
                p_table_id: tableId,
                p_restaurant_id: restaurantId
            });

            if (error) throw error;

            if (rpcSessionId) {
                // Fetch full session details to get PIN and Status if needed, but RPC returns ID is enough to start
                setSessionId(rpcSessionId);
                setCurrentTableId(tableId);
                setSessionStatus('OPEN');

                // Persist
                localStorage.setItem('tableId', tableId);
                localStorage.setItem('sessionId', rpcSessionId);
                localStorage.setItem('restaurantId', restaurantId);

                return true;
            }
            return false;
        } catch (err: any) {
            console.error('Join Session Failed:', err);
            toast.error('Impossibile accedere al tavolo. Riprova.');
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const exitSession = useCallback(() => {
        setSessionId(null);
        setCurrentTableId(null);
        setSessionStatus(null);
        localStorage.removeItem('tableId');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('restaurantId');
        localStorage.removeItem('sessionPin'); // Clear any legacy keys
    }, []);

    return (
        <SessionContext.Provider value={{ currentTableId, sessionId, sessionStatus, loading, joinSession, exitSession }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
