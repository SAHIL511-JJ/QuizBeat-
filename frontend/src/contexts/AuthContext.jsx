import { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const AuthContext = createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        setError(null);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const logout = async () => {
        setError(null);
        try {
            await signOut(auth);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const value = {
        user,
        loading,
        error,
        signInWithGoogle,
        logout,
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
