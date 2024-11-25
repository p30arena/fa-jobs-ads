function zip(...arrays) {
  const maxLength = Math.max(...arrays.map((arr) => arr.length));
  const result = [];

  for (let i = 0; i < maxLength; i++) {
    result.push(arrays.map((arr) => arr[i]));
  }

  return result;
}

const extracted = zip(
  ...[
    [...document.querySelectorAll("job-card")].map((it) =>
      Boolean(it.querySelector("div.urgent-tag"))
    ),
    [...document.querySelectorAll("job-card div.job-card-title")].map(
      (it) => it.textContent
    ),
    [...document.querySelectorAll("job-card div.job-card-title + a")].map(
      (it) => ({ name: it.textContent, link: it.href })
    ),
    [...document.querySelectorAll("job-card div.job-card-title + a + div")].map(
      (it) => {
        const [location, price] = it.textContent.split(" | ");
        return { location, price };
      }
    ),
    [
      ...document.querySelectorAll(
        "job-card div.job-card-title + a + div + div"
      ),
    ].map((it) => it.textContent),
  ]
).map((it) => ({
  urgent: it[0],
  title: it[1],
  company: it[2],
  info: it[3],
  time: it[4],
}));

(async function () {
  for (const it of extracted) {
    if (it.company.website) continue;

    const { website, description } = await fetch(it.company.link)
      .then((res) => res.text())
      .then((r) => {
        const doc = new DOMParser().parseFromString(r, "text/html");
        const websiteElement = doc.querySelector(
          'app-company-details app-company-header a[rel="nofollow"]'
        );

        if (!websiteElement) return { website: null, description: null };

        const website = websiteElement.href;
        const description =
          websiteElement.parentElement.parentElement.querySelector(
            "div:last-child"
          ).textContent;

        return { website, description };
      });
    if (website) {
      it.company.website = website;
      it.company.description = description;
    }
  }

  console.log(extracted.map((it) => JSON.stringify(it)).join("\n"));
})();
