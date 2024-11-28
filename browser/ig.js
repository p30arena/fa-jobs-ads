// https://www.instagram.com/explore/search/keyword/?q=%23%D9%BE%D8%B1%D9%88%D8%AA%D8%A6%DB%8C%D9%86_%D8%AA%D8%B1%D8%A7%D9%BE%DB%8C

const listItems = () =>
  [...document.querySelectorAll('a[role="link"]')]
    .map((it) => it.href)
    .filter((it) => it.indexOf("/p/") > -1);

const progressbar = () =>
  document.querySelector(
    'div[data-visualcompletion="loading-state"][role="progressbar"]'
  );

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const extract = async (items) => {
  const results = [];

  let item_number = 0;
  for (const a of items) {
    item_number++;
    console.log(item_number + "/" + items.length);

    try {
      let res = await fetch(
        `https://www.instagram.com/api/v1/oembed/?hidecaption=0&maxwidth=540&url=${encodeURI(
          a
        )}`,
        {
          headers: {
            accept: "*/*",
          },
          referrer: "https://www.instagram.com/",
          referrerPolicy: "strict-origin-when-cross-origin",
          body: null,
          method: "GET",
          mode: "cors",
          credentials: "include",
        }
      );

      if (res.status == 200) {
        res = await res.json();

        console.log(res);
        results.push(res);
      } else {
        if (res.status == 429) {
          console.log("delay: 429");
          await delay(10_000);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      await delay(1000);
    }
  }

  return results;
};

(async function () {
  const MAX_DEPTH = 10;
  let page = 1;
  let agg = [];

  let scrollTop = 0;
  while (page++ < MAX_DEPTH) {
    agg = [...agg, ...listItems()];

    if (scrollTop == document.body.scrollHeight) {
      console.log("scrollTop");
      break;
    }

    const beg_items_count = listItems().length;
    window.scrollTo(0, document.body.scrollHeight);
    scrollTop = document.body.scrollHeight;
    await delay(1000);

    const MAX_TRIES = 10;
    let cnt_tries = 0;
    while (listItems().length == beg_items_count && cnt_tries++ < MAX_TRIES) {
      await delay(1000);
    }

    if (listItems().length == beg_items_count) {
      break;
    }
  }

  const linksUniq = new Set();
  for (const item of agg) {
    if (!linksUniq.has(item)) {
      linksUniq.add(item);
    }
  }

  agg = Array.from(linksUniq);

  const result = await extract(agg);

  console.log(result.map((it) => JSON.stringify(it)).join("\n"));
})();
