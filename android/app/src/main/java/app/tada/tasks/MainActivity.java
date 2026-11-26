package app.tada.tasks;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

public class MainActivity extends BridgeActivity {
    @Override protected void load() {
        String address = getSharedPreferences("tada-server", MODE_PRIVATE).getString("origin", "");
        try { address = ServerAddress.normalize(address); }
        catch (IllegalArgumentException error) {
            startActivity(new Intent(this, ServerSetupActivity.class));
            finish();
            return;
        }
        config = new CapConfig.Builder(this).setServerUrl(address).create();
        super.load();
    }
}
