import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
  console.error("[main] Failed to render app:", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1C2127;color:#F0EDE8;font-family:sans-serif;text-align:center;padding:2rem">
        <div>
          <h1 style="font-size:20px;color:#D4A574;margin-bottom:12px">Failed to load application</h1>
          <p style="font-size:13px;color:#A8B0B8">Please try refreshing the page.</p>
        </div>
      </div>
    `;
  }
}
