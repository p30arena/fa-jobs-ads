// https://www.google.com/search?q=%D9%81%D8%B1%D9%88%D8%B4%DA%AF%D8%A7%D9%87&sca_esv=604417a22f933246&rlz=1C5CHFA_enIR1094DE1094&sxsrf=ADLYWILeHezDU3e9eyHp_GLmx08uYbeE_w:1732800353135&ei=YW9IZ_T0B_mPwPAPhoKNUA&start=0&sa=N&sstk=ATObxK7dRK8INIWMr-yflLa8_qRZGnHf3hiivp3Ob-nfg5TR6GBap49zSV06F5NBQcCWlQcwXSlE3bzjRpB9kcJ4NMzbPs4PBK5R9Hqf1Ao7X-Lz5k72KKkMDQBU4VEal_R0GvKT4BWC52GXFJVWeSRXedta7qU8O1c&ved=2ahUKEwi0qY-skP-JAxX5BxAIHQZBAwo4FBDy0wN6BAgMEAQ&biw=1158&bih=829&dpr=2

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const extract = (document) =>
  [...document.querySelectorAll("div > span > a[data-ved]")].map((it) => ({
    link: it.href,
    title: it.querySelector("h3").textContent,
    site: {
      title: it.querySelector("h3 + div > div span > span")?.textContent,
      link: it.querySelector("h3 + div > div cite").textContent,
    },
  }));

const listPages = () =>
  [
    ...document
      .querySelector('table[role="presentation"]')
      .querySelectorAll("td > a:not(#pnnext)"),
  ].map((it) => it.href);

(async function () {
  let ifr = document.createElement("iframe");
  document.body.appendChild(ifr);

  ifr.width = "1400px";
  ifr.height = "700px";

  ifr.style =
    "visibility: hidden; position: absolute; top: 0; left: 0; z-index: -1;";

  const queryPages = listPages();
  let agg = extract(document);

  for (const page of queryPages) {
    try {
      const p = new Promise(async (promiseSuccess, promiseFailure) => {
        ifr.onload = async () => {
          if (!ifr.contentDocument) {
            console.log("false load");
            return; // false load event
          }

          console.log(ifr.contentDocument.readyState);

          try {
            promiseSuccess(extract(ifr.contentDocument));
          } catch (e) {
            promiseFailure(e);
          }
        };

        ifr.onerror = (ev) => {
          promiseFailure(ev);
        };

        ifr.src = page;

        await delay(120_000);

        if (!promiseFinalized) {
          promiseFailure(new Error("timeout"));
        }
      });

      const data = await p;
      agg = [...agg, ...data];
      console.log("result length: ", data.length);
    } catch (e) {
      console.error(e);
    } finally {
      promiseFinalized = true;
    }
  }

  console.log(agg.map((it) => JSON.stringify(it)).join("\n"));
})();
