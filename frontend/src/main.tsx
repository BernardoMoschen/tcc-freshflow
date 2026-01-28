import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initDevMode } from "./lib/dev-setup";
import { ErrorBoundary } from "./components/error-boundary";

// Initialize development mode helpers
initDevMode();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
