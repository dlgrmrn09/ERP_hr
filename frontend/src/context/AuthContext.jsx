import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import apiClient from "../utils/apiClient";

const AuthContext = createContext(null);

const STORAGE_KEY = "erp:user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const initialiseAuth = async () => {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed?.id) {
            setUser(parsed);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (error) {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      try {
        const response = await apiClient.get("/auth/me", {
          signal: controller.signal,
        });
        if (response?.data?.user) {
          setUser(response.data.user);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data.user));
        } else {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        if (error.name !== "CanceledError") {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingSession(false);
          setIsInitialized(true);
        }
      }
    };

    initialiseAuth();

    return () => {
      controller.abort();
    };
  }, []);

  const login = useCallback((userPayload) => {
    if (userPayload) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPayload));
      setUser(userPayload);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (error) {
      // swallow network errors on logout to avoid blocking UX
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isInitialized, isCheckingSession, login, logout }),
    [user, isInitialized, isCheckingSession, login, logout]
  );

  if (!isInitialized || isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Authenticating...
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
