const execTabs = new Set();

const linkedinTabKey = (tabId) => "linkedin_" + tabId;
const xTabKey = (tabId) => "x_" + tabId;
let x_loop = new Map();

let currentWindowId = null;
let injectWindowId = null;

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

// Function to update the current window ID when focus changes
function updateCurrentWindowId(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // No window is focused (e.g., the browser is minimized)
    currentWindowId = null;
  } else {
    currentWindowId = windowId;
  }
}

// Track window focus changes
chrome.windows.onFocusChanged.addListener(updateCurrentWindowId);

chrome.windows.onRemoved.addListener((windowId) => {
  if (injectWindowId === windowId) {
    injectWindowId = null;
  }
});

// Initialize the current window ID when the extension is loaded
chrome.windows.getCurrent({ populate: false }, (currentWindow) => {
  currentWindowId = currentWindow.id;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Skip unnecessary updates
  if (!changeInfo.status || changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  // Ensure the tab belongs to the current focused window
  if (
    currentWindowId === null ||
    (injectWindowId && tab.windowId !== injectWindowId)
  ) {
    return;
  }

  if (tab.url.includes("linkedin.com/notifications")) {
    if (!execTabs.has(linkedinTabKey(tabId))) {
      execTabs.add(linkedinTabKey(tabId));
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["general.js", "linkedin.js"],
      });
    }
  }

  if (
    x_loop.has(tabId)
      ? tab.url.includes("/x.com/search")
      : tab.url.includes("/x.com/notifications")
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

            // Focus the window containing the tab
            chrome.windows.update(
              sender.tab.windowId,
              { focused: true },
              () => {
                // nop
              }
            );
          }
        }
      );
      return true;
    } else {
      sendResponse({ status: "tab undefined", sender });
      return false;
    }
  }

  if (message.action === "checkIdleAndActivateTab") {
    if (sender?.tab?.id) {
      const idleThresholdInSeconds = 60;
      chrome.idle.queryState(idleThresholdInSeconds, (state) => {
        if (state === "idle" || state === "locked") {
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

                // Focus the window containing the tab
                chrome.windows.update(
                  sender.tab.windowId,
                  { focused: true },
                  () => {
                    // nop
                  }
                );
              }
            }
          );
        } else {
          console.log("Browser is active. No action taken.");
        }
      });
      return true;
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

  if (message.action === "set_window_id") {
    if (sender?.tab?.id) {
      injectWindowId = sender.tab.windowId;
    }
  }

  return false;
});
