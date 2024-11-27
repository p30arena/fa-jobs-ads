// https://x.com/search?f=live&q=%D8%AC%D9%88%D8%B4%20%D8%B5%D9%88%D8%B1%D8%AA%20lang%3Afa%20-filter%3Alinks%20-filter%3Areplies&src=typed_query

const count_articles = () => document.querySelectorAll("article").length;
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
    agg = [...agg, ...extract()];
    const beforeCnt = count_articles();
    window.scrollTo(0, document.body.scrollHeight);

    const MAX_PROBES = 10;
    let cntProbe = 0;
    while (count_articles() < beforeCnt && cntProbe++ < MAX_PROBES) {
      await delay(1000);
    }
  }

  agg.sort((a, b) => a.time - b.time);
})();
