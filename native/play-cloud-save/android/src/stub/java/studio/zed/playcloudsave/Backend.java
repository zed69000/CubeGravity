package studio.zed.playcloudsave;

import android.app.Activity;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

/** Built when the game has no Play Games project id yet: the game keeps its local save only. */
class Backend {

    private static JSObject off() {
        JSObject r = new JSObject();
        r.put("available", false);
        r.put("signedIn", false);
        r.put("reason", "not-configured");
        return r;
    }

    void status(Activity activity, PluginCall call) {
        call.resolve(off());
    }

    void signIn(Activity activity, PluginCall call) {
        call.resolve(off());
    }

    void read(Activity activity, String name, PluginCall call) {
        call.reject("Play Games is not configured", "not-configured");
    }

    void write(Activity activity, String name, String data, long progress, String description, boolean force, PluginCall call) {
        call.reject("Play Games is not configured", "not-configured");
    }
}
