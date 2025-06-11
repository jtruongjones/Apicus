// make-roi-checker-extension/service-worker.js
try {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "openDisplayTab" && request.url) {
      chrome.tabs.create({ url: request.url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("Service Worker: Error creating tab:", chrome.runtime.lastError.message);
          // Optionally send a response back indicating failure, though content script might not wait for it.
          // sendResponse({status: "error", message: chrome.runtime.lastError.message});
        } else {
          console.log("Service Worker: Display tab opened successfully", tab);
          // sendResponse({status: "success", tabId: tab.id });
        }
      });
      // Return true to indicate you wish to send a response asynchronously.
      // This is good practice even if sendResponse is not immediately called or if the
      // content script doesn't explicitly wait for it, as it keeps the message channel open.
      return true;
    }
    // Return false or undefined if the message isn't handled by this listener for this action
    return false;
  });
  console.log("Service worker loaded and message listener added.");
} catch (e) {
  console.error("Error in service worker setup:", e);
}
