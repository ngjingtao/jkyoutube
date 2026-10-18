package com.jkyoutube.app;

import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Third-party cookie control for the WebView.
 *
 * Android blocks third-party cookies by default and Capacitor never enables
 * them. That breaks embedded players such as Bilibili's, which live in an iframe
 * on our origin and therefore run in a third-party context: their cookies are
 * never sent, and their anti-bot check answers with the generic
 * "非常抱歉, 视频无法播放" notice instead of a stream.
 *
 * This matters because the same embed works in Safari and desktop Chrome, which
 * allow those cookies — so the APK was the only platform failing.
 *
 * setEnabled() exists because the WebView may not exist yet when the bridge
 * calls load(). JavaScript calls it after the app is running, which removes any
 * dependence on load() ordering, and it reports back so the result can be
 * checked from the admin screen rather than assumed.
 */
@CapacitorPlugin(name = "ThirdPartyCookies")
public class ThirdPartyCookiesPlugin extends Plugin {

    private boolean applied = false;

    @Override
    public void load() {
        applied = applyCookiePolicy();
    }

    /** Idempotent. Safe to call as often as you like. */
    @PluginMethod
    public void setEnabled(PluginCall call) {
        applied = applyCookiePolicy();
        call.resolve(currentState());
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(currentState());
    }

    private JSObject currentState() {
        boolean hasWebView = false;
        if (getBridge() != null && getBridge().getWebView() != null) hasWebView = true;
        JSObject out = new JSObject();
        out.put("applied", applied);
        out.put("hasWebView", hasWebView);
        out.put("acceptingCookies", CookieManager.getInstance().acceptCookie());
        return out;
    }

    private boolean applyCookiePolicy() {
        if (getBridge() == null) return false;
        WebView webView = getBridge().getWebView();
        if (webView == null) return false;
        CookieManager manager = CookieManager.getInstance();
        manager.setAcceptCookie(true);
        manager.setAcceptThirdPartyCookies(webView, true);
        return true;
    }
}
