import { useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import { logoutApi } from "../api/auth.api";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    const userData = localStorage.getItem("user");

    if (accessToken && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    function handleForcedLogout() {
      setUser(null);
    }

    window.addEventListener("auth:logout", handleForcedLogout);
    return () => {
      window.removeEventListener("auth:logout", handleForcedLogout);
    };
  }, []);

  function login(data) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));

    setUser(data.user);
  }

  async function logout() {
    try {
      await logoutApi();
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
