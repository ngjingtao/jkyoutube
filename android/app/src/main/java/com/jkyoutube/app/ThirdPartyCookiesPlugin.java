package com.jkyoutube.app;

import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Enables third-party cookies in the WebView.
 *
 * Android blocks third-party cookies by default, and Capacitor never turns them
 * on. That is harmless for the app itself but breaks embedded players such as
 * Bilibili's: the player lives in an iframe on our origin, so it is a
 * third-party context, and it relies on its own cookies (buvid and session) to
 * be granted a playable stream. Without them its API answers 403 and the player
 * shows an error instead of the video, while the same embed works fine in a
 * normal browser that allows those cookies.
 *
 * Registered in MainActivity before super.onCreate().
 */
@CapacitorPlugin(name = "ThirdPartyCookies")
public class ThirdPartyCookiesPlugin extends Plugin {

    @Override
    public void load() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
    }
}
