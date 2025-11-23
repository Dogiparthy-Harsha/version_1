import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Decode token to get username (simple decoding, not verification)
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUser({ username: payload.sub });
            } catch (e) {
                logout();
            }
        }
        setLoading(false);
    }, [token]);

    const login = async (username, password) => {
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await axios.post('http://127.0.0.1:8000/login', formData);
            const newToken = response.data.access_token;

            localStorage.setItem('token', newToken);
            setToken(newToken);
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    };

    const register = async (username, password) => {
        try {
            const response = await axios.post('http://127.0.0.1:8000/register', {
                username,
                password
            });
            const newToken = response.data.access_token;

            localStorage.setItem('token', newToken);
            setToken(newToken);
            return true;
        } catch (error) {
            console.error('Registration failed:', error);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
