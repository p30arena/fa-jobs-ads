chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tab.active &&
    tab.status == "loading" &&
    tab.url.includes("linkedin.com")
  ) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "delay") {
    setTimeout(() => {
      sendResponse({ status: "OK" });
    }, message.ms);

    return true; // Indicates the response will be sent asynchronously
  }
});
