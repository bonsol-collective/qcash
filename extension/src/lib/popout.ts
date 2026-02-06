export function isTabMode(): boolean {
  return new URLSearchParams(window.location.search).has('tab');
}

export function openInTab(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html?tab=1') });
  window.close();
}
