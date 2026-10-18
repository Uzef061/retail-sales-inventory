import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem('auth_token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Configure Axios Defaults & Interceptors
  useEffect(() => {
    axios.defaults.timeout = 15000;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('auth_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('auth_token');
    }
  }, [token]);

  // Axios Response Interceptor to catch 401 Unauthorized globally
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          const errorCode = error.response.data?.errorCode;
          if (errorCode === 'AUTH_REQUIRED' || errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_USER') {
            console.warn('Authentication session expired or invalid. Logging out.');
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // On initial mount, fetch current authenticated user profile if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        try {
          const res = await axios.get('/api/auth/me');
          if (res.data?.success && res.data?.user) {
            setUser(res.data.user);
            setTokenState(storedToken);
          } else {
            logout();
          }
        } catch (err) {
          console.warn('Failed to verify existing session:', err.message);
          logout();
        }
      } else {
        setLoading(false);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    setAuthError(null);
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      if (res.data?.success && res.data?.token) {
        const newToken = res.data.token;
        const newUser = res.data.user;

        localStorage.setItem('auth_token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

        setTokenState(newToken);
        setUser(newUser);
        return { success: true, user: newUser };
      } else {
        throw new Error(res.data?.message || 'Login failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please check credentials.';
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    delete axios.defaults.headers.common['Authorization'];
    setTokenState(null);
    setUser(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        authError,
        setAuthError,
        isAuthenticated: Boolean(token && user),
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
