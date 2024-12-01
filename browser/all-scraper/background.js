const execTabs = new Set();

const linkedinTabKey = (tabId) => "linkedin_" + tabId;
const xTabKey = (tabId) => "x_" + tabId;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tab.active &&
    tab.status == "loading" &&
    tab.url.includes("linkedin.com")
  ) {
    if (!execTabs.has(linkedinTabKey(tabId))) {
      execTabs.add(linkedinTabKey(tabId));
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["general.js", "linkedin.js"],
      });
    }
  }

  if (
    tab.active &&
    tab.status == "complete" &&
    tab.url.includes("linkedin.com")
  ) {
    if (execTabs.has(linkedinTabKey(tabId))) {
      execTabs.delete(linkedinTabKey(tabId));
    }
  }

  if (tab.active && tab.status == "loading" && tab.url.includes("x.com")) {
    if (!execTabs.has(xTabKey(tabId))) {
      execTabs.add(xTabKey(tabId));
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["general.js", "x.js"],
      });
    }
  }

  if (tab.active && tab.status == "complete" && tab.url.includes("x.com")) {
    if (execTabs.has(xTabKey(tabId))) {
      execTabs.delete(xTabKey(tabId));
    }
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
