package studio.zed.playcloudsave;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Cloud save through the store: Google Play Games Services Saved Games on Android.
 * The work is done by {@link Backend}, compiled from src/playgames when the game has a Play Games
 * project id, or from src/stub otherwise.
 *
 * JS API (window.Capacitor.Plugins.PlayCloudSave):
 *   status()                                   -> { available, signedIn, reason? }
 *   signIn()                                   -> { available, signedIn }
 *   read({ name })                             -> { found, data?, progress?, modified? }
 *   write({ name, data, progress, description, force })
 *                                              -> { written, cloudProgress? }
 */
@CapacitorPlugin(name = "PlayCloudSave")
public class PlayCloudSavePlugin extends Plugin {

    private Backend backend;

    @Override
    public void load() {
        backend = new Backend();
    }

    @PluginMethod
    public void status(PluginCall call) {
        backend.status(getActivity(), call);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        backend.signIn(getActivity(), call);
    }

    @PluginMethod
    public void read(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.reject("name is required");
            return;
        }
        backend.read(getActivity(), name, call);
    }

    @PluginMethod
    public void write(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        if (name == null || name.isEmpty() || data == null) {
            call.reject("name and data are required");
            return;
        }
        long progress = Math.max(0L, call.getLong("progress", 0L));
        String description = call.getString("description", "");
        boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));
        backend.write(getActivity(), name, data, progress, description, force, call);
    }
}
