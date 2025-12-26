
import React, { createContext } from 'react';
import type { User } from '../types';

interface AuthContextType {
    currentUser: User | null;
    logout: () => void;
    loginDemo: () => void; // Added for direct login
}

export const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    logout: () => {},
    loginDemo: () => {},
});
