package app.tada.tasks;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import android.graphics.Color;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.*;
import androidx.core.graphics.Insets;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAlertsPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content,(view,insets)->{
            Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard=insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,keyboard.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        applyAppearance(false, "#f4f8f6");
        ViewCompat.requestApplyInsets(content);
    }
    public void applyAppearance(boolean dark,String background) {
        int color; try {color=Color.parseColor(background);} catch(Exception error){color=dark?Color.rgb(20,27,23):Color.rgb(244,248,246);}
        findViewById(android.R.id.content).setBackgroundColor(color);
        getWindow().setStatusBarColor(color); getWindow().setNavigationBarColor(color);
        WindowInsetsControllerCompat controller=WindowCompat.getInsetsController(getWindow(),getWindow().getDecorView());
        controller.show(WindowInsetsCompat.Type.systemBars());
        controller.setAppearanceLightStatusBars(!dark); controller.setAppearanceLightNavigationBars(!dark);
    }
    @Override protected void load() {
        String address = getSharedPreferences("tada-server", MODE_PRIVATE).getString("origin", ServerAddress.DEFAULT_ORIGIN);
        try { address = ServerAddress.normalize(address); }
        catch (IllegalArgumentException error) {
            address=ServerAddress.DEFAULT_ORIGIN;
        }
        getSharedPreferences("tada-server",MODE_PRIVATE).edit().putString("origin",address).commit();
        config = new CapConfig.Builder(this).setServerUrl(address).create();
        super.load();
    }
}
