package sh.mailflow.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MailFlowNativePlugin.class);
        super.onCreate(savedInstanceState);

        if (bridge != null) {
            bridge.setWebViewClient(new MailFlowWebViewClient(bridge, this));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNativeIntent(intent);
    }

    private void handleNativeIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        Uri data = intent.getData();

        if (MailFlowNativePlugin.ACTION_OPEN_MESSAGE.equals(action)) {
            MailFlowNativePlugin.sendOpenMessageAction(intent);
            return;
        }

        if ((Intent.ACTION_SENDTO.equals(action) || Intent.ACTION_VIEW.equals(action)) && data != null && "mailto".equalsIgnoreCase(data.getScheme())) {
            MailFlowNativePlugin.sendMailtoAction(data);
        }
    }
}
