package studio.zed.playcloudsave;

import android.app.Activity;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.GamesClientStatusCodes;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadata;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.TaskCompletionSource;
import com.google.android.gms.tasks.Tasks;
import java.nio.charset.StandardCharsets;

/**
 * Play Games Services v2 Saved Games. One snapshot per game holds the whole save as UTF-8 text.
 * Conflicts between devices keep the snapshot with the highest progress value, and a write never
 * replaces a more advanced cloud save unless the game asks for it (deliberate restart).
 */
class Backend {

    private static final String TAG = "PlayCloudSave";
    private static final int POLICY = SnapshotsClient.RESOLUTION_POLICY_HIGHEST_PROGRESS;
    private static final int MAX_CONFLICT_ROUNDS = 5;

    private static JSObject state(boolean signedIn) {
        JSObject r = new JSObject();
        r.put("available", true);
        r.put("signedIn", signedIn);
        return r;
    }

    private static boolean authenticated(Task<AuthenticationResult> task) {
        return task.isSuccessful() && task.getResult() != null && task.getResult().isAuthenticated();
    }

    void status(Activity activity, PluginCall call) {
        PlayGames.getGamesSignInClient(activity).isAuthenticated()
            .addOnCompleteListener(t -> call.resolve(state(authenticated(t))));
    }

    void signIn(Activity activity, PluginCall call) {
        PlayGames.getGamesSignInClient(activity).signIn()
            .addOnCompleteListener(t -> call.resolve(state(authenticated(t))));
    }

    void read(Activity activity, String name, PluginCall call) {
        SnapshotsClient client = PlayGames.getSnapshotsClient(activity);
        client.open(name, false, POLICY)
            .continueWithTask(t -> t.isSuccessful() ? settle(client, t.getResult(), 0) : Tasks.<Snapshot>forException(t.getException()))
            .addOnCompleteListener(t -> {
                if (!t.isSuccessful()) {
                    Exception e = t.getException();
                    if (e instanceof ApiException && ((ApiException) e).getStatusCode() == GamesClientStatusCodes.SNAPSHOT_NOT_FOUND) {
                        JSObject r = new JSObject();
                        r.put("found", false);
                        call.resolve(r);
                    } else {
                        fail(call, "read", e);
                    }
                    return;
                }
                Snapshot snapshot = t.getResult();
                try {
                    byte[] bytes = snapshot.getSnapshotContents().readFully();
                    SnapshotMetadata meta = snapshot.getMetadata();
                    JSObject r = new JSObject();
                    r.put("found", bytes != null && bytes.length > 0);
                    if (bytes != null && bytes.length > 0) {
                        r.put("data", new String(bytes, StandardCharsets.UTF_8));
                        r.put("progress", Math.max(0L, meta.getProgressValue()));
                        r.put("modified", meta.getLastModifiedTimestamp());
                    }
                    call.resolve(r);
                } catch (Exception e) {
                    fail(call, "read", e);
                } finally {
                    client.discardAndClose(snapshot);
                }
            });
    }

    void write(Activity activity, String name, String data, long progress, String description, boolean force, PluginCall call) {
        SnapshotsClient client = PlayGames.getSnapshotsClient(activity);
        client.open(name, true, POLICY)
            .continueWithTask(t -> t.isSuccessful() ? settle(client, t.getResult(), 0) : Tasks.<Snapshot>forException(t.getException()))
            .addOnCompleteListener(t -> {
                if (!t.isSuccessful()) {
                    fail(call, "write", t.getException());
                    return;
                }
                Snapshot snapshot = t.getResult();
                long cloud = Math.max(0L, snapshot.getMetadata().getProgressValue());
                if (!force && cloud > progress) {
                    // The cloud holds a more advanced game: keep it, the game restores it on next launch.
                    client.discardAndClose(snapshot);
                    JSObject r = new JSObject();
                    r.put("written", false);
                    r.put("cloudProgress", cloud);
                    call.resolve(r);
                    return;
                }
                if (!snapshot.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8))) {
                    client.discardAndClose(snapshot);
                    call.reject("Could not write the save", "write-failed");
                    return;
                }
                SnapshotMetadataChange change = new SnapshotMetadataChange.Builder()
                    .setProgressValue(progress)
                    .setDescription(description == null ? "" : description)
                    .build();
                client.commitAndClose(snapshot, change).addOnCompleteListener(c -> {
                    if (!c.isSuccessful()) {
                        fail(call, "write", c.getException());
                        return;
                    }
                    JSObject r = new JSObject();
                    r.put("written", true);
                    r.put("cloudProgress", progress);
                    call.resolve(r);
                });
            });
    }

    /** Opens past any conflict, keeping the version with the highest progress. */
    private Task<Snapshot> settle(SnapshotsClient client, SnapshotsClient.DataOrConflict<Snapshot> result, int round) {
        if (!result.isConflict()) return Tasks.forResult(result.getData());
        if (round >= MAX_CONFLICT_ROUNDS) {
            TaskCompletionSource<Snapshot> failed = new TaskCompletionSource<>();
            failed.setException(new IllegalStateException("Unresolved save conflict"));
            return failed.getTask();
        }
        SnapshotsClient.SnapshotConflict conflict = result.getConflict();
        Snapshot server = conflict.getSnapshot();
        Snapshot local = conflict.getConflictingSnapshot();
        Snapshot keep = local.getMetadata().getProgressValue() > server.getMetadata().getProgressValue() ? local : server;
        return client.resolveConflict(conflict.getConflictId(), keep)
            .continueWithTask(t -> t.isSuccessful() ? settle(client, t.getResult(), round + 1) : Tasks.<Snapshot>forException(t.getException()));
    }

    private static void fail(PluginCall call, String what, Exception e) {
        Log.w(TAG, what + " failed", e);
        String code = e instanceof ApiException ? String.valueOf(((ApiException) e).getStatusCode()) : "error";
        call.reject(e == null ? what + " failed" : String.valueOf(e.getMessage()), code, e);
    }
}
