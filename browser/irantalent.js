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
    [...document.querySelectorAll("new-position-card > a > div > div > p")].map(
      (it) => it.textContent.trim()
    ),
    [
      ...document.querySelectorAll(
        "new-position-card > a > div > div > p + div > div:last-child > div > p"
      ),
    ].map((it) => it.textContent.trim()),
    [
      ...document.querySelectorAll(
        "new-position-card > a > div > div > p + div > div:last-child > div > p + div"
      ),
    ].map(
      (it) => (
        ([$_location, $_type, $_time] = it.textContent
          .trim()
          .split(/[\s]{2,}/g)),
        { location: $_location, type: $_type, time: $_time }
      )
    ),
    [
      ...document.querySelectorAll(
        "new-position-card > a > div > div > p + div > div:last-child > div > div:last-child span"
      ),
    ].map((it) => it.textContent.trim()),
  ]
).map((it) => ({
  title: it[0],
  company: {
    name: it[1],
  },
  info: {
    location: it[2].location,
    price: it[3],
  },
  time: it[2].time,
}));

console.log(extracted.map((it) => JSON.stringify(it)).join("\n"));