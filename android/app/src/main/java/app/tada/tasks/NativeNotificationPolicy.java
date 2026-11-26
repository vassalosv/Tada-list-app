package app.tada.tasks;

import org.json.*;

final class NativeNotificationPolicy {
    static boolean matches(String task, String title, long created, String alarmTask, long at) {
        return !task.isEmpty() && task.equals(alarmTask) &&
            (title.startsWith("Reminder:") || title.startsWith("Coming up:")) && Math.abs(created - at) <= 60000;
    }
    static boolean hasLocalAlarm(String task, String title, long created, JSONArray alarms) throws JSONException {
        if (task.isEmpty() || !(title.startsWith("Reminder:") || title.startsWith("Coming up:"))) return false;
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.getJSONObject(i);
            if (matches(task, title, created, alarm.optString("taskId"), alarm.optLong("at"))) return true;
        }
        return false;
    }
}
