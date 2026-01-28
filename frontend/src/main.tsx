import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initDevMode } from "./lib/dev-setup";

// Initialize development mode helpers
initDevMode();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
