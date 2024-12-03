const fs = require("fs").promises; // For reading the script file
const puppeteer = require("puppeteer-core");

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

async function intercept(page, { injectScripts }) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "visible",
    });
    Object.defineProperty(document, "hidden", {
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // Enable request interception
  await page.setRequestInterception(true);

  // Intercept and modify response headers
  page.on("request", (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    // if (["image", "media", "font"].includes(resourceType) || url.startsWith("blob:")) {
    if (["media"].includes(resourceType) || url.startsWith("blob:")) {
      //   console.log(`Blocking ${resourceType}:`, request.url());
      request.abort(); // Block the request
    } else {
      request.continue(); // Allow other requests
    }
  });

  page.on("response", async (response) => {
    const headers = response.headers();
    if (headers["x-frame-options"]) {
      //   console.log("Removing X-Frame-Options header.");
      delete headers["x-frame-options"];
    }
    if (headers["content-security-policy"]) {
      //   console.log("Removing Content-Security-Policy header.");
      delete headers["content-security-policy"];
    }
  });

  // Reinject scripts on navigation
  page.on("framenavigated", async (frame) => {
    if (frame === page.mainFrame()) {
      try {
        // console.log(frame.url());
        await page.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 0,
        });
        await injectScripts(page);
      } catch (err) {
        console.error(err);
      }
    }
  });
}

async function injectBilBilFetch(page) {
  const isExposed = await page.evaluate(() => Boolean(window.bilbil_fetch));
  if (isExposed) return;

  await page.exposeFunction("bilbil_fetch", async (...args) => {
    try {
      const response = await fetch(...args);
      const contentType = response.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json(); // Parse JSON response
      } else {
        data = await response.text(); // Handle text response
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()), // Serialize headers
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}

async function injectBilBilBringToFront(page) {
  const isExposed = await page.evaluate(() =>
    Boolean(window.bilbil_bringToFront)
  );
  if (isExposed) return;

  await page.exposeFunction("bilbil_bringToFront", async () => {
    try {
      await page.bringToFront();
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}

const locks = new Map();
async function injectLock(page) {
  const isExposed = await page.evaluate(
    () => Boolean(window.bilbil_lock) || Boolean(window.bilbil_release_lock)
  );
  if (isExposed) return;

  await page.exposeFunction("bilbil_lock", async (name) => {
    while (locks.get(name)) {
      await delay(1000);
    }

    locks.set(name, true);
  });

  await page.exposeFunction("bilbil_release_lock", async (name) => {
    locks.set(name, false);
  });
}

async function injectCommons(page) {
  await injectLock(page);
  await injectBilBilFetch(page);
  await injectBilBilBringToFront(page);
}

async function injectScripts(page, scripts) {
  const isExposed = await page.evaluate(() => Boolean(window.bilbil));
  if (isExposed) return;

  for (const s of scripts) {
    await page.evaluate(s);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    userDataDir: "./user_data_dir",
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-web-security", // Disable web security to bypass CSP
      "--disable-site-isolation-trials", // Optional, for disabling site isolation
      "--allow-running-insecure-content", // Optional, allow mixed content
    ],
  });

  for (const p of await browser.pages()) {
    await p.close();
  }

  // Load and execute an external script file
  const generalScript = await fs.readFile("./puppets/general.js", "utf8");
  const linkedinScript = await fs.readFile("./puppets/linkedin.js", "utf8");
  const X_Script = await fs.readFile("./puppets/x.js", "utf8");

  const linkedinPage = await browser.newPage();
  await intercept(linkedinPage, {
    injectScripts: async (page) => {
      await injectCommons(page);
      await injectScripts(page, [generalScript, linkedinScript]);
    },
  });
  try {
    linkedinPage.goto("https://www.linkedin.com/notifications/?filter=all", {
      timeout: 0,
    });
    await linkedinPage.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  } catch (e) {
    console.error(e);
  }

  const X_Page = await browser.newPage();
  await intercept(X_Page, {
    injectScripts: async (page) => {
      await injectCommons(page);
      await injectScripts(page, [generalScript, X_Script]);
    },
  });
  try {
    X_Page.goto("https://x.com/notifications", {
      timeout: 0,
    });
    await X_Page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  } catch (e) {
    console.error(e);
  }

  //   await browser.close();
})();
