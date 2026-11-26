package app.tada.tasks;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLException;
import org.json.JSONObject;

/** Connection setup lives outside the WebView so it works before a backend exists. */
public class ServerSetupActivity extends AppCompatActivity {
    private EditText address;
    private TextView status;
    private Button connect;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.bottomMargin = dp(20); view.setLayoutParams(params); return view;
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Color.rgb(244,248,246));
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(dp(26),dp(42),dp(26),dp(30));
        ViewCompat.setOnApplyWindowInsetsListener(scroll,(v,insets)->{
            Insets safe=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.ime());
            v.setPadding(safe.left,safe.top,safe.right,safe.bottom);return insets;
        });
        ImageView logo = new ImageView(this); logo.setImageResource(R.drawable.tada_icon); layout.addView(logo,new LinearLayout.LayoutParams(dp(64),dp(64)));
        TextView brand=text("TaDa",36,Color.rgb(25,44,35));brand.setTypeface(null,Typeface.BOLD);layout.addView(brand);
        layout.addView(text("Connect to your TaDa server",25,Color.rgb(25,44,35)));
        layout.addView(text("Your account and tasks live on your server. Enter its secure address before signing in.",16,Color.rgb(77,99,88)));
        layout.addView(text("Server address",15,Color.rgb(25,44,35)));
        address=new EditText(this);address.setTextSize(16);address.setTextColor(Color.rgb(25,44,35));address.setHintTextColor(Color.rgb(77,99,88));address.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(0,102,68)));address.setSingleLine(true);address.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);address.setHint("https://tada-list.duckdns.org:8443");
        address.setText(savedInstanceState!=null?savedInstanceState.getString("address",""):getSharedPreferences("tada-server",MODE_PRIVATE).getString("origin",""));
        layout.addView(address,new LinearLayout.LayoutParams(-1,dp(60)));
        status=text("",15,Color.rgb(162,63,86));status.setPadding(0,dp(20),0,0);status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);layout.addView(status);
        connect=new Button(this);connect.setText("Open TaDa");connect.setAllCaps(false);connect.setTextSize(16);connect.setTextColor(Color.WHITE);
        GradientDrawable background=new GradientDrawable();background.setColor(Color.rgb(0,102,68));background.setCornerRadius(dp(14));connect.setBackground(background);layout.addView(connect,new LinearLayout.LayoutParams(-1,dp(54)));
        TextView help=text("Use the same address that opens TaDa in your phone's browser. HTTPS must work with a trusted certificate.\n\nThis address is remembered on this device. Use Android Back from TaDa to return here and change it.",14,Color.rgb(77,99,88));help.setPadding(0,dp(24),0,0);layout.addView(help);
        scroll.addView(layout);setContentView(scroll);connect.setOnClickListener(v->connect());
    }
    private void connect() {
        final String origin;
        try { origin=ServerAddress.normalize(address.getText().toString()); }
        catch(IllegalArgumentException error){status.setText(error.getMessage());return;}
        connect.setEnabled(false);address.setEnabled(false);status.setText("Checking your server…");
        worker.execute(()->{
            String error=null;
            HttpsURLConnection connection=null;
            try {
                connection=(HttpsURLConnection)new URL(origin+"/api/state").openConnection();
                connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setInstanceFollowRedirects(false);connection.setUseCaches(false);connection.setRequestProperty("Accept","application/json");
                int code=connection.getResponseCode();String type=connection.getContentType();
                if(type==null||!type.toLowerCase(java.util.Locale.ROOT).contains("application/json"))throw new IllegalArgumentException("This address is not returning the TaDa service. Check the server address and reverse proxy.");
                InputStream stream=code>=400?connection.getErrorStream():connection.getInputStream();
                if(stream==null)throw new IllegalArgumentException("The server returned an empty response.");
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                try(InputStream input=stream){byte[] buffer=new byte[1024];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>65536)throw new IllegalArgumentException("The server response was not recognized.");bytes.write(buffer,0,n);}}
                JSONObject result=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
                if(!((code==401&&"Please sign in".equals(result.optString("error")))||(code==200&&result.has("user")&&result.has("tasks")&&result.has("lists"))))throw new IllegalArgumentException("This address is not recognized as a TaDa server.");
            }catch(SSLException ex){error="Your server's HTTPS certificate is not ready or trusted. Fix HTTPS first, then try again.";}
             catch(IllegalArgumentException ex){error=ex.getMessage();}
             catch(Exception ex){error="Cannot connect to your server. Check the address, internet connection and server availability.";}
            finally{if(connection!=null)connection.disconnect();}
            final String problem=error;
            runOnUiThread(()->{if(isFinishing()||isDestroyed())return;connect.setEnabled(true);address.setEnabled(true);
                if(problem!=null){status.setText(problem);return;}
                if(!getSharedPreferences("tada-server",MODE_PRIVATE).edit().putString("origin",origin).commit()){status.setText("Could not save the server address. Please try again.");return;}
                status.setText("");startActivity(new Intent(this,MainActivity.class));
            });
        });
    }
    @Override public void onSaveInstanceState(Bundle state){state.putString("address",address.getText().toString());super.onSaveInstanceState(state);}
    @Override public void onDestroy(){worker.shutdownNow();super.onDestroy();}
}
