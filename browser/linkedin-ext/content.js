function bilbil_log(...args) {
  const item = document.createElement("span");
  item.innerHTML =
    '<span style="font-size: 14px; color: #9E9E9E;">' +
    new Date().toISOString() +
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
  if (!api_key) return new Promise((s, f) => f("api_key"));

  return fetch("https://api.openai.com/v1/chat/completions", {
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
          content: `
You are a classifier analyzing LinkedIn posts to categorize them into specific types. Your goal is to classify each post as either:

1. "job_posting": Posts explicitly advertising job openings. These posts include:
 - Keywords such as "hiring," "position available," "we’re looking for," or "apply now."
 - Include specific job roles, locations, qualifications, or application instructions.

2. "contract_project": Posts explicitly offering freelance, consulting, or contract-based opportunities. These posts include:
 - Keywords like "freelance," "short-term project," "contract opportunity," or "remote work."
 - A clear offer to engage in a paid, task-specific arrangement.

3. "other": Posts that do not meet the above criteria, even if they mention projects, collaborations, or teamwork. Examples of "other" include:
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
${JSON.stringify(data)}
      `,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  })
    .then((r) => r.json())
    .then((r) =>
      JSON.parse(r.choices?.[0]?.message?.content ?? '{ "result": [] }')
    );
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
  s.textContent = ".bilbil_hidden {visibility: hidden;}";
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

          bilbil_log(ifr.contentDocument.readyState);

          const style = ifr.contentDocument.createElement("style");
          style.textContent = "img, video, audio {display: none !important;}";
          ifr.contentDocument.head.appendChild(style);

          try {
            const MAX_DEPTH = 3;

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
  const RUN_DELAY = 300_000;

  let lastRun = localStorage.getItem("bilbil_last_run");
  if (lastRun) {
    lastRun = new Date(lastRun);
    const diff = Date.now() - lastRun.getTime();

    if (RUN_DELAY > diff) {
      await delay(RUN_DELAY - diff);
    }
  }

  await search(terms);

  localStorage.setItem("bilbil_last_run", new Date().toISOString());

  await delay(RUN_DELAY);

  search_loop(terms);
}

(() => {
  let statusElement = document.createElement("div");
  let ifr = document.createElement("iframe");

  window.statusElement = statusElement;
  window.ifr = ifr;

  const get_container = () =>
    document.querySelector(".global-nav__primary-items");
  const get_toggle_btn = () => document.getElementById("bilbil_toggle");
  const get_dump_btn = () => document.getElementById("bilbil_dump");
  const get_ai_btn = () => document.getElementById("bilbil_ai");
  const get_empty_btn = () => document.getElementById("bilbil_empty");

  const inject = () => {
    window.bilbil_toggle_click = () => {
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      } else {
        statusElement.className = "bilbil_hidden";
      }
    };
    const toggleBtnElement = document.createElement("span");
    toggleBtnElement.innerHTML = `<li class="global-nav__primary-item"><a class="global-nav__primary-link global-nav__primary-link" target="_self"><button id="bilbil_toggle">Terminal</button></a></li>`;
    get_container().appendChild(toggleBtnElement);
    get_toggle_btn().onclick = bilbil_toggle_click;

    window.bilbil_dump_click = () => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      }
    };
    const dumpBtnElement = document.createElement("span");
    dumpBtnElement.innerHTML = `<li class="global-nav__primary-item"><a class="global-nav__primary-link global-nav__primary-link" target="_self"><button id="bilbil_dump">Dump</button></a></li>`;
    get_container().appendChild(dumpBtnElement);
    get_dump_btn().onclick = bilbil_dump_click;

    window.bilbil_ai_click = () => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      }

      bilbil_log("asking ai");

      prompt_ai(localStorage.getItem("bilbil_api_key"), agg)
        .then((r) => {
          const filtered = [];
          for (const { key, post_type } of r.result) {
            bilbil_log("post_type: ", post_type);
            if (post_type !== "other") {
              filtered.push(agg[key]);
            }
          }

          bilbil_log("\n\n\n---------------------------------\n\n\n");

          bilbil_log(filtered.map((it) => JSON.stringify(it)).join("\n"));
        })
        .catch((e) => {
          if (e === "api_key") {
            bilbil_error("must define api_key");
          }
        });
    };
    const aiBtnElement = document.createElement("span");
    aiBtnElement.innerHTML = `<li class="global-nav__primary-item"><a class="global-nav__primary-link global-nav__primary-link" target="_self"><button id="bilbil_ai">AI</button></a></li>`;
    get_container().appendChild(aiBtnElement);
    get_ai_btn().onclick = bilbil_ai_click;

    window.bilbil_empty_click = () => {
      bilbil_clear();
      localStorage.removeItem("bilbil_data");
    };
    const emptyBtnElement = document.createElement("span");
    emptyBtnElement.innerHTML = `<li class="global-nav__primary-item"><a class="global-nav__primary-link global-nav__primary-link" target="_self"><button id="bilbil_empty">Empty</button></a></li>`;
    get_container().appendChild(emptyBtnElement);
    get_empty_btn().onclick = bilbil_empty_click;

    prepare();
    search_loop(['"پروژه" هوش مصنوعی "فارسی"', '"پروژه" AI', '"پروژه" NLP']);
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
