import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/services";
import { bindUnauthorizedHandler, setAccessToken } from "../api/api";
import { normalizeTimeZone } from "../utils/timezone";
import { socket } from "../socket/socket";
import { EVENTS } from "../socket/events";

const AuthContext = createContext(null);
let restoreSessionPromise = null;

function restoreSession() {
  if (!restoreSessionPromise) {
    restoreSessionPromise = authApi.refresh().finally(() => {
      restoreSessionPromise = null;
    });
  }

  return restoreSessionPromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  function clearAuth(shouldRedirect = true) {
    setUser(null);
    setAccessTokenState("");
    setAccessToken("");
    socket.disconnect();

    if (shouldRedirect) {
      navigate("/login", { replace: true });
    }
  }

  function applySession(payload) {
    const nextUser = {
      ...payload.user,
      user_id: payload.user?.user_id || payload.user?.id,
      timezone: normalizeTimeZone(payload.user?.timezone)
    };
    setUser(nextUser);
    setAccessTokenState(payload.accessToken);
    setAccessToken(payload.accessToken);

    socket.connect();
    socket.emit(EVENTS.USER_JOIN, nextUser.user_id || nextUser.id);
    socket.emit(EVENTS.TEAM_JOIN, nextUser.team_id);
  }

  useEffect(() => {
    bindUnauthorizedHandler(() => {
      clearAuth(true);
    });

    restoreSession()
      .then((payload) => {
        applySession(payload);
      })
      .catch(() => {
        clearAuth(false);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      bindUnauthorizedHandler(() => {});
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      isAuthenticated: Boolean(user && accessToken),
      login: async (email, password) => {
        try {
          const payload = await authApi.login({ email, password });
          applySession(payload);
          return payload;
        } catch (error) {
          toast.error(error.response?.data?.error || "Unable to sign in.");
          throw error;
        }
      },
      register: async (payload) => {
        try {
          const session = await authApi.register(payload);
          applySession(session);
          return session;
        } catch (error) {
          toast.error(error.response?.data?.error || "Unable to register.");
          throw error;
        }
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          socket.disconnect();
          clearAuth(true);
        }
      },
      clearAuth
    }),
    [user, accessToken, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
