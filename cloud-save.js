/* Cloud save through the store, shared by the studio's Capacitor games.
   Android: Google Play Games Services Saved Games (plugin PlayCloudSave). Web: nothing changes, the game
   keeps its localStorage save. iOS: not wired yet (iCloud / Game Center later), local save only.

   The game keeps reading and writing localStorage synchronously. This script watches the keys that make
   up the player's game, and a few seconds after they change, sends a copy of them as one Play Games
   snapshot, tagged with a progress value computed by the game.

   On launch, once the player is signed in to Play Games:
     - the cloud game is more advanced than the one on the phone (new phone, reinstall): the phone's
       game is copied aside (localStorage "cloudsave.backup.<name>"), the cloud game replaces it and the
       page reloads once;
     - otherwise the phone's game is sent to the cloud.
   A write never replaces a more advanced cloud game, except right after the player restarted their game
   on purpose (one of resetKeys removed, or localStorage cleared).

   Load it as a classic <script> before the game's own code, then call CloudSave.setup({...}):
     name        snapshot name, one per game
     keep(key)   true for the localStorage keys that travel with the player
     progress(get)  number that only grows as the player advances; get(key) returns the stored string
     describe(get)  optional short text shown in the player's Play Games saves
     resetKeys   keys (array, or function of the key) whose removal means "the player restarted or
                 deleted a game on purpose": the smaller save then replaces the cloud one
     optional(key)  keys dropped first when the save would be too big for a snapshot
   CloudSave.native      true in the Android app with the plugin
   CloudSave.ready       Promise<boolean>, true once the cloud is in sync
   CloudSave.signIn()    asks the player to sign in to Play Games, then syncs (for an options button)
   CloudSave.flush()     sends pending changes now
*/
(function () {
  "use strict";
  var cap = window.Capacitor;
  var isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  // Games without a bundler have no plugin proxies in Capacitor.Plugins: call the native bridge directly.
  var Plugin = isNative && cap.Plugins && cap.Plugins.PlayCloudSave ? cap.Plugins.PlayCloudSave : null;
  if (!Plugin && isNative && typeof cap.nativePromise === "function") {
    Plugin = {};
    ["status", "signIn", "read", "write"].forEach(function (m) {
      Plugin[m] = function (o) { return cap.nativePromise("PlayCloudSave", m, o || {}); };
    });
  }
  var idle = { native: false, ready: Promise.resolve(false), setup: function () {}, signIn: function () { return Promise.resolve(false); }, flush: function () { return Promise.resolve(); } };
  if (!Plugin || (cap.getPlatform && cap.getPlatform() !== "android")) { window.CloudSave = idle; return; }

  var MAX_BYTES = 2500000;      // Play Games allows 3 MB per snapshot
  var DELAY = 4000;             // several writes in a row (end of a level) make one upload
  var MIN_GAP = 30000;          // games that save all the time upload at most twice a minute
  var RETRY = 60000;

  window.CloudSave = {
    native: true,
    ready: Promise.resolve(false),
    setup: setup,
    signIn: function () { return Promise.resolve(false); },
    flush: function () { return Promise.resolve(); }
  };

  function setup(cfg) {
    var ls = window.localStorage;
    var proto = Storage.prototype, set = proto.setItem, remove = proto.removeItem, clear = proto.clear;
    var name = cfg.name;
    var resetKeys = cfg.resetKeys || [];
    function isReset(k) { try { return typeof resetKeys === "function" ? !!resetKeys(k) : resetKeys.indexOf(k) >= 0; } catch (e) { return false; } }
    var askedKey = "cloudsave.asked." + name;
    var restoredKey = "cloudsave.restored." + name;
    var syncedKey = "cloudsave.synced." + name;
    var forceKey = "cloudsave.force." + name; // a deliberate restart survives a reload until it reaches the cloud
    var ready = false, frozen = false, dirty = false, timer = 0, busy = null, tries = 0, last = 0;
    var forceNext = false;
    try { forceNext = ls.getItem(forceKey) === "1"; } catch (e) {}
    function setForce(on) { forceNext = on; try { if (on) set.call(ls, forceKey, "1"); else remove.call(ls, forceKey); } catch (e) {} }
    var resolveReady;
    window.CloudSave.ready = new Promise(function (r) { resolveReady = r; });

    function mine(k) { try { return typeof k === "string" && !!cfg.keep(k); } catch (e) { return false; } }
    function collect() {
      var data = {};
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (mine(k)) data[k] = ls.getItem(k); }
      var size = JSON.stringify(data).length;
      if (size > MAX_BYTES && cfg.optional) {
        Object.keys(data).filter(function (k) { return cfg.optional(k); })
          .sort(function (a, b) { return data[b].length - data[a].length; })
          .forEach(function (k) { if (size > MAX_BYTES) { size -= data[k].length + k.length + 6; delete data[k]; } });
      }
      return data;
    }
    function getter(data) { return function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; }; }
    function progressOf(data) {
      try { var p = Math.floor(Number(cfg.progress(getter(data))) || 0); return p > 0 ? p : 0; } catch (e) { return 0; }
    }
    function describe(data) {
      try { return cfg.describe ? String(cfg.describe(getter(data)) || "").slice(0, 120) : ""; } catch (e) { return ""; }
    }

    function changed() {
      dirty = true;
      if (ready && !timer) timer = setTimeout(upload, Math.max(DELAY, last + MIN_GAP - Date.now()));
    }
    proto.setItem = function (k, v) {
      if (this === ls && mine(k)) { if (frozen) return; set.call(this, k, v); changed(); return; }
      set.call(this, k, v);
    };
    proto.removeItem = function (k) {
      if (this === ls && mine(k)) {
        if (frozen) return;
        remove.call(this, k);
        if (isReset(k)) setForce(true);
        changed();
        return;
      }
      remove.call(this, k);
    };
    proto.clear = function () {
      if (this === ls) { if (frozen) return; clear.call(this); setForce(true); changed(); return; }
      clear.call(this);
    };

    function upload() {
      clearTimeout(timer); timer = 0;
      if (!ready || !dirty) return Promise.resolve();
      if (busy) return busy.then(upload);
      dirty = false; last = Date.now();
      var data = collect(), force = forceNext;
      busy = Plugin.write({ name: name, data: JSON.stringify({ v: 1, t: Date.now(), data: data }), progress: progressOf(data), description: describe(data), force: force })
        .then(function (r) { if (r && r.written && force) setForce(false); })
        .catch(function (e) { dirty = true; console.warn("[CloudSave] write", e); })
        .then(function () { busy = null; });
      return busy;
    }
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") upload(); });
    window.addEventListener("pagehide", function () { upload(); });

    function restore(data) {
      var again = false;
      try { again = sessionStorage.getItem(restoredKey) === "1"; } catch (e) {}
      if (again) return false; // already reloaded once this session: never loop
      var local = collect();
      frozen = true;
      try { set.call(ls, "cloudsave.backup." + name, JSON.stringify({ t: Date.now(), data: local })); } catch (e) { /* too big to keep a copy */ }
      Object.keys(local).forEach(function (k) { remove.call(ls, k); });
      Object.keys(data).forEach(function (k) { if (mine(k) && typeof data[k] === "string") { try { set.call(ls, k, data[k]); } catch (e) { console.warn("[CloudSave] restore", k, e); } } });
      try { sessionStorage.setItem(restoredKey, "1"); } catch (e) {}
      location.reload();
      return true;
    }

    function sync(interactive) {
      return Plugin.status()
        .then(function (s) {
          if (!s || !s.available) return null;
          if (s.signedIn) return s;
          var asked = false;
          try { asked = ls.getItem(askedKey) === "1"; set.call(ls, askedKey, "1"); } catch (e) {}
          // Play Games already offers to sign in at launch; ask once more per install, then only on request.
          return interactive || !asked ? Plugin.signIn() : s;
        })
        .then(function (s) { return s && s.signedIn ? Plugin.read({ name: name }) : null; })
        .then(function (r) {
          if (!r) { resolveReady(false); return false; }
          var local = collect(), lp = progressOf(local);
          if (r.found) {
            var cloud = null;
            try { cloud = JSON.parse(r.data); } catch (e) {}
            var cdata = cloud && cloud.data && typeof cloud.data === "object" ? cloud.data : null;
            if (cdata && !forceNext && progressOf(cdata) > lp && restore(cdata)) return true;
          }
          ready = true;
          try { sessionStorage.setItem(syncedKey, "1"); } catch (e) {}
          if (lp > 0 || forceNext) { dirty = true; upload(); }
          else if (dirty && !timer) timer = setTimeout(upload, DELAY);
          resolveReady(true);
          return true;
        })
        .catch(function (e) {
          console.warn("[CloudSave] sync", e);
          if (++tries < 5) setTimeout(function () { sync(false); }, RETRY);
          else resolveReady(false);
          return false;
        });
    }

    window.CloudSave.signIn = function () { return ready ? Promise.resolve(true) : sync(true); };
    window.CloudSave.flush = upload;
    // games split over several pages sync once per app session, then only send changes
    var synced = false;
    try { synced = sessionStorage.getItem(syncedKey) === "1"; } catch (e) {}
    if (synced) { ready = true; resolveReady(true); if (dirty) changed(); }
    else sync(false);
  }
})();
