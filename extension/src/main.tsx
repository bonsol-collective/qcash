// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs Inc.
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { WalletProvider } from "./context/WalletContext.tsx";
import { WasmProvider } from "./context/WasmContext.tsx";
import { isTabMode } from "./lib/popout.ts";
import "./index.css";

// @ts-ignore
globalThis.Buffer = Buffer;

if (isTabMode()) {
  document.body.classList.add("tab-mode");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WasmProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </WasmProvider>
  </StrictMode>,
);
