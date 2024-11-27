function bilbil_log(...args) {
  const item = document.createElement("span");
  item.innerHTML =
    '<span style="font-size: 14px; color: #9E9E9E;">' +
    new Date().toLocaleString() +
    "</span>" +
    "<br>" +
    "<span>" +
    args.map((it) => (typeof it === "string" ? it : it.toString())).join(" ") +
    "</span>" +
    "<br>";

  statusElement.appendChild(item);

  setTimeout(() => statusElement.scrollTo(0, statusElement.scrollHeight), 0);
}

function bilbil_error(...args) {
  bilbil_log(...args);
}

function bilbil_clear() {
  statusElement.innerHTML = "";
  setTimeout(() => statusElement.scrollTo(0, 0), 0);
}

async function prompt_ai(api_key, data) {
  const MAX_TOKENS = 128_000;
  data = data.map((it, i) => ({
    ...it,
    excerpt: it["text"].slice(0, 500),
    key: i,
  }));

  if (!api_key) return new Promise((s, f) => f("api_key"));

  const promptStr = `
You are a classifier analyzing LinkedIn posts to categorize them into specific types. Your goal is to classify each post as either:

1. "job_posting": Posts explicitly advertising job openings. These posts include:
  - Keywords such as "hiring," "position available," "we’re looking for," or "apply now."
  - Include specific job roles, locations, qualifications, or application instructions.

2. "contract_project": Posts explicitly offering freelance, consulting, or contract-based opportunities. These posts include:
  - Keywords like "freelance," "short-term project," "contract opportunity," or "remote work."
  - A clear offer to engage in a paid, task-specific arrangement.

3. "other": Posts that do not meet the above criteria, even if they mention projects, collaborations, or teamwork. Examples of "other" include:
  - Authors seeking jobs or projects (e.g., "I am looking for a role in...").
  - Personal or team updates, such as starting, working on, or completing a project.
  - Personal updates or experiences.
  - Sharing professional frustrations or challenges.
  - Posts sharing tools, tutorials, or non-commercial initiatives.
  - General discussions about technology, achievements, or learning experiences.
  - Advertising the author’s own skills or services without offering a role or opportunity.
  - Inviting general discussions, collaborations, or non-commercial contributions.
  - Invitations to participate in unpaid projects, community initiatives, or open-source collaborations.
  - Posts inviting general discussions, collaboration, or feedback without offering a paid opportunity.
  - Promoting tools, research, or volunteer opportunities without financial compensation.

Special Instructions:
- Posts where the author is seeking a job or project opportunity (e.g., "I am looking for a role as...") must always be classified as "other."
- Posts where the author is promoting their own services (e.g., "I am open to projects in X") should always be classified as "other."
- Posts inviting unpaid contributions or volunteer work (e.g., "participate in our research project" or "help build a community database") should always be classified as "other."
- Posts describing community-driven or open-source projects should be classified as "other."
- Posts inviting conversations, collaboration, or feedback without mentioning a paid opportunity should also be classified as "other."
- Posts mentioning "starting a project" without offering roles or paid opportunities should be classified as "other."
- Posts celebrating personal or team milestones should also be classified as "other."
- Avoid classifying any post as "job_posting" or "contract_project" unless there is a clear invitation for hiring or paid engagement.
- Focus on identifying explicit invitations for hiring or contract work. Avoid classifying posts as "job_posting" or "contract_project" unless they meet the criteria exactly.


Example:

Input:
[
  {
      "key": 0,
      "text": "We're hiring a software engineer to join our team in San Francisco. Apply now!"
  },
  {
      "key": 1,
      "text": "Looking for a freelancer to help with a short-term mobile app development project. Remote work."
  },
  {
      "key": 2,
      "text": "Excited to share my thoughts on leadership in the tech industry."
  }
]


Output:
{
  "result": [
      {
          "key": 0,
          "post_type": "job_posting"
      },
      {
          "key": 1,
          "post_type": "contract_project"
      },
      {
          "key": 2,
          "post_type": "other"
      }
  ]
}


Task:

Please classify the following posts and return the Output JSON:
`;

  let agg = [];
  let chunks = [];
  let cnt = 0;
  let i = 0;

  for (const item of data) {
    chunks.push({ key: item.key, text: item.excerpt });
    cnt += item.text.length;
    i++;

    if (promptStr.length + cnt > MAX_TOKENS * 0.7 || i == data.length - 1) {
      cnt = 0;

      try {
        let res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${api_key}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: promptStr + JSON.stringify(chunks),
              },
            ],
            temperature: 0,
            response_format: { type: "json_object" },
          }),
        });

        cnt = 0;
        chunks = [];

        res = await res.json();

        agg = [
          ...agg,
          ...JSON.parse(
            res.choices?.[0]?.message?.content ?? '{ "result": [] }'
          ).result,
        ];
      } catch (e) {
        bilbil_error(e);
      }
    }
  }

  return agg;
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
    chrome.runtime.sendMessage({ action: "delay", ms }, (response) => {
      resolve();
    });
  });
}

function prepare() {
  const s = document.createElement("style");
  s.textContent =
    ".bilbil_hidden {visibility: hidden;} .bilbil_alert{background-color: red !important;}";
  document.head.appendChild(s);

  document.body.appendChild(statusElement);
  document.body.appendChild(ifr);

  ifr.width = "1400px";
  ifr.height = "700px";

  ifr.style =
    "visibility: hidden; position: absolute; top: 0; left: 0; z-index: -1;";
  statusElement.style =
    "width: 500px; height: 500px; position: absolute; top: 0; left: 0; z-index: 999; background-color: #ffffffee; overflow: scroll;";
}

async function helper_prompt_ai() {
  bilbil_log("asking ai");

  try {
    const all = JSON.parse(localStorage.getItem("bilbil_data"));
    const forAi = all.filter((it) => !it.ai);

    bilbil_log("items: ", forAi.length);

    const r = await prompt_ai(localStorage.getItem("bilbil_api_key"), forAi);

    bilbil_log("got response");

    const filtered = [];
    for (const { key, post_type } of r) {
      forAi[key].ai = { post_type };
      if (post_type !== "other") {
        filtered.push(forAi[key]);
      }
    }

    localStorage.setItem("bilbil_data", JSON.stringify(all));
    localStorage.setItem(
      "bilbil_cnt_not_other",
      all.reduce(
        (s, it) =>
          it.ai?.post_type && it.ai.post_type !== "other" ? s + 1 : s,
        0
      )
    );

    bilbil_log("\n\n\n---------------------------------\n\n\n");

    bilbil_log(filtered.map((it) => JSON.stringify(it)).join("\n"));

    updateAlert();
  } catch (e) {
    if (e === "api_key") {
      bilbil_error("must define api_key");
    } else {
      bilbil_error(e);
    }
  }
}

async function search(terms, MAX_DEPTH = 10) {
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

          bilbil_log(ifr.contentDocument.readyState);

          const style = ifr.contentDocument.createElement("style");
          style.textContent = "img, video, audio {display: none !important;}";
          ifr.contentDocument.head.appendChild(style);

          try {
            const moreBtn = () =>
              ifr.contentDocument.querySelector(
                ".scaffold-finite-scroll__load-button"
              );

            try {
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
            } catch (e) {
              bilbil_error(e);
            }

            const extracted = [
              ...ifr.contentDocument.querySelectorAll("div[data-urn]"),
            ]
              .map((it) => ({
                // urn: Number(
                //   it.getAttribute("data-urn").replace("urn:li:activity:", "")
                // ),
                urn: it.getAttribute("data-urn"),
                time: parseTimeAgo(
                  it
                    .querySelector(
                      "div > div > a.update-components-actor__sub-description-link > span > span.visually-hidden"
                    )
                    ?.textContent?.trim()
                ),
                profile_link:
                  (($_profile =
                    it.querySelector(
                      "div > div > div.fie-impression-container > div.relative > div.display-flex.update-components-actor--with-control-menu > div > a"
                    )?.href ?? ""),
                  ($_idx = $_profile.indexOf("?")) > -1
                    ? $_profile.substr(0, $_idx)
                    : $_profile),
                text: it
                  .querySelector("div.update-components-text")
                  ?.textContent?.trim(),
              }))
              .filter((it) => it.profile_link && it.text && it.time && it.urn);

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
          it["urn"] && Date.now() - it["time"].getTime() < timeUnits["month"]
      );
      agg.sort((a, b) => a.time - b.time);

      if (agg.length) {
        bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));

        const MAX_ENTRIES = 500;

        const prevData = JSON.parse(
          localStorage.getItem("bilbil_data") ?? "[]"
        );
        const uniqUrns = new Map();
        {
          let i = 0;
          for (const item of prevData) {
            uniqUrns.set(item.urn, i++);
          }
        }

        let all = [...prevData];

        for (const item of agg) {
          if (!uniqUrns.has(item.urn)) {
            all.push(item);
          } else {
            // update text
            all[uniqUrns.get(item.urn)].text = item.text;
          }
        }
        if (MAX_ENTRIES < all.length) {
          const offset = all.length - MAX_ENTRIES;
          all = all.slice(offset);
        }

        localStorage.setItem("bilbil_data", JSON.stringify(all));

        await helper_prompt_ai();
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

function clearLocalStorage_1() {
  localStorage.removeItem("bilbil_cnt_not_other");
  localStorage.removeItem("bilbil_last_run");
  localStorage.removeItem("bilbil_data");
  localStorage.removeItem("bilbil_time");
  localStorage.removeItem("bilbil_urn");
}

function updateAlert() {
  let cntNotOther = localStorage.getItem("bilbil_cnt_not_other");
  if (cntNotOther) {
    cntNotOther = Number(cntNotOther);
    if (cntNotOther) {
      buttonsContainer.className = "bilbil_alert";
    } else {
      buttonsContainer.className = "";
    }
  }
}

async function search_loop(terms) {
  const RUN_DELAY = 300_000;

  updateAlert();

  let lastRunLessThanDay = false;
  let lastRun = localStorage.getItem("bilbil_last_run");
  if (lastRun) {
    lastRun = new Date(lastRun);
    const diff = Date.now() - lastRun.getTime();

    lastRunLessThanDay = diff < timeUnits["day"];

    if (RUN_DELAY > diff) {
      await delay(RUN_DELAY - diff);
    }
  }

  await search(terms, lastRunLessThanDay ? 3 : 10);

  localStorage.setItem("bilbil_last_run", new Date().toISOString());

  await delay(RUN_DELAY);

  search_loop(terms);
}

(() => {
  const get_container = () =>
    document.querySelector(".global-nav__primary-items");
  const get_toggle_btn = () => document.getElementById("bilbil_toggle");

  const inject = () => {
    let statusElement = document.createElement("div");
    let ifr = document.createElement("iframe");
    let buttonsContainer = document.createElement("ul");

    buttonsContainer.style =
      "position: absolute; top: 0; right: 0; width: 480px; height: 52px; background-color: #fff; display: flex; z-index: 999; list-style: none;";

    document.body.appendChild(buttonsContainer);

    window.statusElement = statusElement;
    window.ifr = ifr;
    window.buttonsContainer = buttonsContainer;

    window.bilbil_toggle_click = (ev) => {
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      } else {
        statusElement.className = "bilbil_hidden";
      }
    };
    const toggleBtnElement = document.createElement("li");
    toggleBtnElement.id = "bilbil_toggle";
    toggleBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Terminal</a>`;
    buttonsContainer.appendChild(toggleBtnElement);
    toggleBtnElement.addEventListener("click", bilbil_toggle_click);

    window.bilbil_dump_click = (ev) => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      }
    };
    const dumpBtnElement = document.createElement("li");
    dumpBtnElement.id = "bilbil_dump";
    dumpBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Dump</a>`;
    buttonsContainer.appendChild(dumpBtnElement);
    dumpBtnElement.addEventListener("click", bilbil_dump_click);

    window.bilbil_dumpAlert_click = (ev) => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      agg = agg.filter(
        (it) => it.ai?.post_type && it.ai?.post_type !== "other" && !it.resolved
      );
      bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      }
    };
    const dumpAlertBtnElement = document.createElement("li");
    dumpAlertBtnElement.id = "bilbil_dumpAlert";
    dumpAlertBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">DumpAlert</a>`;
    buttonsContainer.appendChild(dumpAlertBtnElement);
    dumpAlertBtnElement.addEventListener("click", bilbil_dumpAlert_click);

    window.bilbil_resolveAlert_click = (ev) => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      agg = agg.filter(
        (it) => it.ai?.post_type && it.ai?.post_type !== "other" && !it.resolved
      );
      agg.forEach((it) => (it.resolved = true));
      localStorage.setItem("bilbil_data", JSON.stringify(agg));
      localStorage.setItem("bilbil_cnt_not_other", "0");
      updateAlert();
    };
    const resolveAlertBtnElement = document.createElement("li");
    resolveAlertBtnElement.id = "bilbil_resolveAlert";
    resolveAlertBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">ResolveAlert</a>`;
    buttonsContainer.appendChild(resolveAlertBtnElement);
    resolveAlertBtnElement.addEventListener("click", bilbil_resolveAlert_click);

    window.bilbil_ai_click = (ev) => {
      helper_prompt_ai();
    };
    const aiBtnElement = document.createElement("li");
    aiBtnElement.id = "bilbil_ai";
    aiBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">AI</a>`;
    buttonsContainer.appendChild(aiBtnElement);
    aiBtnElement.addEventListener("click", bilbil_ai_click);

    window.bilbil_empty_click = (ev) => {
      bilbil_clear();
      updateAlert();
      localStorage.removeItem("bilbil_data");
    };
    const emptyBtnElement = document.createElement("li");
    emptyBtnElement.id = "bilbil_empty";
    emptyBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Empty</a>`;
    buttonsContainer.appendChild(emptyBtnElement);
    emptyBtnElement.addEventListener("click", bilbil_empty_click);

    function keepAlive() {
      chrome.runtime.sendMessage(
        { action: "delay", ms: 10_000 },
        (response) => {
          // bilbil_log("keepAlive");
          keepAlive();
        }
      );
    }

    keepAlive();
    prepare();
    search_loop([
      '"پروژه" هوش مصنوعی "فارسی"',
      '"پروژه" AI',
      '"پروژه" NLP',
      '("پروژه همکاری" OR "فرصت شغلی" OR "دنبال تیم") هوش مصنوعی',
      '("پروژه همکاری" OR "فرصت شغلی" OR "دنبال تیم") (وب OR موبایل)',
    ]);
  };

  const observer = new MutationObserver(function (mutations, mutationInstance) {
    if (get_container()) {
      mutationInstance.disconnect();
      if (!get_toggle_btn()) {
        inject();
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
})();
