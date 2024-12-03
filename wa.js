const { Client } = require("whatsapp-web.js");
const fsp = require("fs/promises");

const client = new Client({
  puppeteer: {
    defaultViewport: null,
    headless: false,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    userDataDir: "./user_data_dir",
  },
});

const privateIdOfMobile = (mobile) => mobile + "@c.us";

client.on("qr", (qr) => {
  // Generate and scan this code with your phone
  console.log("QR RECEIVED", qr);
});

client.on("ready", async () => {
  console.log("Client is ready!");

  let items = [];

  for (const f of [
    "./data/2024-11-28/google-shop-skincare.jsonl",
    "./data/2024-11-28/google-shop-hygiene.jsonl",
  ]) {
    for (const line of (
      await fsp.readFile(f, {
        encoding: "utf-8",
      })
    )
      .toString()
      .split("\n")) {
      try {
        items.push(JSON.parse(line));
      } catch (err) {
        console.error(`Error parsing line: ${line}`, err);
      }
    }
  }

  items = items.filter((it) => it.discovery && it.discovery.mobiles?.length);
  items.forEach((it) => {
    it.discovery.mobiles = it.discovery.mobiles
      .map((m) => m.match(/989\d{9}/)?.[0])
      .filter((m) => m);
    it.discovery.mobiles = Array.from(new Set(it.discovery.mobiles));
  });
  items = items.filter((it) => it.discovery.mobiles.length);

  //   console.log(JSON.stringify(items, null, 2));

  const indexesToOmit = [];
  const dontSendTo = [];
  for (const chat of await client.getChats()) {
    if (chat.id.server !== "c.us") {
      continue;
    }

    const foundIndex = items.findIndex(
      (it) => it.discovery.mobiles.indexOf(chat.id.user) > -1
    );

    if (foundIndex != -1) {
      console.log(chat);
      indexesToOmit.push(foundIndex);
      dontSendTo.push(...items[foundIndex].discovery.mobiles);
    }
  }
  items = items.filter((_, i) => indexesToOmit.indexOf(i) == -1);

  if (!items.length) {
    console.warn(`items empty.`);
    return;
  }

  items = [
    {
      discovery: {
        goftino: false,
        mobiles: ["989387438407"],
      },
    },
    {
      discovery: {
        goftino: true,
        mobiles: ["989387438407"],
      },
    },
    ...items,
  ];

  const mobilesTouched = new Set();

  for (const it of items) {
    const hasGoftino = it.discovery.goftino;
    const message_1 = `
سلام، حال شما چطوره؟ من علی اشتهاری پور هستم، موسس شرکت دوناسافت.

می‌خواستم یه فرصت طلایی رو باهاتون به اشتراک بذارم! شما می‌تونید پیشرفته‌ترین هوش مصنوعی دنیا رو روی وبسایتتون فعال کنید!

پشتیبان هوشمند ما، *تیکوچت*، به قدرتمندترین مدل هوشمند دنیا یعنی *GPT-4o* متصل هست و مکالماتی کاملاً طبیعی و انسانی رو ارائه میده. بهترین قسمت؟ این هوش مصنوعی همیشه بیداره و می‌تونه ۲۴ ساعته مشتریانتون رو راهنمایی کنه!

${
  hasGoftino
    ? `
راستی، متوجه شدم که روی وبسایتتون از *گفتینو* استفاده می‌کنید، درسته؟ یک پیشنهاد ویژه مخصوص شما آماده کردم!
`
    : ""
}

زیاد پیش میاد که مشتری نیمه‌شب به سایت سر می‌زنه، سوال یا قصد خرید داره اما چون کسی نیست، از خرید منصرف میشه.
ما بارها با چنین مشتریانی تماس گرفتیم و متوجه شدیم که فقط نیاز به کمی راهنمایی داشتند تا مطمئن بشن محصول مناسبشون رو انتخاب کردن!
_
`;
    const message_2 = `
*تیکوچت* این مشکل رو برای شما حل می‌کنه:  
یک چت‌بات و مشاور همیشه در دسترس روی وبسایتتون که به مشتری‌ها کمک می‌کنه تصمیم‌گیری کنند و خریدشون رو تکمیل کنند.

${
  hasGoftino
    ? `
حالا که شما از گفتینو استفاده می‌کنید، می‌تونید گفتینو رو هوشمند کنید:
اولا به کمک چت‌بات، نیازی به پشتیبان انسانی نخواهید داشت.
دوما اگر هم به هوش مصنوعی اعتماد ندارید، به جای چت‌بات، یک ابزار قدرتمند و هوشمند به روی پنل گفتینو بهتون می‌دیم که به پشتیبان شما کمک می‌کنه سریع‌تر و بهتر به مشتریان پاسخ بده.
`
    : ""
}

برای شروع، فقط کافیه همین حالا به این پیام پاسخ بدید یا با من تماس بگیرید.  
منتظر شنیدن نظرات شما هستم! 🌟
_
`;
    const message_3 = `
🌟 Links:
- tikochat.com
- donusoft.com
`;

    const send_status = [];
    for (const mb of it.discovery.mobiles) {
      const peerId = privateIdOfMobile(mb);

      let not_in_wa = false;
      let sent = false;
      let error = false;
      let duplicate = false;

      if (mobilesTouched.has(peerId)) {
        duplicate = true;
      } else {
        mobilesTouched.add(peerId);
        try {
          if (await client.isRegisteredUser(peerId)) {
            sent = true;

            await client.sendMessage(peerId, message_1, {
              sendSeen: true,
            });
            await client.sendMessage(peerId, message_2, {
              sendSeen: true,
            });
            await client.sendMessage(peerId, message_3, {
              sendSeen: true,
            });
          } else {
            not_in_wa = true;
          }
        } catch (e) {
          error = true;
          console.error(e);
        }
      }

      send_status.push({
        not_in_wa,
        sent,
        error,
        duplicate,
      });
    }

    it.send_status = send_status;
  }
});

client.on("message", (msg) => {
  if (msg.body == "!ping") {
    msg.reply("pong");
  }
});

client.initialize();
