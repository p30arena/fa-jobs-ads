const PROMPT_CLASSIFIER_JOBS_1 = `
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

function bilbil_log(...args) {
  const content = args
    .map((it) => (typeof it === "string" ? it : it.toString()))
    .join(" ");

  const item = document.createElement("span");
  item.innerHTML =
    '<span style="font-size: 14px; color: #9E9E9E;">' +
    new Date().toLocaleString() +
    "</span>" +
    "<br>" +
    "<span>" +
    content +
    "</span>" +
    "<br>";

  statusElement.appendChild(item);

  sendMessageToBot(content);

  setTimeout(() => statusElement.scrollTo(0, statusElement.scrollHeight), 0);
}

function bilbil_error(...args) {
  bilbil_log(...args);
}

function bilbil_clear() {
  statusElement.innerHTML = "";
  setTimeout(() => statusElement.scrollTo(0, 0), 0);
}

async function complete_coversation(api_key, context, conversation, guide) {
  if (!conversation) return "";
  if (!api_key) return new Promise((s, f) => f("api_key"));

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
            content: `
${context}

This a Conversation between two peers, give an appropriate response to the conversation as the responding peer in the conversation.
Don't use the phrase "### User n:" (n is the user number) in your response.
${
  guide
    ? `

Response Guide: ${guide}

`
    : ""
}
Conversation:

${conversation}`,
          },
        ],
        temperature: 0,
      }),
    });

    res = await res.json();

    if (res.error) {
      throw res.error;
    }

    const resMsg = res.choices?.[0]?.message?.content ?? "";
    if (!resMsg) {
      bilbil_log(JSON.stringify(res));
    }

    return resMsg;
  } catch (e) {
    bilbil_error(e);
  }
}

async function classifier(api_key, promptStr, data) {
  if (!data.length) return [];

  const MAX_TOKENS = 128_000;
  data = data.map((it, i) => ({
    ...it,
    excerpt: it["text"].slice(0, 500),
    key: i,
  }));

  if (!api_key) return new Promise((s, f) => f("api_key"));

  let agg = [];
  let chunks = [];
  let cnt = 0;
  let i = 0;

  for (const item of data) {
    chunks.push({ key: item.key, text: item.excerpt });
    cnt += item.text.length;

    if (promptStr.length + cnt > MAX_TOKENS * 0.7 || i++ == data.length - 1) {
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

        if (res.error) {
          throw res.error;
        }

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

let timeUnits = {
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

async function helper_classifier(promptStr) {
  bilbil_log("asking ai");

  try {
    const all = JSON.parse(localStorage.getItem("bilbil_data"));
    const forAi = all.filter((it) => !it.ai);

    bilbil_log("items: ", forAi.length);

    const r = await classifier(
      localStorage.getItem("bilbil_api_key"),
      promptStr,
      forAi
    );

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
          it.ai?.post_type && it.ai.post_type !== "other" && !it.resolved
            ? s + 1
            : s,
        0
      )
    );

    updateAlert();

    bilbil_log("\n\n\n---------------------------------\n\n\n");
    bilbil_log(filtered.map((it) => JSON.stringify(it)).join("\n"));
  } catch (e) {
    if (e === "api_key") {
      bilbil_error("must define api_key");
    } else {
      bilbil_error(e);
    }
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

async function helper_complete_coversation(conversation, guide) {
  bilbil_log("complete coversation");

  try {
    const r = await complete_coversation(
      localStorage.getItem("bilbil_api_key"),
      "",
      conversation,
      guide
    );

    bilbil_log("got response");

    return r;
  } catch (e) {
    if (e === "api_key") {
      bilbil_error("must define api_key");
    } else {
      bilbil_error(e);
    }
  }
}

function setMainBotChat() {
  const tbot = localStorage.getItem("bilbil_tbot");
  if (!tbot) return;

  const mainChatId = localStorage.getItem("bilbil_mainChatId");
  if (mainChatId) return;

  fetch(`https://api.telegram.org/bot${tbot}/getUpdates`)
    .then((response) => response.json())
    .then((data) => {
      const mainChatId = data.result[0].message.chat.id;
      localStorage.setItem("bilbil_mainChatId", mainChatId);
    });
}

let _bot_queue = new Map();
let _bot_lock = false;

async function sendMessageToBot(message) {
  const tbot = localStorage.getItem("bilbil_tbot");
  if (!tbot) return;

  const mainChatId = localStorage.getItem("bilbil_mainChatId");
  if (!mainChatId) return;

  while (_bot_lock) {
    await delay(1000);
  }

  _bot_lock = true;

  try {
    const maxMessageLength = 4096;
    const parts = [];
    let start = 0;

    while (start < message.length) {
      parts.push(message.slice(start, start + maxMessageLength));
      start += maxMessageLength;
    }

    for (const part of parts) {
      await fetch(
        `https://api.telegram.org/bot${tbot}/sendMessage?chat_id=${mainChatId}&text=${encodeURIComponent(
          part
        )}`
      );
    }
  } catch (e) {
    bilbil_error(e);
  }

  _bot_lock = false;
}

function keepAlive() {
  try {
    chrome.runtime.sendMessage(
      { action: "disableAutoDiscardable" },
      (response) => {
        // console.log(response);
      }
    );

    chrome.runtime.sendMessage({ action: "delay", ms: 10_000 }, (response) => {
      keepAlive();
    });

    document.body.setAttribute("bilbil_keepAlive_running", "true");
  } catch (e) {
    document.body.setAttribute("bilbil_keepAlive_running", "false");
    bilbil_error(e);
  }
}

function activateTab() {
  chrome.runtime.sendMessage({ action: "activateTab" }, (response) => {
    // console.log(response);
  });
}

function checkIdleAndActivateTab() {
  chrome.runtime.sendMessage(
    { action: "checkIdleAndActivateTab" },
    (response) => {
      // console.log(response);
    }
  );
}
