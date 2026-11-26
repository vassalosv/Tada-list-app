package app.tada.tasks;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.CookieManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.*;
import org.json.*;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Deferrable Android background delivery; independent of browser push/VAPID. */
public class NativeAlertsWorker extends Worker {
    private static final Object LOCK = new Object();
    public NativeAlertsWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    @NonNull @Override public Result doWork() {
        synchronized (LOCK) { return poll(); }
    }
    private Result poll() {
        Context context = getApplicationContext();
        SharedPreferences prefs = NativeAlertsPlugin.preferences(context);
        String user = prefs.getString("user", ""), origin = prefs.getString("origin", "");
        if (user.isEmpty()) return Result.success();
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled() ||
            (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)) return Result.success();
        HttpsURLConnection connection = null;
        try {
            String selected = ServerAddress.normalize(context.getSharedPreferences("tada-server", Context.MODE_PRIVATE).getString("origin", ""));
            if (!origin.equals(selected)) return Result.success();
            origin = ServerAddress.normalize(origin);
            String cookie = CookieManager.getInstance().getCookie(origin);
            if (cookie == null || cookie.isEmpty()) return Result.success();
            long after = prefs.getLong("after", 0);
            String afterId = prefs.getString("afterId", "");
            URL url = new URL(origin + "/api/notifications/native?after=" + after + "&afterId=" + java.net.URLEncoder.encode(afterId, "UTF-8"));
            connection = (HttpsURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
            connection.setRequestProperty("Cookie", cookie);
            connection.setRequestProperty("Accept", "application/json");
            int code = connection.getResponseCode();
            if (code == 401) return Result.success();
            if (code != 200) return Result.retry();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[4096]; int n;
                while ((n = input.read(buffer)) != -1) { bytes.write(buffer, 0, n); if (bytes.size() > 300000) return Result.failure(); }
            }
            JSONObject response = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
            if (!user.equals(response.getString("user"))) return Result.failure();
            JSONArray notifications = response.getJSONArray("notifications");
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel("tada-inbox", "TaDa updates", NotificationManager.IMPORTANCE_HIGH));
            JSONArray alarms = new JSONArray(prefs.getString("alarms", "[]"));
            for (int i = 0; i < notifications.length(); i++) {
                synchronized (NativeAlertsPlugin.DELIVERY_LOCK) {
                // Recheck immediately before posting to handle logout during IO.
                if (isStopped() || !user.equals(prefs.getString("user", "")) || !origin.equals(prefs.getString("origin", ""))) return Result.success();
                JSONObject notification = notifications.getJSONObject(i);
                String id = notification.getString("id"), title = notification.getString("title");
                long created = notification.getLong("created");
                boolean scheduled = NativeNotificationPolicy.hasLocalAlarm(notification.optString("task", ""), title, created, alarms);
                if (!scheduled) {
                    Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    PendingIntent tap = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    Notification nativeNotification = new NotificationCompat.Builder(context, "tada-inbox")
                        .setSmallIcon(app.tada.tasks.R.drawable.ic_stat_tada).setContentTitle("TaDa")
                        .setContentText(title).setStyle(new NotificationCompat.BigTextStyle().bigText(title))
                        .setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true)
                        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPriority(NotificationCompat.PRIORITY_HIGH).build();
                    // A stable tag makes a retry replace the same notification.
                    manager.notify("inbox:" + id, 0, nativeNotification);
                }
                prefs.edit().putLong("after", created).putString("afterId", id).commit();
                }
            }
            // Drain a full page promptly instead of waiting another interval.
            return notifications.length() == 100 ? Result.retry() : Result.success();
        } catch (Exception error) {
            // No cookies, URLs, server bodies or task text in native logs.
            return Result.retry();
        } finally { if (connection != null) connection.disconnect(); }
    }
}
