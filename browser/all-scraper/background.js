const execTabs = new Set();

const linkedinTabKey = (tabId) => "linkedin_" + tabId;
const xTabKey = (tabId) => "x_" + tabId;
let x_loop = new Map();

function cleanup(tabId) {
  if (execTabs.has(linkedinTabKey(tabId))) {
    execTabs.delete(linkedinTabKey(tabId));
  }

  if (execTabs.has(xTabKey(tabId))) {
    execTabs.delete(xTabKey(tabId));
  }

  if (x_loop.has(tabId)) {
    x_loop.delete(tabId);
  }
}

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  cleanup(tabId);
});

chrome.webNavigation.onCommitted.addListener(
  (details) => {
    if (["reload"].includes(details.transitionType)) {
      cleanup(details.tabId);
    }
  },
  { url: [{ hostSuffix: "linkedin.com" }, { hostSuffix: "x.com" }] }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tab.active &&
    tab.status == "complete" &&
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
    (x_loop.has(tabId)
      ? tab.url.includes("/x.com/search")
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

  if (message.action === "activateTab") {
    if (sender?.tab?.id) {
      // The browser is idle or locked, activate the target tab
      chrome.tabs.update(
        sender.tab.id,
        { active: true, highlighted: true },
        () => {
          if (chrome.runtime.lastError) {
            sendResponse({
              status: "error",
              message: chrome.runtime.lastError.message,
            });
          } else {
            sendResponse({ status: "success", tabId: sender.tab.id });
          }
        }
      );
    } else {
      sendResponse({ status: "tab undefined", sender });
      return false;
    }
  }

  if (message.action === "x_loop") {
    if (sender?.tab?.id) {
      x_loop.set(sender.tab.id, true);

      if (execTabs.has(xTabKey(sender.tab.id))) {
        execTabs.delete(xTabKey(sender.tab.id));
      }
    }
  }

  if (message.action === "x_loop_end") {
    if (sender?.tab?.id) {
      x_loop.set(sender.tab.id, false);

      if (execTabs.has(xTabKey(sender.tab.id))) {
        execTabs.delete(xTabKey(sender.tab.id));
      }
    }
  }

  return false;
});
