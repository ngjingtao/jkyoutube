package com.jkyoutube.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate(), which is where the bridge
        // (and therefore the WebView) is created.
        registerPlugin(ThirdPartyCookiesPlugin.class);
        super.onCreate(savedInstanceState);

        // Belt and braces. The plugin sets this in load(), but the WebView is
        // not guaranteed to exist at that point, so set it again now that the
        // bridge definitely exists. The call is idempotent.
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
    }
}
