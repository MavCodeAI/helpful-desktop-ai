package com.mavcodeai.alpha;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String ACTION_QUICK_ACTION = "com.mavcodeai.alpha.ACTION_QUICK_ACTION";
    private static final String EXTRA_ALPHA_ACTION = "alpha_action";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        dispatchQuickAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchQuickAction(intent);
    }

    private void dispatchQuickAction(Intent intent) {
        if (intent == null || !ACTION_QUICK_ACTION.equals(intent.getAction())) return;
        String action = intent.getStringExtra(EXTRA_ALPHA_ACTION);
        if (!"start".equals(action)) return;

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('alpha:quick-action',{detail:'start'}));",
                null
            );
            intent.removeExtra(EXTRA_ALPHA_ACTION);
        }, 1200);
    }
}
