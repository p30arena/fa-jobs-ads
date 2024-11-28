const downloadHtml = async (link) => {
  if (link.indexOf(" ›") > -1) {
    link = link.split(" ")[0];
  }

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

    const html = await downloadHtml(item.site.link);

    if (!html) {
      continue;
    }

    item.discovery = {
      goftino: tools.hasGoftino(html),
      instagram: tools.findInstagram(html),
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
