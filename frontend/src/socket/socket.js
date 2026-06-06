import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") || `${window.location.protocol}//${window.location.hostname}:5000`;

export const socket = io(URL, {
  autoConnect: false,
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
