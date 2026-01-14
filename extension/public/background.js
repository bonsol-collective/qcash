chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_DAEMON") {

    console.log("Connecting to Native Daemon...");
    // 1. Connect
    const port = chrome.runtime.connectNative("com.qcash.daemon");

    // 2. Send Message
    port.postMessage(request.payload);

    // 3. Listen for Response
    port.onMessage.addListener((response) => {
      console.log("Received from Daemon:", response);
      sendResponse(response);
      port.disconnect();
    });

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        console.error("Connection Failed:", chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        console.log("Daemon disconnected");
      }
    });

    return true; // Keep channel open for async response
  }
});
