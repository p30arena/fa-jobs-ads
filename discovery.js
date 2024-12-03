const downloadHtml = async (link) => {
  try {
    let res = await fetch(link, {
      method: "GET",
      signal: AbortSignal.timeout(30_000),
    });

    if (Math.trunc(res.status / 100) === 2) {
      return await res.text();
    }
  } catch (e) {
    console.error(e);

    return null;
  }
};

const tools = {
  hasGoftino: (html) => html.indexOf("data-goftinoplugin") > -1,
  findInstagram: (html) =>
    html.matchAll(/(https:\/\/)?(www\.)?(instagram\.com\/[^'"]+)['"]/gm).next()
      .value?.[3],
  findEmails: (html) =>
    Array.from(html.matchAll(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g)).map(
      (match) => match[0].trim()
    ),
  findPhones: (html) =>
    Array.from(
      html.matchAll(
        /(?:\+?(\d{1,3})[-.\s]?|0)?(?:\(?(\d{2,4})\)?[-.\s]?)(\d{3,4}[-.\s]?\d{3,4})/g
      )
    ).map((match) => match[0].trim().replace(/[\-\s]/g, "")),
};

async function discover(filePath) {
  const data = (
    await require("fs/promises").readFile(filePath, {
      encoding: "utf-8",
    })
  )
    .split("\n")
    .filter((it) => it)
    .map((it) => JSON.parse(it));

  let item_idx = 0;
  for (const item of data) {
    console.log(++item_idx + "/" + data.length);

    if (!item.site?.title || !item.site?.link) {
      continue;
    }

    if (item.site.link.indexOf(" ›") > -1) {
      item.site.link = item.site.link.split(" ")[0];
    }

    const html = await downloadHtml(item.site.link);

    if (!html) {
      continue;
    }

    const siteUrl = new URL(item.site.link);
    const topDomain = siteUrl.hostname.split(".").slice(-1)[0];

    const phones = tools
      .findPhones(html)
      .filter((p) => p.length <= 14 && p.length > 2 && p.indexOf(".") == -1);

    item.discovery = {
      goftino: tools.hasGoftino(html),
      instagram: tools.findInstagram(html),
      emails: tools.findEmails(html).filter((e) => e.endsWith(topDomain)),
      mobiles: phones.filter((p) => p.match(/^((\+?|0?)989\d{9}|0?9\d{9})$/)),
      phones: phones.filter((p) => !p.match(/^((\+?|0?)989\d{9}|0?9\d{9})$/)),
    };
  }

  await require("fs/promises").writeFile(
    filePath,
    data.map((it) => JSON.stringify(it)).join("\n"),
    {
      encoding: "utf-8",
    }
  );
}

module.exports = {
  discover,
};
