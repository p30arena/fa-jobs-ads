function bilbil_log(...args) {
  statusElement.value += args.join(" ") + "\n";
  setTimeout(() => statusElement.scrollTo(0, statusElement.scrollHeight), 0);
}

function bilbil_error(...args) {
  statusElement.value += args.join(" ") + "\n";
  setTimeout(() => statusElement.scrollTo(0, statusElement.scrollHeight), 0);
}

function bilbil_clear() {
  statusElement.value = "";
  setTimeout(() => statusElement.scrollTo(0, 0), 0);
}

function prompt_ai(api_key, data) {
  if (!api_key) return;

  fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      Authorization: `Bearer ${api_key}`,
    },

    body: JSON.stringify({
      model: "gpt-4o-mini",

      messages: [{ role: "user", content: "Say this is a test!" }],

      temperature: 0.7,
    }),
  })
    .then((r) => r.json())
    .then((r) => bilbil_log(r));
}

var timeUnits = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000, // Approximate month length
  year: 365 * 24 * 60 * 60 * 1000,
};
timeUnits = Object.fromEntries([
  ...Object.entries(timeUnits),
  ...Object.entries(timeUnits).map(([k, v]) => [k + "s", v]),
]);

function parseTimeAgo(timeAgoStr) {
  const match = timeAgoStr.match(/(\d+) (\w+) ago/);
  if (!match) {
    throw new Error("Invalid time ago string format");
  }

  const [_, number, unit] = match;

  const timeDiff = Number(number) * timeUnits[unit.toLowerCase()];
  const now = new Date();
  const pastTime = new Date(now.getTime() - timeDiff);

  return pastTime;
}

function zip(...arrays) {
  const maxLength = Math.max(...arrays.map((arr) => arr.length));
  const result = [];

  for (let i = 0; i < maxLength; i++) {
    result.push(arrays.map((arr) => arr[i]));
  }

  return result;
}

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function prepare() {
  const s = document.createElement("style");
  s.textContent = ".bilbil_hidden {visibility: hidden;}";
  document.head.appendChild(s);

  document.body.appendChild(statusElement);
  document.body.appendChild(ifr);

  ifr.width = "1400px";
  ifr.height = "700px";

  ifr.style =
    "visibility: hidden; position: absolute; top: 0; left: 0; z-index: -1;";
  statusElement.style =
    "width: 500px; height: 500px; position: absolute; top: 0; left: 0; z-index: 999; background-color: #ffffffee;";
}

async function search(terms) {
  let agg = [];

  for (const search of terms) {
    bilbil_log("keyword: ", search);
    let promiseFinalized = false;
    try {
      const p = new Promise(async (promiseSuccess, promiseFailure) => {
        ifr.onload = async () => {
          if (!ifr.contentDocument) {
            bilbil_log("false load");
            return; // false load event
          }

          try {
            const MAX_DEPTH = 3;
            bilbil_log("loaded");

            const moreBtn = () =>
              ifr.contentDocument.querySelector(
                ".scaffold-finite-scroll__load-button"
              );

            let depth = 0;
            while (moreBtn() && depth++ < MAX_DEPTH) {
              bilbil_log("page: ", depth);

              ifr.contentWindow.scrollTo(
                0,
                ifr.contentDocument.body.scrollHeight
              );

              await delay(3000);

              let cnt = 0;
              while (!moreBtn() && cnt++ < 10) {
                bilbil_log("probing: ", cnt);
                await delay(1000);
              }
            }

            const extracted = zip(
              [
                ...ifr.contentDocument.querySelectorAll(
                  "div.update-components-text"
                ),
              ].map((it) => it.textContent.trim()),
              [
                ...ifr.contentDocument.querySelectorAll(
                  "div > div > div.fie-impression-container > div.relative > div.display-flex.update-components-actor--with-control-menu > div > a"
                ),
              ].map((it) => it.href),
              [
                ...ifr.contentDocument.querySelectorAll(
                  "div > div > a.update-components-actor__sub-description-link > span > span.visually-hidden"
                ),
              ].map((it) => it.textContent.trim()),
              [...ifr.contentDocument.querySelectorAll("div[data-urn]")].map(
                (it) => it.getAttribute("data-urn")
              )
            )
              .filter((it) => it[1])
              .map((it) => ({
                text: it[0],
                profile_link:
                  ($_idx = it[1].indexOf("?")) > -1
                    ? it[1].substr(0, $_idx)
                    : it[1],
                time: parseTimeAgo(it[2]),
                urn: Number(it[3]?.replace("urn:li:activity:", "")),
              }));

            promiseSuccess(extracted);
          } catch (e) {
            promiseFailure(e);
          }
        };

        ifr.onerror = (ev) => {
          promiseFailure(ev);
        };

        ifr.src = `https://www.linkedin.com/search/results/content/?datePosted="past-month"&keywords=${encodeURIComponent(
          search
        )}&origin=FACETED_SEARCH&sid=~nt&sortBy="date_posted"`;

        await delay(120_000);

        if (!promiseFinalized) {
          promiseFailure(new Error("timeout"));
        }
      });

      const data = await p;
      agg = [...agg, ...data];
      bilbil_log("result length: ", data.length);
    } catch (e) {
      bilbil_error(e);
    } finally {
      promiseFinalized = true;
    }
  }

  try {
    bilbil_log("search done");
    bilbil_clear();

    if (agg.length) {
      agg = agg.filter(
        (it) =>
          it["urn"] && Date.now() - it["time"].getTime() < timeUnits["week"]
      );
      agg.sort((a, b) => a.time - b.time);
      let storedUrn = localStorage.getItem("bilbil_urn");
      let storedTime = localStorage.getItem("bilbil_time");
      if (storedTime) {
        storedTime = new Date(storedTime);
        agg = agg.filter((it) => it["time"].getTime() > storedTime.getTime());
      }
      if (storedUrn) {
        storedUrn = Number(storedUrn);
        agg = agg.filter((it) => it["urn"] > storedUrn);
      }

      if (agg.length) {
        bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));

        localStorage.setItem(
          "bilbil_time",
          agg[agg.length - 1].time.toISOString()
        );
        localStorage.setItem("bilbil_urn", agg[agg.length - 1].urn);

        prompt_ai(localStorage.getItem("bilbil_api_key"), agg);

        const MAX_ENTRIES = 500;

        let all = [
          ...JSON.parse(localStorage.getItem("bilbil_data") ?? "[]"),
          ...agg,
        ];
        if (MAX_ENTRIES < all.length) {
          const offset = all.length - MAX_ENTRIES;
          all = all.slice(offset);
        }

        localStorage.setItem("bilbil_data", JSON.stringify(all));
      } else {
        bilbil_log("empty 2");
      }
    } else {
      bilbil_log("empty 1");
    }
  } catch (e) {
    bilbil_error(e);
  }
}

async function search_loop(terms) {
  await search(terms);
  await delay(300_000);
  search_loop(terms);
}

(() => {
  let statusElement = document.createElement("textarea");
  let ifr = document.createElement("iframe");

  window.statusElement = statusElement;
  window.ifr = ifr;

  const get_container = () =>
    document.querySelector(".global-nav__primary-items");
  const get_retry_btn = () => document.getElementById("xyz_retry");
  const inject = () => {
    window.xyz_retry = () => {
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      } else {
        statusElement.className = "bilbil_hidden";
      }
    };
    qwe = document.createElement("span");
    qwe.innerHTML = `<li class="global-nav__primary-item"><button id="xyz_retry" class="h-10 rounded-lg px-2 text-token-text-secondary focus-visible:outline-0 disabled:text-token-text-quaternary focus-visible:bg-token-main-surface-secondary enabled:hover:bg-token-main-surface-secondary"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-2xl"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.1918 8.90615C15.6381 8.45983 16.3618 8.45983 16.8081 8.90615L21.9509 14.049C22.3972 14.4953 22.3972 15.2189 21.9509 15.6652C21.5046 16.1116 20.781 16.1116 20.3347 15.6652L17.1428 12.4734V22.2857C17.1428 22.9169 16.6311 23.4286 15.9999 23.4286C15.3688 23.4286 14.8571 22.9169 14.8571 22.2857V12.4734L11.6652 15.6652C11.2189 16.1116 10.4953 16.1116 10.049 15.6652C9.60265 15.2189 9.60265 14.4953 10.049 14.049L15.1918 8.90615Z" fill="currentColor"></path></svg></button></li>`;
    get_container().appendChild(qwe);
    get_retry_btn().onclick = xyz_retry;

    prepare();
    search(['"پروژه" هوش مصنوعی "فارسی"', '"پروژه" AI', '"پروژه" NLP']);
  };

  const observer = new MutationObserver(function (mutations, mutationInstance) {
    if (get_container()) {
      mutationInstance.disconnect();
      if (!get_retry_btn()) {
        inject();
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
})();
