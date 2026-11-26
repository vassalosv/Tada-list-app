export function nextDate(value, repeat) {
  let d = new Date(value);
  if (repeat === "daily") d.setUTCDate(d.getUTCDate() + 1);
  if (repeat === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  if (repeat === "monthly") {
    let day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    let end = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, end));
  }
  return d.toISOString();
}
