import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { WalletProvider } from "./context/WalletContext.tsx";
import { WasmProvider } from "./context/WasmContext.tsx";
import "./index.css";

// @ts-ignore
globalThis.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WasmProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </WasmProvider>
  </StrictMode>,
);
