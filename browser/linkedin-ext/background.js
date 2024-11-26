chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tab.active &&
    tab.status == "complete" &&
    tab.url.includes("linkedin.com")
  ) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"],
    });
  }
});
