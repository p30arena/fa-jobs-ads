// https://www.google.com/maps/search/%DA%A9%D8%A7%D8%B1%D8%AE%D8%A7%D9%86%D9%87%E2%80%AD/@32.6542472,51.6972589,11z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI0MTEyNC4xIKXMDSoASAFQAw%3D%3D

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const getContainer = () => document.querySelector('div[role="feed"]');
const progressbar = () =>
  [...getContainer().querySelectorAll("div")].filter(
    (it) => window.getComputedStyle(it).backgroundImage.indexOf("spinner") > -1
  )[0];

const extract = () =>
  [...getContainer().querySelectorAll('div > div > a:not([aria-lebel=""])')]
    .filter((it) => it.href.indexOf("/maps/place") > -1)
    .map((it) => ({
      link: it.href,
      info: it.parentElement?.children?.[2],
    }))
    .filter((it) => it.info)
    .map((it) => ({
      ...it,
      info: {
        raw: it.info
          .querySelector("div.fontHeadlineSmall")
          ?.parentElement?.parentElement?.textContent?.trim(),
      },
    }))
    .filter((it) => it.info.raw)
    .map((it) => ({
      ...it,
      info: {
        ...it.info,
        mobile:
          ($_cc = it.info.raw.search(/\+\d{1,3}(?!.*\+\d{1,3})/)) > -1
            ? it.info.raw.substring($_cc).match(/\+\d{1,3}(\s?\d+)+/)?.[0]
            : null,
      },
    }));

(async function () {
  const MAX_DEPTH = 50;
  let page = 1;
  let agg = [];

  let scrollTop = 0;
  while (page++ < MAX_DEPTH) {
    agg = [...agg, ...extract()];

    if (scrollTop == getContainer().scrollHeight) {
      console.log("scrollTop");
      break;
    }

    const beg_items_count = extract().length;
    getContainer().scrollTo(0, getContainer().scrollHeight * 10 * page);
    scrollTop = getContainer().scrollHeight;
    await delay(1000);

    const MAX_TRIES = 10;
    let cnt_tries = 0;
    while (extract().length == beg_items_count && cnt_tries++ < MAX_TRIES) {
      await delay(1000);
    }

    if (extract().length == beg_items_count) {
      break;
    }
  }

  const linksUniq = new Map();
  for (const item of agg) {
    if (!linksUniq.has(item.link)) {
      linksUniq.set(item.link, item);
    }
  }

  agg = [...linksUniq.values()];

  console.log(agg.map((it) => JSON.stringify(it)).join("\n"));
})();
