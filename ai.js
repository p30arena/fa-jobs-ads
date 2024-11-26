require("dotenv").config();
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const client = new (require("openai").OpenAI)();

const zTxtAnalysisResponse = z.object({
  result: z.array(
    z.object({
      key: z.number(),
      lead: z.boolean(),
    })
  ),
});

const txtAnalysisResponseFormat = zodResponseFormat(
  zTxtAnalysisResponse,
  "TxtAnalysis"
);

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
    .map((it, i) => ({ ...JSON.parse(it), key: i }));

  let chunks = [];
  let cnt = 0;
  let i = 0;

  for (const item of data) {
    chunks.push({ key: item.key, text: item.text });
    cnt += item.text.length;
    i++;

    if (cnt > MAX_TOKENS / 2 || i == data.length - 1) {
      const res = await client.beta.chat.completions.parse({
        messages: [
          {
            role: "system",
            content: `
We are a Software Development Company, You are a helpful Project Analyzer.
You must indentify leads so we can send them a quote.

You are provided with posts from LinkedIn, post content is in the "text" field.

Think Step by Step.

Determine the intent of each post.
For each post, if the post is recruiting people or is proposing a project that is explicitly seeking for contractors, set "lead" to true.
For each post, if the post is asking for donations, registration or payment, set "lead" to false.

result must only include the posts that are labeled as "lead".
        `,
          },
          { role: "user", content: JSON.stringify(chunks) },
        ],
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: txtAnalysisResponseFormat,
      });

      chunks = [];

      if (res.choices.length) {
        for (const { key, lead } of res.choices[0].message.parsed.result) {
          if (lead) {
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
