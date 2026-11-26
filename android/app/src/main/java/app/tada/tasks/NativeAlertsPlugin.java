package app.tada.tasks;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.CookieManager;
import androidx.work.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;
import java.util.LinkedHashMap;
import org.json.*;

/** Native inbox delivery. Cookies remain in Android's private WebView store. */
@CapacitorPlugin(name = "NativeAlerts")
public class NativeAlertsPlugin extends Plugin {
    @PluginMethod public void getAlarms(PluginCall call){try{JSObject value=new JSObject();value.put("notifications",TaskAlarms.pending(getContext()));call.resolve(value);}catch(Exception error){call.reject("Could not read task alarms");}}
    @PluginMethod public void scheduleAlarms(PluginCall call){try{JSONArray items=call.getArray("notifications",new JSArray());for(int i=0;i<items.length();i++)TaskAlarms.schedule(getContext(),items.getJSONObject(i));call.resolve();}catch(Exception error){call.reject("Could not schedule task alarms");}}
    @PluginMethod public void cancelAlarms(PluginCall call){try{JSONArray items=call.getArray("notifications",new JSArray());for(int i=0;i<items.length();i++)TaskAlarms.cancel(getContext(),items.getJSONObject(i).getInt("id"));call.resolve();}catch(Exception error){call.reject("Could not cancel task alarms");}}
    @PluginMethod public void setAppearance(PluginCall call) {
        getActivity().runOnUiThread(()->{
            ((MainActivity)getActivity()).applyAppearance(call.getBoolean("dark",false),call.getString("background","#f4f8f6"));
            call.resolve();
        });
    }
    @PluginMethod public void setServer(PluginCall call) {
        final String origin;
        try {origin=ServerAddress.normalize(call.getString("origin",""));}
        catch(Exception error){call.reject("Enter a valid HTTPS server address");return;}
        TaskAlarms.IO.execute(()->{
            javax.net.ssl.HttpsURLConnection check=null;
            try {
                check=(javax.net.ssl.HttpsURLConnection)new java.net.URL(origin+"/api/state").openConnection();
                check.setConnectTimeout(8000);check.setReadTimeout(8000);check.setInstanceFollowRedirects(false);check.setRequestProperty("Accept","application/json");
                if(check.getResponseCode()!=401)throw new java.io.IOException();
                java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
                try(java.io.InputStream input=check.getErrorStream()){
                    if(input==null)throw new java.io.IOException();
                    byte[] buffer=new byte[1024];int count;
                    while((count=input.read(buffer))!=-1){bytes.write(buffer,0,count);if(bytes.size()>65536)throw new java.io.IOException();}
                }
                if(!"Please sign in".equals(new JSONObject(bytes.toString("UTF-8")).optString("error")))throw new java.io.IOException();
            } catch(Exception error){call.reject("The server could not be verified. Check its HTTPS address and availability. Your saved server has not changed.");return;}
            finally {if(check!=null)check.disconnect();}
            getActivity().runOnUiThread(()->{
                synchronized(DELIVERY_LOCK){
                    preferences(getContext()).edit().clear().commit();
                    WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
                    WorkManager.getInstance(getContext()).cancelUniqueWork(WORK+"-now");
                    TaskAlarms.clear(getContext());
                    androidx.core.app.NotificationManagerCompat.from(getContext()).cancelAll();
                }
                CookieManager.getInstance().removeAllCookies(removed->{
                    CookieManager.getInstance().flush();
                    getContext().getSharedPreferences("tada-server",Context.MODE_PRIVATE).edit().putString("origin",origin).commit();
                    getActivity().startActivity(new android.content.Intent(getActivity(),MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK));
                });
                call.resolve();
            });
        });
    }
    static final String WORK = "tada-native-inbox";
    static final Object DELIVERY_LOCK = new Object();
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("tada-native-alerts", Context.MODE_PRIVATE);
    }
    @PluginMethod public void configure(PluginCall call) {
        try {
            String origin = ServerAddress.normalize(getContext().getSharedPreferences("tada-server", Context.MODE_PRIVATE).getString("origin", ""));
            String user = call.getString("user", "");
            if (user.isEmpty()) { call.reject("Sign in first"); return; }
            SharedPreferences prefs = preferences(getContext());
            synchronized (DELIVERY_LOCK) {
            SharedPreferences.Editor editor = prefs.edit();
            boolean sameIdentity = user.equals(prefs.getString("user", "")) && origin.equals(prefs.getString("origin", ""));
            if (!sameIdentity) {
                WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
                androidx.core.app.NotificationManagerCompat.from(getContext()).cancelAll();
                editor.clear().putLong("after", call.getLong("after", 0L)).putString("afterId", call.getString("afterId", ""));
            }
            // Keep recently fired local alarms so server inbox polling does not
            // alert a second time after the one-off reminder is consumed.
            JSONArray current = call.getArray("alarms", new JSArray());
            LinkedHashMap<String, JSONObject> slots = new LinkedHashMap<>();
            for (int i = 0; i < current.length(); i++) {
                JSONObject alarm = current.getJSONObject(i);
                slots.put(alarm.optString("taskId") + ":" + alarm.optLong("at"), alarm);
            }
            if (sameIdentity) {
                JSONArray previous = new JSONArray(prefs.getString("alarms", "[]"));
                for (int i = 0; i < previous.length() && slots.size() < 1024; i++) {
                    JSONObject alarm = previous.getJSONObject(i);
                    long at = alarm.optLong("at");
                    if (at <= System.currentTimeMillis() && at > System.currentTimeMillis() - 3600000)
                        slots.put(alarm.optString("taskId") + ":" + at, alarm);
                }
            }
            JSONArray alarms = new JSONArray(slots.values());
            editor.putString("origin", origin).putString("user", user)
                .putString("alarms", alarms.toString()).commit();
            }
            CookieManager.getInstance().flush();
            Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
            PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(NativeAlertsWorker.class, 15, TimeUnit.MINUTES).setConstraints(constraints).build();
            WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, work);
            call.resolve();
        } catch (Exception error) { call.reject("Could not enable Android background alerts"); }
    }
    @PluginMethod public void poll(PluginCall call) {
        WorkManager.getInstance(getContext()).enqueueUniqueWork(WORK + "-now", ExistingWorkPolicy.KEEP,
            new OneTimeWorkRequest.Builder(NativeAlertsWorker.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());
        call.resolve();
    }
    @PluginMethod public void disable(PluginCall call) {
        // Invalidate identity before cancelling: an in-flight response must not
        // post private content after logout/account or server changes.
        synchronized (DELIVERY_LOCK) {
        preferences(getContext()).edit().clear().commit();
        TaskAlarms.clear(getContext());
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK + "-now");
        androidx.core.app.NotificationManagerCompat.from(getContext()).cancelAll();
        }
        call.resolve();
    }
}
