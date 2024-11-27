// https://x.com/search?f=live&q=%D8%AC%D9%88%D8%B4%20%D8%B5%D9%88%D8%B1%D8%AA%20lang%3Afa%20-filter%3Alinks%20-filter%3Areplies&src=typed_query

const count_articles = () => document.querySelectorAll("article").length;
const progressbar = () => document.querySelector('div[role="progressbar"]');
const retry_btn = () =>
  document.querySelector(
    'div[aria-label="Timeline: Search timeline"] > div > div:last-child button[role="button"]'
  );

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const extract = () => {
  return [
    ...document.querySelectorAll(
      "article > div > div > div:last-child > div:last-child"
    ),
  ]
    .map((it) => ({
      links: [...it.children[0].querySelectorAll("a")].map((it) => it.href),
      text: it.children[1].textContent,
      time: it.querySelector("time")?.getAttribute("datetime"),
    }))
    .filter((it) => it.links.length === 3 && it.time)
    .map((it) => ({
      ...it,
      time: new Date(it.time),
      links: {
        profile: it.links[0],
        post: it.links[2],
      },
    }));
};

(async function () {
  const MAX_DEPTH = 10;
  let page = 1;
  let agg = [];

  while (page++ < MAX_DEPTH) {
    const data = extract();
    if (!data.length) {
      break;
    }

    if (
      agg.length &&
      data[data.length - 1].links.post === agg[agg.length - 1].links.post
    ) {
      break;
    }

    agg = [...agg, ...data];

    window.scrollTo(0, document.body.scrollHeight);
    await delay(1000);

    while (progressbar()) {
      await delay(1000);
    }

    if (retry_btn()) {
      break;
    }
  }

  const linksUniq = new Map();
  for (const item of agg) {
    if (!linksUniq.has(item.links.post)) {
      linksUniq.set(item.links.post, item);
    }
  }

  agg = [...linksUniq.values()];

  agg.sort((a, b) => a.time - b.time);

  console.log(agg.map((it) => JSON.stringify(it)).join("\n"));
})();
