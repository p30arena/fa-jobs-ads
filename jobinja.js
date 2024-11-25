const extracted = [
  ...document.querySelectorAll(
    "#js-jobSeekerSearchResult section > div > ul > li"
  ),
]
  .map((it) => ({
    urgent: it.className.indexOf("c-jobListView__item--premium") > -1,
    title: it.querySelector("h2.o-listView__itemTitle > a").textContent.trim(),
    link: it.querySelector("h2.o-listView__itemTitle > a").href,
    time: it
      .querySelector("h2.o-listView__itemTitle > span")
      .textContent.trim(),
    raw_info:
      (([$_name, $_location, $_ad_info] = [
        ...it.querySelectorAll("h2.o-listView__itemTitle + ul > li"),
      ].map((it) => it.textContent.trim())),
      { name: $_name, location: $_location, ad_info: $_ad_info }),
  }))
  .map((it) => {
    const [_, type, price] = it.raw_info.ad_info
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x);

    it.info = {
      location: it.raw_info.location,
      price,
      type,
    };

    it.company = {
      name: it.raw_info.name,
      link: it.link,
      website: "",
      description: "",
    };

    delete it.raw_info;
    delete it.link;

    return it;
  });

(async function () {
  let should_break = false;
  for (const it of extracted) {
    if (should_break) break;
    if (it.company.website) continue;

    const { website, description } = await fetch(it.company.link)
      .then((res) => res.text())
      .then((r) => {
        const doc = new DOMParser().parseFromString(r, "text/html");

        if (doc.querySelector("h1.error-section__title"))
          return (should_break = true);

        const metaElement = doc.querySelector(".c-companyHeader__meta > a");

        if (!metaElement) return { website: null, description: null };

        const [descElement, websiteElement] = metaElement;

        const website = websiteElement.href;
        const description = descElement.textContent;

        return { website, description };
      });
    if (website) {
      it.company.website = website;
      it.company.description = description;
    }
  }

  console.log(extracted.map((it) => JSON.stringify(it)).join("\n"));
})();
