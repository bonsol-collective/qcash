// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
