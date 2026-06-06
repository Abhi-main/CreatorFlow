import { useEffect } from "react";
import { socket } from "../socket/socket.js";
import { EVENTS } from "../socket/events.js";
import { useAuth } from "../context/AuthContext";

export const useSocket = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;

    const userId = user.user_id || user.id;
    const teamId = user.team_id;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit(EVENTS.USER_JOIN, userId);
    socket.emit(EVENTS.TEAM_JOIN, teamId);

    const handleConnect = () => {
      socket.emit(EVENTS.USER_JOIN, userId);
      socket.emit(EVENTS.TEAM_JOIN, teamId);
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [user]);

  return socket;
};

export const useSocketEvent = (event, handler) => {
  useEffect(() => {
    if (!event || !handler) return undefined;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [event, handler]);
};
