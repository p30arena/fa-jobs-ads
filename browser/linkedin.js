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
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

let promiseSuccess = null;
let promiseFailure = null;

const statusElement = document.createElement("textarea");
const ifr = document.createElement("iframe");
document.body.appendChild(statusElement);
document.body.appendChild(ifr);

function bilbil_log(...args) {
  statusElement.value += args.join("\n") + "\n";
  setTimeout(() => statusElement.scrollTo(0, statusElement.scrollHeight), 0);
}

function bilbil_error(...args) {
  statusElement.value += args.join("\n") + "\n";
  setTimeout(() => statusElement.scrollTo(0, statusElement.scrollHeight), 0);
}

function bilbil_clear() {
  statusElement.value = "";
  setTimeout(() => statusElement.scrollTo(0, 0), 0);
}

statusElement.draggable = true;
ifr.width = "1400px";
ifr.height = "700px";
ifr.onload = async () => {
  const MAX_DEPTH = 10;
  bilbil_log("loaded");

  const moreBtn = () =>
    ifr.contentDocument.querySelector(".scaffold-finite-scroll__load-button");

  let depth = 0;
  while (moreBtn() && depth++ < MAX_DEPTH) {
    bilbil_log("page: ", depth);

    ifr.contentWindow.scrollTo(0, ifr.contentDocument.body.scrollHeight);

    await delay(3000);

    let cnt = 0;
    while (!moreBtn() && cnt++ < 10) {
      await delay(1000);
    }
  }

  const extracted = zip(
    [...ifr.contentDocument.querySelectorAll("div.update-components-text")].map(
      (it) => it.textContent.trim()
    ),
    [
      ...ifr.contentDocument.querySelectorAll(
        "div > div > div.fie-impression-container > div.relative > div.display-flex.update-components-actor--with-control-menu > div > a"
      ),
    ].map((it) => it.href),
    [
      ...ifr.contentDocument.querySelectorAll(
        "div > div > a.update-components-actor__sub-description-link > span > span.visually-hidden"
      ),
    ].map((it) => it.textContent.trim())
  )
    .filter((it) => it[1])
    .map((it) => ({
      text: it[0],
      profile_link:
        ($_idx = it[1].indexOf("?")) > -1 ? it[1].substr(0, $_idx) : it[1],
      time: it[2],
    }));

  promiseSuccess(extracted);
};

ifr.onerror = (ev) => {
  promiseFailure(ev);
};

ifr.style =
  "visibility:hidden;position: absolute; top: 0; left: 0; z-index: -1;";
statusElement.style =
  "width: 500px; height: 500px;position: absolute; top: 0; left: 0; z-index: 999;background-color: #ffffffee;";

(async function () {
  let agg = [];

  for (const search of [
    '"پروژه" هوش مصنوعی "فارسی"',
    '"پروژه" AI',
    '"پروژه" NLP',
  ]) {
    bilbil_log("keyword: ", search);
    let promiseFinalized = false;
    try {
      const p = new Promise(async (s, f) => {
        promiseSuccess = s;
        promiseFailure = f;

        ifr.src = `https://www.linkedin.com/search/results/content/?datePosted="past-month"&keywords=${encodeURIComponent(
          search
        )}&origin=FACETED_SEARCH&sid=~nt&sortBy="date_posted"`;

        await delay(300_000);

        if (!promiseFinalized) {
          f(new Error("timeout"));
        }
      });

      const data = await p;
      agg = [...agg, ...data];
    } catch (e) {
      bilbil_error(e);
    } finally {
      promiseFinalized = true;
    }
  }

  bilbil_clear();
  bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
})();
