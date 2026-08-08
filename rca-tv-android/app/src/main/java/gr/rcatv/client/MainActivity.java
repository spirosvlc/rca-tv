package gr.rcatv.client;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

public final class MainActivity extends Activity {

    private static final String PREFS_NAME = "rca_tv_settings";
    private static final String PREF_SERVER_URL = "server_url";

    private WebView webView;
    private TextView staticView;
    private TextView statusView;
    private SharedPreferences preferences;
    private AlertDialog serverDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        preferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        createInterface();
        enterImmersiveMode();

        String configuredUrl = preferences.getString(PREF_SERVER_URL, "");
        if (configuredUrl == null || configuredUrl.trim().isEmpty()) {
            showServerDialog(true);
        } else {
            openRcaServer(configuredUrl);
        }
    }

    private void createInterface() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        staticView = new TextView(this);
        staticView.setTextColor(Color.WHITE);
        staticView.setBackgroundColor(Color.BLACK);
        staticView.setTextSize(16);
        staticView.setGravity(Gravity.FILL);
        staticView.setText(generateStaticText());
        staticView.setVisibility(View.GONE);
        root.addView(staticView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        statusView = new TextView(this);
        statusView.setTextColor(Color.rgb(125, 255, 101));
        statusView.setBackgroundColor(Color.argb(225, 0, 20, 0));
        statusView.setTextSize(22);
        statusView.setGravity(Gravity.CENTER);
        statusView.setPadding(36, 24, 36, 24);
        statusView.setVisibility(View.GONE);
        root.addView(statusView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        ));
        setContentView(root);
    }

    private String generateStaticText() {
        StringBuilder builder = new StringBuilder();
        String[] noise = new String[] {
            "░▒▓▒░▓░▒▓░▒░▓▒▓░▒▓▒░▓▒░▒▓░",
            "▓░▒▒▓░▓▒░░▓▒▒░▓░▒▓▒░░▓▒▓▒",
            "▒▓░░▒▓▒▓░▒▓░░▒▓▒░▓░▒▒▓░▒▓"
        };
        for (int i = 0; i < 80; i++) {
            builder.append(noise[i % noise.length]).append("\\n");
        }
        return builder.toString();
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(
            new NativeBridge(),
            "RcaAndroid"
        );

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                android.util.Log.d(
                    "RCA_WEB",
                    message.message()
                        + " @"
                        + message.lineNumber()
                        + ":"
                        + message.sourceId()
                );
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                hideStatus();
                hideStatic();
                view.requestFocus();
            }

            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                if (request.isForMainFrame()) {
                    showStatic();
                    showStatus(
                        "RCA SERVER NOT AVAILABLE\n"
                            + "Press MENU, or hold 0, to change the address."
                    );
                }
            }
        });
    }

    private void openRcaServer(String enteredUrl) {
        String normalizedUrl = normalizeUrl(enteredUrl);

        preferences.edit()
            .putString(PREF_SERVER_URL, normalizedUrl)
            .apply();

        showStatic();
        showStatus("CONNECTING TO RCA TV…");
        webView.loadUrl(normalizedUrl);
    }

    private String normalizeUrl(String enteredUrl) {
        String value = enteredUrl == null ? "" : enteredUrl.trim();

        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            value = "http://" + value;
        }

        return value;
    }

    private void showServerDialog(boolean mandatory) {
        if (serverDialog != null && serverDialog.isShowing()) return;

        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(preferences.getString(PREF_SERVER_URL, getString(R.string.default_rca_url)));
        input.setSelectAllOnFocus(true);
        input.setTextSize(20);
        input.setPadding(18, 18, 18, 18);

        FrameLayout container = new FrameLayout(this);
        container.setPadding(24, 8, 24, 8);
        container.addView(input, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        serverDialog = new AlertDialog.Builder(this)
            .setTitle("RCA TV server")
            .setMessage("Enter your Mac/server address, for example:\\nhttp://192.168.1.45:8080")
            .setView(container)
            .setPositiveButton("CONNECT", null)
            .setNegativeButton(mandatory ? "EXIT" : "CANCEL", (currentDialog, which) -> {
                if (mandatory) finish();
            })
            .create();

        serverDialog.setCanceledOnTouchOutside(false);
        serverDialog.setOnCancelListener(dialog -> { if (mandatory) finish(); });
        serverDialog.setOnShowListener(ignored -> {
            serverDialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
                String value = input.getText().toString().trim();
                if (value.isEmpty()) {
                    input.setError("Enter the RCA TV server address");
                    return;
                }
                serverDialog.dismiss();
                serverDialog = null;
                openRcaServer(value);
            });
        });
        serverDialog.setOnDismissListener(dialog -> serverDialog = null);
        serverDialog.show();
        if (serverDialog.getWindow() != null) {
            serverDialog.getWindow().setSoftInputMode(
                android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
            );
        }
        input.requestFocus();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event);
        }

        int keyCode = event.getKeyCode();

        if (serverDialog != null && serverDialog.isShowing() && keyCode == KeyEvent.KEYCODE_BACK) {
            View focused = serverDialog.getCurrentFocus();
            if (focused != null) {
                android.view.inputmethod.InputMethodManager imm =
                    (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                imm.hideSoftInputFromWindow(focused.getWindowToken(), 0);
            }
            return true;
        }

        // Long press 0 reopens the server settings.
        if (
            keyCode == KeyEvent.KEYCODE_0
                && event.isLongPress()
        ) {
            showServerDialog(false);
            return true;
        }

        switch (keyCode) {
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP:
            case KeyEvent.KEYCODE_DPAD_UP:
                sendWebKey("ChannelUp", 427);
                return true;

            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN:
            case KeyEvent.KEYCODE_DPAD_DOWN:
                sendWebKey("ChannelDown", 428);
                return true;

            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_0:
                sendWebKey("0", 48);
                return true;

            case KeyEvent.KEYCODE_1: sendWebKey("1", 49); return true;
            case KeyEvent.KEYCODE_2: sendWebKey("2", 50); return true;
            case KeyEvent.KEYCODE_3: sendWebKey("3", 51); return true;
            case KeyEvent.KEYCODE_4: sendWebKey("4", 52); return true;
            case KeyEvent.KEYCODE_5: sendWebKey("5", 53); return true;
            case KeyEvent.KEYCODE_6: sendWebKey("6", 54); return true;
            case KeyEvent.KEYCODE_7: sendWebKey("7", 55); return true;
            case KeyEvent.KEYCODE_8: sendWebKey("8", 56); return true;
            case KeyEvent.KEYCODE_9: sendWebKey("9", 57); return true;

            case KeyEvent.KEYCODE_VOLUME_UP:
                sendWebKey("AudioVolumeUp", 447);
                return true;

            case KeyEvent.KEYCODE_VOLUME_DOWN:
                sendWebKey("AudioVolumeDown", 448);
                return true;

            case KeyEvent.KEYCODE_VOLUME_MUTE:
            case KeyEvent.KEYCODE_MUTE:
                sendWebKey("AudioVolumeMute", 449);
                return true;

            case KeyEvent.KEYCODE_BACK:
                sendWebKey("BrowserBack", 10009);
                return true;

            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_SETTINGS:
                showServerDialog(false);
                return true;

            default:
                return super.dispatchKeyEvent(event);
        }
    }

    private void sendWebKey(String key, int keyCode) {
        if (webView == null) {
            return;
        }

        String escapedKey = key
            .replace("\\", "\\\\")
            .replace("'", "\\'");

        String javascript = String.format(
            Locale.US,
            "(function(){"
                + "const e=new KeyboardEvent('keydown',"
                + "{key:'%s',code:'%s',bubbles:true,cancelable:true});"
                + "Object.defineProperty(e,'keyCode',{get:function(){return %d;}});"
                + "Object.defineProperty(e,'which',{get:function(){return %d;}});"
                + "document.dispatchEvent(e);"
                + "})();",
            escapedKey,
            escapedKey,
            keyCode,
            keyCode
        );

        webView.evaluateJavascript(javascript, null);
    }

    private void showStatic() {
        runOnUiThread(() -> {
            if (staticView != null) {
                staticView.setText(generateStaticText());
                staticView.setVisibility(View.VISIBLE);
            }
            if (webView != null) webView.setVisibility(View.INVISIBLE);
        });
    }

    private void hideStatic() {
        runOnUiThread(() -> {
            if (staticView != null) staticView.setVisibility(View.GONE);
            if (webView != null) webView.setVisibility(View.VISIBLE);
        });
    }

    private void showStatus(String message) {
        runOnUiThread(() -> {
            statusView.setText(message);
            statusView.setVisibility(View.VISIBLE);
        });
    }

    private void hideStatus() {
        runOnUiThread(() -> statusView.setVisibility(View.GONE));
    }

    private void enterImmersiveMode() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller =
                getWindow().getInsetsController();

            if (controller != null) {
                controller.hide(
                    WindowInsets.Type.statusBars()
                        | WindowInsets.Type.navigationBars()
                );
                controller.setSystemBarsBehavior(
                    WindowInsetsController
                        .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {
            enterImmersiveMode();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();

        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }

        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

    public final class NativeBridge {
        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> showServerDialog(false));
        }

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() ->
                Toast.makeText(
                    MainActivity.this,
                    message,
                    Toast.LENGTH_SHORT
                ).show()
            );
        }
    }
}
