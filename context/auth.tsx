import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BskyAgent, AtpSessionData } from '@atproto/api';
import * as SecureStore from 'expo-secure-store';

const BSKY_SERVICE = 'https://bsky.social';
const SESSION_KEY = 'bsky_session';

interface AuthContextType {
  agent: BskyAgent | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on app start
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (raw) {
          const savedSession: AtpSessionData = JSON.parse(raw);
          const restoredAgent = new BskyAgent({ service: BSKY_SERVICE });
          await restoredAgent.resumeSession(savedSession);
          setAgent(restoredAgent);
        }
      } catch (e) {
        console.log('No valid session to restore:', e);
        await SecureStore.deleteItemAsync(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (identifier: string, password: string) => {
    const newAgent = new BskyAgent({ service: BSKY_SERVICE });
    await newAgent.login({ identifier, password });
    if (newAgent.session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(newAgent.session));
    }
    setAgent(newAgent);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setAgent(null);
  };

  return (
    <AuthContext.Provider value={{ agent, isLoading, isAuthenticated: !!agent, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
