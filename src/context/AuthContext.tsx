import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';

interface User {
    id: string;
    email: string | null;
    username?: string | null;
    type: 'admin' | 'client' | 'collaborator';
    name: string;
    clientId?: string | null;
    companyName?: string | null;
    logoUrl?: string | null;
    modules_access?: string[];
    isTemporary?: boolean;
    mustChangePassword?: boolean;
    impersonatedBySuperAdmin?: boolean;
    originalAdminEmail?: string | null;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        const me = await authApi.getMe();
        setUser(me);
        localStorage.setItem('user', JSON.stringify(me));
    };

    useEffect(() => {
        const verifyToken = async () => {
            if (token) {
                try {
                    // Verify with backend
                    await refreshUser();
                } catch (e) {
                    console.error('Token verification failed', e);
                    logout();
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        verifyToken();
    }, [token]);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
