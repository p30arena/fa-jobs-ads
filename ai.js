require("dotenv").config();
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const client = new (require("openai").OpenAI)();

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

async function main() {
  const MAX_TOKENS = 128_000;
  const data = (
    await require("fs/promises").readFile(
      "./data/2024-11-26/linkedin-projects-ai.jsonl",
      "utf8"
    )
  )
    .split("\n")
    .filter((it) => it)
    .map((it, i) => ({ ...JSON.parse(it), key: i }))
    .map((it) => ({ ...it, time: parseTimeAgo(it["time"]) }))
    .map((it) => ({ ...it, excerpt: it["text"].slice(0, 500) }));
  // .filter((it) => Date.now() - it["time"].getTime() < 2 * timeUnits["week"]);

  let chunks = [];
  let cnt = 0;
  let i = 0;

  for (const item of data) {
    chunks.push({ key: item.key, text: item.excerpt });
    cnt += item.text.length;
    i++;

    if (cnt > MAX_TOKENS / 2 || i == data.length - 1) {
      const res = await client.beta.chat.completions.parse({
        messages: [
          {
            role: "system",
            content: `
You are a classifier analyzing LinkedIn posts to categorize them into specific types. Your goal is to classify each post as either:

1. **"job_posting"**: Posts explicitly advertising job openings. These posts include:
   - Keywords such as "hiring," "position available," "we’re looking for," or "apply now."
   - Information about job roles, qualifications, locations, or application instructions.

2. **"contract_project"**: Posts explicitly offering freelance, consulting, or contract-based opportunities. These posts include:
   - Keywords like "freelance," "short-term project," "contract opportunity," or "remote work."
   - A clear offer to engage in a paid, task-specific arrangement.

3. **"other"**: Posts that do not meet the above criteria, even if they mention projects, collaborations, or teamwork. Examples of "other" include:
   - Personal or team updates, such as starting, working on, or completing a project.
   - Posts sharing tools, tutorials, or non-commercial initiatives.
   - General discussions about technology, achievements, or learning experiences.

### Special Instructions:
- Posts mentioning "starting a project" without offering roles or paid opportunities should be classified as "other."
- Posts celebrating personal or team milestones should also be classified as "other."
- Avoid classifying any post as "job_posting" or "contract_project" unless there is a clear invitation for hiring or paid engagement.


### Example:
**Input:**

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


**Output:**

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


### Task:
Please classify the following posts:  
${JSON.stringify(chunks)}
        `,
          },
        ],
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: txtAnalysisResponseFormat,
      });

      chunks = [];

      if (res.choices.length) {
        for (const { key, post_type } of res.choices[0].message.parsed.result) {
          if (["job_posting", "contract_project"].indexOf(post_type) > -1) {
            console.log(data[key].time);
            console.log(data[key].profile_link);
            console.log(data[key].text);
            console.log("\n\n\n");
          }
        }
      }
    }
  }
}

main();
