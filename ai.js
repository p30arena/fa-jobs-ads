require("dotenv").config();
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const client = new (require("openai").OpenAI)();

const zTxtAnalysisResponse = z.object({
  result: z.array(
    z.object({
      key: z.number(),
      send_quote: z.boolean(),
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
We are a Software Development Company, You are a helpful Content Analyzer.
You must indentify projects so we can send them a quote.

Post content is in the "text" field.
For each post:
 - extend the post with the key "send_quote".
 - set "send_quote" to true if the post is recruiting people or is proposing a project that is explicitly seeking for contractors,
   and the post is not asking for donations or payments or registration for receiving services.

result must only include the posts that their "send_quote" is true.

Process the following array of LinkedIn post items:
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
        for (const { key, send_quote } of res.choices[0].message.parsed.result) {
          if (send_quote) {
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
