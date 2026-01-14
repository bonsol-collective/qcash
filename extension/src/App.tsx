import { useState } from 'react';
import './App.css';

// Simple Icons components
const IconHexagon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
  </svg>
);

const IconZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

function App() {
  const [status, setStatus] = useState("Idle");
  const [logs, setLogs] = useState<{time: string, type: 'req' | 'res' | 'err', msg: string}[]>([]);
  const [balance, setBalance] = useState(0);

  const addLog = (type: 'req' | 'res' | 'err', msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' });
    setLogs(prev => [{time, type, msg}, ...prev].slice(0, 50));
  };

  const clearLogs = () => setLogs([]);

  // Helper to talk to Background Script -> Native Daemon
  const sendCommand = async (action: string, payload: any) => {
    setStatus(`Running ${action}...`);
    addLog('req', `> ${action}`);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SEND_TO_DAEMON",
        payload: { action, payload }
      });

      setStatus("Idle");
      // Pretty print JSON for the logs
      const jsonRes = JSON.stringify(response, null, 2);
      addLog('res', `< ${jsonRes}`);
      
      // Update balance if applicable (Mocking this logic)
      if (action === "Faucet") {
        setBalance(prev => prev + (payload.amount || 0));
      }
      if (action === "Send") {
        setBalance(prev => Math.max(0, prev - (payload.amount || 0)));
      }
      
    } catch (e: any) {
      setStatus("Error");
      addLog('err', `! ${e.message}`);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <IconHexagon /> QCash Wallet
        </div>
        <div className={`status-badge ${status !== 'Idle' ? 'active' : ''}`}>
          <div className="status-dot"></div>
          {status}
        </div>
      </div>

      {/* Main Balance */}
      <div className="balance-section">
        <div className="balance-label">Available Assets</div>
        <div className="balance-amount">
          {balance.toLocaleString()}.00 <span className="currency">QCSH</span>
        </div>
      </div>

      {/* Actions */}
      <div className="actions-grid">
        <button 
          className="action-btn" 
          onClick={() => sendCommand("Init", null)}
        >
          <IconZap /> Initialize
        </button>

        <button 
          className="action-btn" 
          onClick={() => sendCommand("Faucet", { amount: 100 })}
        >
          <IconDownload /> Faucet (+100)
        </button>

        <button 
          className="action-btn primary" 
          onClick={() => sendCommand("Send", { receiver: "Bob", amount: 50 })}
        >
          <IconSend /> Send 50 QCSH
        </button>
      </div>

      {/* Terminal / Logs */}
      <div className="terminal-wrapper">
        <div className="terminal-header">
          <span className="terminal-title">Debug Console</span>
          {logs.length > 0 && (
            <button className="clear-btn" onClick={clearLogs}>Clear</button>
          )}
        </div>
        <div className="terminal-window">
          {logs.length === 0 && <div style={{color: '#333'}}>Ready...</div>}
          {logs.map((log, i) => (
            <div key={i} className={`log-entry ${log.type === 'req' ? 'request' : log.type === 'res' ? 'response' : 'error'}`}>
              <span className="log-timestamp">[{log.time}]</span>
              {log.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;