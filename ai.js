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
You are an assistant designed to classify LinkedIn posts based on their content. Your task is to analyze the provided JSON array and classify each post into one of the following categories:

1. **"job_posting"**: Posts that explicitly advertise job openings or hiring opportunities.
2. **"contract_project"**: Posts offering freelance, consulting, or short-term contract work.
3. **"other"**: Posts that do not fit into either of the above categories.

### Input:
You will receive a JSON array of objects. Each object has the following structure:

[
    {
        "key": 0,
        "text": "LinkedIn post text here..."
    },
    {
        "key": 1,
        "text": "Another LinkedIn post text here..."
    }
]


### Output:
Return a JSON object with the following structure:

{
    "result": [
        {
            "key": 0,
            "post_type": "job_posting"
        },
        {
            "key": 1,
            "post_type": "other"
        }
    ]
}


### Instructions:
1. Analyze the "text" field in each object, primary language of "text" is Farsi.
2. Classify the post as one of the following:
   - **"job_posting"**: Indicates hiring, mentions positions, roles, or recruitment terms like "apply," "hiring," or "position available."
   - **"contract_project"**: Indicates project-based work, freelance, or consulting opportunities, using terms like "contract," "freelance," "short-term," or "project-based."
   - **"other"**: Does not relate to job opportunities or contracts.
3. Output a single JSON object containing the classification results.


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
