package app.tada.tasks;

import android.app.*;
import android.content.*;
import android.os.Build;
import android.webkit.CookieManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.*;
import org.json.*;
import java.io.*;
import java.net.URL;
import java.util.concurrent.*;
import javax.net.ssl.HttpsURLConnection;

/** Task alarms recheck server-side assignment/access before showing any text. */
public class TaskAlarms extends BroadcastReceiver {
    static final ExecutorService IO=Executors.newSingleThreadExecutor();
    static SharedPreferences store(Context c){return c.getSharedPreferences("tada-task-alarms",Context.MODE_PRIVATE);}
    static PendingIntent intent(Context c,int id){return PendingIntent.getBroadcast(c,id,new Intent(c,TaskAlarms.class).putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static void schedule(Context c,JSONObject n) throws Exception {
        int id=n.getInt("id"); long at=n.getJSONObject("schedule").getLong("at");
        store(c).edit().putString(String.valueOf(id),n.toString()).commit();
        AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(Build.VERSION.SDK_INT<31 || manager.canScheduleExactAlarms()) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(c,id));
        else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(c,id));
    }
    static void cancel(Context c,int id){((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(intent(c,id));store(c).edit().remove(String.valueOf(id)).commit();}
    static void clear(Context c){for(String id:store(c).getAll().keySet())try{cancel(c,Integer.parseInt(id));}catch(Exception ignored){}WorkManager.getInstance(c).cancelAllWorkByTag("tada-task-alarm");}
    static JSONArray pending(Context c) throws Exception {JSONArray result=new JSONArray();for(Object value:store(c).getAll().values())result.put(new JSONObject(String.valueOf(value)));return result;}
    static void retry(Context context,int id){WorkManager.getInstance(context).enqueueUniqueWork("tada-alarm-"+id,ExistingWorkPolicy.KEEP,new OneTimeWorkRequest.Builder(TaskAlarmRetry.class).setInputData(new Data.Builder().putInt("id",id).build()).addTag("tada-task-alarm").setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());}
    @Override public void onReceive(Context context,Intent event){
        if(!event.hasExtra("id")) {IO.execute(()->{try{JSONArray alarms=pending(context);for(int i=0;i<alarms.length();i++){JSONObject n=alarms.getJSONObject(i);if(n.getJSONObject("schedule").getLong("at")>System.currentTimeMillis())schedule(context,n);else if(!deliver(context,n.getInt("id")))retry(context,n.getInt("id"));}}catch(Exception ignored){}});return;}
        int id=event.getIntExtra("id",-1);PendingResult result=goAsync();
        IO.execute(()->{try{if(!deliver(context,id))retry(context,id);}finally{result.finish();}});
    }
    static JSONObject request(Context c,String origin,String path) throws Exception {
        origin=ServerAddress.normalize(origin);
        String cookie=CookieManager.getInstance().getCookie(origin);
        if(cookie==null)throw new SecurityException();
        HttpsURLConnection connection=(HttpsURLConnection)new URL(origin+path).openConnection();
        try {connection.setConnectTimeout(7000);connection.setReadTimeout(7000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Cookie",cookie);connection.setRequestProperty("Accept","application/json");
            int status=connection.getResponseCode();if(status==401||status==403||status==404)throw new SecurityException();if(status!=200)throw new IOException();
            ByteArrayOutputStream data=new ByteArrayOutputStream();try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[2048];int count;while((count=input.read(buffer))!=-1){data.write(buffer,0,count);if(data.size()>100000)throw new IOException();}}
            return new JSONObject(data.toString("UTF-8"));
        } finally {connection.disconnect();}
    }
    static boolean deliver(Context c,int id) {
        String raw=store(c).getString(String.valueOf(id),null);if(raw==null)return true;
        try{
            JSONObject n=new JSONObject(raw),extra=n.getJSONObject("extra");
            String origin=extra.getString("origin"),user=extra.getString("user");
            SharedPreferences session=NativeAlertsPlugin.preferences(c);
            if(System.currentTimeMillis()-n.getJSONObject("schedule").getLong("at")>3600000 || !user.equals(session.getString("user","")) || !origin.equals(session.getString("origin",""))) {cancel(c,id);return true;}
            JSONObject eligibility=request(c,origin,"/api/notifications/eligible/"+java.net.URLEncoder.encode(extra.getString("taskId"),"UTF-8")+"?event="+java.net.URLEncoder.encode(extra.getString("eventKey"),"UTF-8"));
            synchronized(NativeAlertsPlugin.DELIVERY_LOCK){
                if(!eligibility.optBoolean("eligible") || !user.equals(eligibility.optString("user")) || !user.equals(session.getString("user","")) || !origin.equals(session.getString("origin","")) || !store(c).contains(String.valueOf(id))) {cancel(c,id);return true;}
                if(!NotificationManagerCompat.from(c).areNotificationsEnabled()){cancel(c,id);return true;}
                NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
                if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("tada-reminders","Task reminders",NotificationManager.IMPORTANCE_HIGH));
                PendingIntent tap=PendingIntent.getActivity(c,id,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                manager.notify("task:"+id,id,new NotificationCompat.Builder(c,"tada-reminders").setSmallIcon(R.drawable.ic_stat_tada).setContentTitle(n.optString("title","TaDa reminder")).setContentText(eligibility.getString("title")).setStyle(new NotificationCompat.BigTextStyle().bigText(eligibility.getString("title"))).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPriority(NotificationCompat.PRIORITY_HIGH).build());
                cancel(c,id);return true;
            }
        }catch(SecurityException forbidden){cancel(c,id);return true;}catch(Exception unavailable){return false;}
    }
}
