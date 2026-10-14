import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    const currentToken = getStoredToken();

    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
      } else {
        removeStoredToken();
        setTokenState(null);
        setUser(null);
      }
    } catch {
      removeStoredToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      removeStoredToken();
      setTokenState(null);
      setUser(null);
      setIsLoading(false);
    };

    const handleAuthRefreshed = (e: any) => {
      if (e?.detail?.token && e?.detail?.user) {
        setTokenState(e.detail.token);
        setUser(e.detail.user);
        setIsLoading(false);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'uomus_auth_token') {
        if (!e.newValue) {
          handleUnauthorized();
        } else {
          setTokenState(e.newValue);
          fetchCurrentUser();
        }
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:refreshed', handleAuthRefreshed);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:refreshed', handleAuthRefreshed);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await api.login(credentials);
      if (res.token && res.user) {
        setStoredToken(res.token);
        setTokenState(res.token);
        setUser(res.user);
      } else {
        throw new Error('بيانات الدخول غير مكتملة');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeStoredToken();
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
