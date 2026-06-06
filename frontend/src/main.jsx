/* This file mounts the React app with routing and auth context at the root. */
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/index.css";
import "react-datepicker/dist/react-datepicker.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "18px",
              background: "rgba(255,255,255,0.95)",
              color: "#1f2340",
              border: "1px solid rgba(124, 77, 255, 0.12)",
              boxShadow: "0 24px 60px rgba(90, 52, 191, 0.16)"
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
