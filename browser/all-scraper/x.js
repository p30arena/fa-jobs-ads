(async () => {
  async function search(params) {}

  async function search_loop() {
    let terms = localStorage.getItem("bilbil_search_items");
    if (!terms) {
      return bilbil_error("you have to specify bilbil_search_items");
    }

    terms = JSON.parse(terms);

    try {
      let tmp_run_delay;
      const RUN_DELAY =
        ((tmp_run_delay = localStorage.getItem("bilbil_run_delay")),
        tmp_run_delay ? Number(tmp_run_delay) : null) ?? 300_000;

      bilbil_log("run_delay: ", RUN_DELAY);

      document.body.setAttribute("bilbil_loop_running", "true");

      updateAlert();

      let lastRunLessThanDay = false;
      let lastRun = localStorage.getItem("bilbil_last_run");
      if (lastRun) {
        lastRun = new Date(lastRun);
        const diff = Date.now() - lastRun.getTime();

        lastRunLessThanDay = diff < timeUnits["day"];

        if (RUN_DELAY > diff) {
          await delay(RUN_DELAY - diff);
        }
      }

      await search(terms, lastRunLessThanDay ? 3 : 10);

      localStorage.setItem("bilbil_last_run", new Date().toISOString());

      await delay(RUN_DELAY);

      search_loop();
    } catch (e) {
      document.body.setAttribute("bilbil_loop_running", "false");
      bilbil_error(e);
    }
  }

  function search_loop_helper() {
    if (document.body.getAttribute("bilbil_keepAlive_running") !== "true") {
      keepAlive();
    }

    if (document.body.getAttribute("bilbil_loop_running") !== "true") {
      search_loop();
    }
  }

  const getLogo = () => document.querySelector('a[aria-label="X"]');

  while (!getLogo()) {
    await delay(1000);
  }

  const shouldIScrape = confirm("Should I Begin Scraping?");
  if (shouldIScrape) {
    let statusElement = document.createElement("div");
    window.statusElement = statusElement;
    document.body.appendChild(statusElement);
    statusElement.style =
      "width: 500px; height: 500px; position: absolute; top: 0; left: 0; z-index: 999; color: black; background-color: #ffffffee; overflow: scroll;";

    search_loop_helper();
  }
})();
