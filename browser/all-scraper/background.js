const execTabs = new Set();

const linkedinTabKey = (tabId) => "linkedin_" + tabId;
const xTabKey = (tabId) => "x_" + tabId;
let x_loop = false;

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

  if (
    tab.active &&
    tab.status == "loading" &&
    (x_loop
      ? tab.url.includes("/x.com")
      : tab.url.includes("/x.com/notifications"))
  ) {
    if (!execTabs.has(xTabKey(tabId))) {
      execTabs.add(xTabKey(tabId));
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["general.js", "x.js"],
      });
    }
  }

  if (
    tab.active &&
    tab.status == "complete" &&
    (x_loop
      ? tab.url.includes("/x.com")
      : tab.url.includes("/x.com/notifications"))
  ) {
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

  if (message.action === "disableAutoDiscardable") {
    if (sender?.tab?.id) {
      chrome.tabs.update(sender.tab.id, { autoDiscardable: false }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({
            status: "error",
            message: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse({ status: "success", tabId: sender.tab.id });
        }
      });
      return true; // Indicates async response.
    } else {
      sendResponse({ status: "tab undefined", sender });
      return false;
    }
  }

  if (message.action === "x_loop") {
    x_loop = true;
  }

  if (message.action === "x_loop_end") {
    x_loop = false;
  }

  if (message.action === "x_loop") {
    x_loop = true;
  }
});
