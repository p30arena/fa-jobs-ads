(async () => {
  const count_articles = () => document.querySelectorAll("article").length;
  const progressbar = () => document.querySelector('div[role="progressbar"]');
  const searchContainer = () =>
    document.querySelector('div[aria-label="Timeline: Search timeline"]');
  const retry_btn = () =>
    document.querySelector(
      'div[aria-label="Timeline: Search timeline"] > div > div:last-child button[role="button"]:not([aria-label])'
    );

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

  async function progressWaiter() {
    const MAX_WAIT_PROGRESS = 15;
    let n_wait_progress = 0;

    while (progressbar() && n_wait_progress++ < MAX_WAIT_PROGRESS) {
      await delay(1000);
    }

    if (progressbar()) {
      return true;
    }

    await delay(1000);

    if (retry_btn()) {
      bilbil_log("retry_btn");
      return true;
    }
  }

  async function search(terms, MAX_DEPTH = 10) {
    let selected_term;
    let terms_head_idx = localStorage.getItem("bilbil_search_items_head_idx");

    if (terms_head_idx) {
      terms_head_idx = Number(terms_head_idx);
    } else {
      terms_head_idx = 0;
      localStorage.setItem("bilbil_search_items_head_idx", 0);
    }

    if (terms_head_idx < terms.length) {
      selected_term = terms[terms_head_idx];
    } else {
      return false;
    }

    const href = `https://x.com/search?f=live&q=${encodeURIComponent(
      selected_term
    ).replaceAll(
      "%20",
      "+"
    )}+lang%3Afa+-filter%3Alinks+-filter%3Areplies&src=typed_query`;

    if (document.location.href !== href) {
      document.location.href = href;
      return true;
    }

    localStorage.setItem("bilbil_search_items_head_idx", terms_head_idx + 1);

    await delay(1000);

    let page = 1;
    let agg = [];

    let scrollTop = 0;
    while (page++ < MAX_DEPTH) {
      if (await progressWaiter()) {
        break;
      }

      const data = extract();
      if (!data.length) {
        bilbil_log("!data.length");
        break;
      }

      if (scrollTop == document.body.scrollHeight) {
        bilbil_log("scrollTop");
        break;
      }

      agg = [...agg, ...data];

      window.scrollTo(0, document.body.scrollHeight);
      scrollTop = document.body.scrollHeight;
      await delay(1000);

      if (await progressWaiter()) {
        break;
      }
    }

    bilbil_log("length: ", agg.length);

    let prev = localStorage.getItem("bilbil_data");
    if (prev) {
      prev = JSON.parse(prev);
      agg = [...prev, ...agg];
    }

    const linksUniq = new Map();
    for (const item of agg) {
      if (!linksUniq.has(item.links.post)) {
        linksUniq.set(item.links.post, item);
      }
    }

    agg = [...linksUniq.values()];

    agg.sort((a, b) => a.time - b.time);

    localStorage.setItem("bilbil_data", JSON.stringify(agg));

    // bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));

    return true;
  }

  async function search_loop() {
    let tmp_run_delay;
    const RUN_DELAY =
      ((tmp_run_delay = localStorage.getItem("bilbil_run_delay")),
      tmp_run_delay ? Number(tmp_run_delay) : null) ?? 300_000;

    bilbil_log("run_delay: ", RUN_DELAY);

    let terms = localStorage.getItem("bilbil_search_items");
    if (!terms) {
      return bilbil_error("you have to specify bilbil_search_items");
    }

    terms = JSON.parse(terms);

    if (!terms.length) {
      return bilbil_error("you have to specify bilbil_search_items");
    }

    try {
      let lastRunLessThanDay = false;
      let terms_head_idx = localStorage.getItem("bilbil_search_items_head_idx");

      if (terms_head_idx) {
        terms_head_idx = Number(terms_head_idx);
      }

      if (typeof terms_head_idx !== "number") {
        // not in loop (init or end)

        document.body.setAttribute("bilbil_loop_running", "true");

        updateAlert();

        let lastRun = localStorage.getItem("bilbil_last_run");
        if (lastRun) {
          lastRun = new Date(lastRun);
          const diff = Date.now() - lastRun.getTime();

          lastRunLessThanDay = diff < timeUnits["day"];

          if (RUN_DELAY > diff) {
            await delay(RUN_DELAY - diff);
          }
        }
      }

      await delay(1000);

      await bilbil_bringToFront();

      while (await search(terms, lastRunLessThanDay ? 3 : 10)) {
        await delay(1000);
      }

      await delay(1000);

      localStorage.removeItem("bilbil_search_items_head_idx");

      localStorage.setItem("bilbil_last_run", new Date().toISOString());

      let data = localStorage.getItem("bilbil_data");
      if (data) {
        data = JSON.parse(data);
        bilbil_log("DB Total: ", data.length);
      }

      await delay(RUN_DELAY);

      search_loop();
    } catch (e) {
      document.body.setAttribute("bilbil_loop_running", "false");
      bilbil_error(e);
    }
  }

  function search_loop_helper() {
    if (document.body.getAttribute("bilbil_loop_running") !== "true") {
      search_loop();
    }
  }

  function askReset() {
    if (document.location.href.includes("/search")) {
      return false;
    }

    return (
      localStorage.getItem("bilbil_last_run") ||
      localStorage.getItem("bilbil_search_items_head_idx")
    );
  }

  function resetSearch() {
    localStorage.removeItem("bilbil_last_run");
    localStorage.removeItem("bilbil_search_items_head_idx");
  }

  const getLogo = () => document.querySelector('a[aria-label="X"]');

  while (!getLogo()) {
    await delay(1000);
  }

  if (searchContainer()) {
    while (progressbar()) {
      await delay(1000);
    }
  }

  // if (askReset()) {
  //   const doReset = confirm("Do you want to reset the search?");
  //   if (doReset) {
  //     resetSearch();
  //   }
  // }

  bilbil_prefix_log("X");

  let statusElement = document.createElement("div");
  window.statusElement = statusElement;
  document.body.appendChild(statusElement);
  statusElement.style =
    "width: 500px; height: 500px; position: absolute; top: 0; left: 0; z-index: 999; color: black; background-color: #ffffffee; overflow: scroll;";

  search_loop_helper();
})();
