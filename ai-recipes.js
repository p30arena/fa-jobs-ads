require("dotenv").config();
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const client = new (require("openai").OpenAI)();

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

async function test_classify_post(filePath) {
  const zTxtAnalysisResponse = z.object({
    result: z.array(
      z.object({
        key: z.number(),
        post_type: z.enum(["job_posting", "contract_project", "other"]),
      })
    ),
  });

  const txtAnalysisResponseFormat = zodResponseFormat(
    zTxtAnalysisResponse,
    "TxtAnalysis"
  );

  const MAX_TOKENS = 128_000;
  const data = (
    await require("fs/promises").readFile(filePath, {
      encoding: "utf-8",
    })
  )
    .split("\n")
    .filter((it) => it)
    .map((it) => JSON.parse(it))
    // .map((it, i) => ({
    //   ...it,
    //   time:
    //     typeof it["time"].indexOf("ago") > -1
    //       ? parseTimeAgo(it["time"])
    //       : new Date(it["time"]),
    // }))
    .map((it, i) => ({ ...it, excerpt: it["text"].slice(0, 500), key: i }));
  // .filter((it) => Date.now() - it["time"].getTime() < 2 * timeUnits["week"]);

  const forAi = data.filter((it) => !it.ai);

  if (!forAi.length) return;

  console.log("start");

  let chunks = [];
  let cnt = 0;
  let i = 0;

  for (const item of forAi) {
    chunks.push({ key: item.key, text: item.excerpt });
    cnt += item.text.length;

    if (cnt > MAX_TOKENS / 2 || i++ == forAi.length - 1) {
      const res = await client.beta.chat.completions.parse({
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
${JSON.stringify(chunks)}
        `,
          },
        ],
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: txtAnalysisResponseFormat,
      });

      cnt = 0;
      chunks = [];

      if (res.choices.length) {
        for (const { key, post_type } of res.choices[0].message.parsed.result) {
          data[key].ai = { post_type };

          if (post_type !== "other") {
            console.log(data[key].time);
            console.log(data[key].profile_link ?? data[key].links?.post);
            console.log(data[key].text);
            console.log("\n\n\n");
          }
        }
      }
    }
  }

  await require("fs/promises").writeFile(
    filePath,
    data.map((it) => JSON.stringify(it)).join("\n"),
    {
      encoding: "utf-8",
    }
  );
}

async function sales_advice(filePath) {
  const data = (
    await require("fs/promises").readFile(filePath, {
      encoding: "utf-8",
    })
  )
    .split("\n")
    .filter((it) => it)
    .map((it) => JSON.parse(it));

  const forAi = data.filter((it) => !it.ai);

  if (!forAi.length) return;

  console.log("start");

  for (const item of forAi) {
    try {
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a helpful Sales Assistant of TikoShop (tikoshop.ir), a Skin Care Shop with Original Products!
If the user is complaining about her/his skin condition, help and introduce them to TikoShop (تیکوشاپ), otherwise, give an empty response.
We'd rather your tone to be friendly, welcoming, and informal, but adjust the tone if the user's message is formal.
Adjust your response for Twitter/X, it must be less than 280 characters.
`,
          },
          {
            role: "user",
            content: item.text,
          },
        ],
      });

      if (res.choices.length) {
        const content = res.choices[0].message.content;
        if (content) {
          item.ai = { content };

          console.log("query: ", item.text);
          console.log("answer: ", content);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  await require("fs/promises").writeFile(
    filePath,
    data.map((it) => JSON.stringify(it)).join("\n"),
    {
      encoding: "utf-8",
    }
  );
}

module.exports = {
  test_classify_post,
  sales_advice,
};
