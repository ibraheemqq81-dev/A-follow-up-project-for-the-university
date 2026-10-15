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
        const u = res.user;
        if (u.status === 'inactive' || (u.accountStatus && u.accountStatus !== 'active')) {
          removeStoredToken();
          setTokenState(null);
          setUser(null);
          return;
        }
        setUser(u);
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
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
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

  const logout = async () => {
    try { await api.logout(); } catch { /* best effort */ }
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
