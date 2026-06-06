import { EVENTS } from "./events.js";

const onlineUsers = new Map();
let activeIO = null;

export const initSocket = (io) => {
  activeIO = io;

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(EVENTS.USER_JOIN, (userId) => {
      if (!userId) return;

      const normalizedUserId = String(userId);
      onlineUsers.set(normalizedUserId, socket.id);
      socket.userId = normalizedUserId;
      socket.join(`user:${normalizedUserId}`);

      io.emit(EVENTS.USERS_ONLINE, Array.from(onlineUsers.keys()));
      console.log(`User ${normalizedUserId} joined. Online: ${onlineUsers.size}`);
    });

    socket.on(EVENTS.TEAM_JOIN, (teamId) => {
      if (!teamId) return;
      socket.teamId = String(teamId);
      socket.join(`team:${teamId}`);
      console.log(`Socket ${socket.id} joined team room: ${teamId}`);
    });

    socket.on(EVENTS.POST_TYPING, ({ teamId, userId, postId } = {}) => {
      if (!teamId) return;
      socket.to(`team:${teamId}`).emit(EVENTS.POST_TYPING, { userId, postId });
    });

    socket.on(EVENTS.POST_TYPING_STOP, ({ teamId, userId, postId } = {}) => {
      if (!teamId) return;
      socket.to(`team:${teamId}`).emit(EVENTS.POST_TYPING_STOP, { userId, postId });
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit(EVENTS.USERS_ONLINE, Array.from(onlineUsers.keys()));
        console.log(`User ${socket.userId} disconnected. Online: ${onlineUsers.size}`);
      }
    });
  });
};

export const getIO = () => activeIO;

export const emitToUser = (io, userId, event, data) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToTeam = (io, teamId, event, data) => {
  if (!io || !teamId) return;
  io.to(`team:${teamId}`).emit(event, data);
};

export const emitToAll = (io, event, data) => {
  if (!io) return;
  io.emit(event, data);
};
