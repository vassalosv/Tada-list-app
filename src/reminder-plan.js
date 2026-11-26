import { nextDate } from "../shared/dates.js";
export function devicePlan(tasks, now = Date.now(), userId = null) {
  const events = [];
  const horizon = now + 30 * 86400000;
  for (const task of tasks) {
    if (task.done || (task.assignee && task.assignee !== userId)) continue;
    for (const reminder of task.reminders || []) {
      let at = Number(reminder.at);
      if (!Number.isFinite(at)) at = Date.parse(reminder.at);
      if (!Number.isFinite(at)) continue;
      let guard = 0;
      while (at <= now && reminder.repeat !== "none" && guard++ < 10000)
        at = Date.parse(nextDate(at, reminder.repeat));
      if (at <= now) continue;
      for (let i = 0; i < 31; i++) {
        events.push({
          key: `reminder:${reminder.id}:${at}`,
          at,
          title: "TaDa reminder",
          body: task.title,
          taskId: task.id,
        });
        if (reminder.repeat === "none") break;
        at = Date.parse(nextDate(at, reminder.repeat));
        if (at > horizon) break;
      }
    }
    if (task.due) {
      const due = Date.parse(task.due);
      for (const [at, title] of [
        [due - 86400000, "Coming up in TaDa"],
        [due, "Due now in TaDa"],
      ])
        if (at > now)
          events.push({
            key: `due:${task.id}:${at}`,
            at,
            title,
            body: task.title,
            taskId: task.id,
          });
    }
  }
  events.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  const used = new Set();
  return events.slice(0, 256).map((event) => {
    let hash = 2166136261;
    for (const c of event.key)
      hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    let id = ((hash >>> 0) % 2000000000) + 1;
    while (used.has(id)) id = (id % 2000000000) + 1;
    used.add(id);
    return { ...event, id };
  });
}
