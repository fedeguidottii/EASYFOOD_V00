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
            // 1. First, look for an existing OPEN session for this table
            const { data: existingSession, error: fetchError } = await supabase
                .from('table_sessions')
                .select('id, status')
                .eq('table_id', tableId)
                .eq('status', 'OPEN')
                .maybeSingle();

            if (fetchError) throw fetchError;

            let finalSessionId: string;

            if (existingSession) {
                // Use existing session
                finalSessionId = existingSession.id;
            } else {
                // 2. Create a new session with a random 4-digit PIN
                const newPin = Math.floor(1000 + Math.random() * 9000).toString();

                const { data: newSession, error: insertError } = await supabase
                    .from('table_sessions')
                    .insert({
                        table_id: tableId,
                        restaurant_id: restaurantId,
                        status: 'OPEN',
                        session_pin: newPin,
                        opened_at: new Date().toISOString(),
                        customer_count: 1
                    })
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                finalSessionId = newSession.id;
            }

            // Set state and persist
            setSessionId(finalSessionId);
            setCurrentTableId(tableId);
            setSessionStatus('OPEN');

            localStorage.setItem('tableId', tableId);
            localStorage.setItem('sessionId', finalSessionId);
            localStorage.setItem('restaurantId', restaurantId);

            return true;
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
