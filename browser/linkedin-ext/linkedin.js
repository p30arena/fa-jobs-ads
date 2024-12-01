(() => {
  function prepare_ui() {
    const s = document.createElement("style");
    s.textContent =
      ".bilbil_hidden {visibility: hidden;} .bilbil_alert{background-color: red !important;}";
    document.head.appendChild(s);

    document.body.appendChild(statusElement);
    document.body.appendChild(ifr);

    ifr.width = "1400px";
    ifr.height = "700px";

    // setting "visibility: hidden" caused elements not to render?!
    ifr.style = "position: absolute; top: 0; left: 0; z-index: -1;";
    statusElement.style =
      "width: 500px; height: 500px; position: absolute; top: 0; left: 0; z-index: 999; background-color: #ffffffee; overflow: scroll;";
  }

  async function search(terms, MAX_DEPTH = 10) {
    let agg = [];

    for (const search of terms) {
      bilbil_log("keyword: ", search);
      let promiseFinalized = false;
      try {
        const p = new Promise(async (promiseSuccess, promiseFailure) => {
          ifr.onload = async () => {
            if (!ifr.contentDocument) {
              bilbil_log("false load");
              return; // false load event
            }

            bilbil_log(ifr.contentDocument.readyState);

            const style = ifr.contentDocument.createElement("style");
            style.textContent = "img, video, audio {display: none !important;}";
            ifr.contentDocument.head.appendChild(style);

            try {
              const moreBtn = () =>
                ifr.contentDocument.querySelector(
                  ".scaffold-finite-scroll__load-button"
                );

              try {
                let depth = 0;
                while (moreBtn() && depth++ < MAX_DEPTH) {
                  bilbil_log("page: ", depth);

                  ifr.contentWindow.scrollTo(
                    0,
                    ifr.contentDocument.body.scrollHeight
                  );

                  await delay(3000);

                  let cnt = 0;
                  while (!moreBtn() && cnt++ < 10) {
                    bilbil_log("probing: ", cnt);
                    await delay(1000);
                  }
                }
              } catch (e) {
                bilbil_error(e);
              }

              const extracted = [
                ...ifr.contentDocument.querySelectorAll("div[data-urn]"),
              ]
                .map((it) => ({
                  // urn: Number(
                  //   it.getAttribute("data-urn").replace("urn:li:activity:", "")
                  // ),
                  urn: it.getAttribute("data-urn"),
                  time: parseTimeAgo(
                    it
                      .querySelector(
                        "div > div > a.update-components-actor__sub-description-link > span > span.visually-hidden"
                      )
                      ?.textContent?.trim()
                  ),
                  profile_link:
                    (($_profile =
                      it.querySelector(
                        "div > div > div.fie-impression-container > div.relative > div.display-flex.update-components-actor--with-control-menu > div > a"
                      )?.href ?? ""),
                    ($_idx = $_profile.indexOf("?")) > -1
                      ? $_profile.substr(0, $_idx)
                      : $_profile),
                  text: it
                    .querySelector("div.update-components-text")
                    ?.textContent?.trim(),
                }))
                .filter(
                  (it) => it.profile_link && it.text && it.time && it.urn
                );

              promiseSuccess(extracted);
            } catch (e) {
              promiseFailure(e);
            }
          };

          ifr.onerror = (ev) => {
            promiseFailure(ev);
          };

          ifr.src = `https://www.linkedin.com/search/results/content/?datePosted="past-month"&keywords=${encodeURIComponent(
            search
          )}&origin=FACETED_SEARCH&sid=~nt&sortBy="date_posted"`;

          await delay(120_000);

          if (!promiseFinalized) {
            promiseFailure(new Error("timeout"));
          }
        });

        const data = await p;
        agg = [...agg, ...data];
        bilbil_log("result length: ", data.length);
      } catch (e) {
        bilbil_error(e);
      } finally {
        promiseFinalized = true;
      }
    }

    try {
      bilbil_log("search done");
      bilbil_clear();

      if (agg.length) {
        agg = agg.filter(
          (it) =>
            it["urn"] && Date.now() - it["time"].getTime() < timeUnits["month"]
        );
        agg.sort((a, b) => a.time - b.time);

        if (agg.length) {
          // bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
          bilbil_log("length: ", agg.length);

          const MAX_ENTRIES = 500;

          const prevData = JSON.parse(
            localStorage.getItem("bilbil_data") ?? "[]"
          );

          const uniqUrns = new Map();
          for (let i = 0; i < prevData.length; i++) {
            uniqUrns.set(prevData[i].urn, i);
          }

          let all = prevData.slice(-MAX_ENTRIES);

          for (const item of agg) {
            if (!uniqUrns.has(item.urn)) {
              all.push(item);
              uniqUrns.set(item.urn, all.length - 1);
            } else if (uniqUrns.get(item.urn) < prevData.length) {
              // update text
              all[uniqUrns.get(item.urn)].text = item.text;
            }
          }

          // Ensure we don't exceed MAX_ENTRIES
          if (all.length > MAX_ENTRIES) {
            all = all.slice(-MAX_ENTRIES);
          }

          localStorage.setItem("bilbil_data", JSON.stringify(all));

          await helper_prompt_ai();
        } else {
          bilbil_log("empty 2");
        }
      } else {
        bilbil_log("empty 1");
      }
    } catch (e) {
      bilbil_error(e);
    }
  }

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

  const handleMessageBox = async () => {
    const getMessageFooter = () =>
      document.querySelector(
        "div[data-msg-overlay-conversation-bubble-open] footer"
      );

    const getMessagesContainer = () =>
      document.querySelector(
        "div[data-msg-overlay-conversation-bubble-open] .msg-s-message-list.scrollable"
      );

    const getMessagesProgress = () =>
      document
        .querySelector(
          "div[data-msg-overlay-conversation-bubble-open] li.msg-s-message-list__loader"
        )
        ?.checkVisibility();

    const listMessages = () => {
      const messages = [
        ...document.querySelectorAll(
          "div[data-msg-overlay-conversation-bubble-open] div.msg-s-event-listitem"
        ),
      ].map((msg, i) => ({
        peer: msg.querySelector("a")?.href,
        msg: [...msg.querySelectorAll("p")]
          .map((it) => it.innerText)
          .join("\n"),
      }));

      const nearestPeer = (idx) => {
        for (let i = idx - 1; idx >= 0; idx--) {
          if (messages[i].peer) {
            return messages[i].peer;
          }
        }
      };

      messages.forEach((m, i) => (m.peer = m.peer ?? nearestPeer(i)));

      const users_numbers = messages.reduce((o, item) => {
        if (item.peer && !o[item.peer]) {
          o[item.peer] = Object.keys(o).length + 1;
        }
        return o;
      }, {});

      messages.forEach((m, i) => (m.peer_number = users_numbers[m.peer]));

      return messages;
    };

    const headCircle = () =>
      document.querySelector(
        "div[data-msg-overlay-conversation-bubble-open] .artdeco-entity-lockup__image"
      );

    const dispatchPaste = (
      text,
      target = document.querySelector(".msg-form__contenteditable p")
    ) => {
      const dataTransfer = new DataTransfer();
      // this may be 'text/html' if it's required
      dataTransfer.setData("text/plain", text);

      target.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,

          // need these for the event to reach Draft paste handler
          bubbles: true,
          cancelable: true,
        })
      );

      // clear DataTransfer Data
      dataTransfer.clearData();

      navigator.clipboard
        .writeText(text)
        .then(() => {
          bilbil_log("clipboard set");
        })
        .catch((r) => {
          bilbil_error("clipboard error: ", e);
        });
    };

    const doScroll = confirm("Should I Scroll?");

    if (doScroll) {
      let scrollTop = 0;
      let nScrolls = 0;
      const MAX_SCROLLS = 5;
      while (!headCircle() || nScrolls++ < MAX_SCROLLS) {
        scrollTop -= 1000;
        getMessagesContainer().scrollTo(0, scrollTop);

        await delay(1000);

        const MAX_TRIES = 10;
        let cnt_tries = 0;
        while (getMessagesProgress() && cnt_tries++ < MAX_TRIES) {
          await delay(1000);
        }

        if (getMessagesProgress()) {
          break;
        }
      }
    }

    const conversation = listMessages()
      .map((it) => "### User" + it.peer_number + ":\n" + it.msg + "\n")
      .join("\n\n");

    const guide = prompt("Response Guide");

    const response = await helper_complete_coversation(conversation, guide);

    if (response) {
      dispatchPaste(response);
    }
  };

  const get_container = () =>
    document.querySelector(".global-nav__primary-items");
  const get_toggle_btn = () => document.getElementById("bilbil_toggle");

  const inject = () => {
    let statusElement = document.createElement("div");
    let ifr = document.createElement("iframe");
    let buttonsContainer = document.createElement("ul");

    buttonsContainer.style =
      "position: absolute; top: 0; right: 0; width: 670px; height: 52px; background-color: #fff; display: flex; z-index: 999; list-style: none;";

    document.body.appendChild(buttonsContainer);

    window.statusElement = statusElement;
    window.ifr = ifr;
    window.buttonsContainer = buttonsContainer;

    window.bilbil_toggleOpen_click = (ev) => {
      if (buttonsContainer.style.right === "0px") {
        buttonsContainer.style.right = "-590px";
      } else {
        buttonsContainer.style.right = "0px";
      }
    };
    const toggleOpenBtnElement = document.createElement("li");
    toggleOpenBtnElement.id = "bilbil_toggleOpen";
    toggleOpenBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">|||</a>`;
    buttonsContainer.appendChild(toggleOpenBtnElement);
    toggleOpenBtnElement.addEventListener("click", bilbil_toggleOpen_click);

    window.bilbil_toggle_click = (ev) => {
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      } else {
        statusElement.className = "bilbil_hidden";
      }
    };
    const toggleBtnElement = document.createElement("li");
    toggleBtnElement.id = "bilbil_toggle";
    toggleBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Terminal</a>`;
    buttonsContainer.appendChild(toggleBtnElement);
    toggleBtnElement.addEventListener("click", bilbil_toggle_click);

    window.bilbil_dump_click = (ev) => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      }
    };
    const dumpBtnElement = document.createElement("li");
    dumpBtnElement.id = "bilbil_dump";
    dumpBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Dump</a>`;
    buttonsContainer.appendChild(dumpBtnElement);
    dumpBtnElement.addEventListener("click", bilbil_dump_click);

    window.bilbil_dumpAlert_click = (ev) => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      agg = agg.filter(
        (it) => it.ai?.post_type && it.ai?.post_type !== "other" && !it.resolved
      );
      bilbil_log(agg.map((it) => JSON.stringify(it)).join("\n"));
      if (statusElement.className === "bilbil_hidden") {
        statusElement.className = "";
      }
    };
    const dumpAlertBtnElement = document.createElement("li");
    dumpAlertBtnElement.id = "bilbil_dumpAlert";
    dumpAlertBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">DumpAlert</a>`;
    buttonsContainer.appendChild(dumpAlertBtnElement);
    dumpAlertBtnElement.addEventListener("click", bilbil_dumpAlert_click);

    window.bilbil_resolveAlert_click = (ev) => {
      bilbil_clear();
      let agg = localStorage.getItem("bilbil_data");
      if (!agg) return;
      agg = JSON.parse(agg);
      agg
        .filter(
          (it) =>
            it.ai?.post_type && it.ai?.post_type !== "other" && !it.resolved
        )
        .forEach((it) => (it.resolved = true));
      localStorage.setItem("bilbil_data", JSON.stringify(agg));
      localStorage.setItem("bilbil_cnt_not_other", "0");
      updateAlert();
    };
    const resolveAlertBtnElement = document.createElement("li");
    resolveAlertBtnElement.id = "bilbil_resolveAlert";
    resolveAlertBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">ResolveAlert</a>`;
    buttonsContainer.appendChild(resolveAlertBtnElement);
    resolveAlertBtnElement.addEventListener("click", bilbil_resolveAlert_click);

    window.bilbil_ai_click = (ev) => {
      helper_prompt_ai();
    };
    const aiBtnElement = document.createElement("li");
    aiBtnElement.id = "bilbil_ai";
    aiBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">AI</a>`;
    buttonsContainer.appendChild(aiBtnElement);
    aiBtnElement.addEventListener("click", bilbil_ai_click);

    window.bilbil_empty_click = (ev) => {
      const isConfirmed = confirm("Are you sure you want to proceed?");

      if (isConfirmed) {
        bilbil_clear();
        updateAlert();
        localStorage.removeItem("bilbil_data");
      }
    };
    const emptyBtnElement = document.createElement("li");
    emptyBtnElement.id = "bilbil_empty";
    emptyBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Empty</a>`;
    buttonsContainer.appendChild(emptyBtnElement);
    emptyBtnElement.addEventListener("click", bilbil_empty_click);

    window.bilbil_msgbox_click = handleMessageBox;
    const msgboxBtnElement = document.createElement("li");
    msgboxBtnElement.id = "bilbil_msgbox";
    msgboxBtnElement.innerHTML = `<a class="global-nav__primary-link global-nav__primary-link" target="_self">Message Box</a>`;
    buttonsContainer.appendChild(msgboxBtnElement);
    msgboxBtnElement.addEventListener("click", bilbil_msgbox_click);

    prepare_ui();

    search_loop_helper();
  };

  const observer = new MutationObserver((mutations, mutationInstance) => {
    if (get_container()) {
      mutationInstance.disconnect();

      if (!document.body.hasAttribute("bilbil_obs")) {
        document.body.setAttribute("bilbil_obs", "true");

        const shouldInject = confirm("Inject Script?");
        if (shouldInject) {
          setMainBotChat();
          inject();
        }
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
})();
