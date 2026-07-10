/* Letter Editor — talks to scripts/edit_server.py. Plain JS, no build step. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    letters: [], chapters: [], byId: {},
    id: null, work: null, dirty: false,
    pages: [], page: 0,
    scale: 1, tx: 0, ty: 0, fit: 1, natW: 0, natH: 0,
  };

  /* ---------------- data load ---------------- */
  function isNetworkError(e) {
    return (e instanceof TypeError) || /fetch|networkerror|failed to fetch/i.test(e && e.message || "");
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok && j && j.ok === undefined) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      });
    });
  }

  function populate(d, keepId) {
    state.letters = d.letters || [];
    state.chapters = d.chapters || [];
    state.byId = {};
    state.letters.forEach(function (l) { state.byId[l.id] = l; });
    var sel = $("letterSelect");
    sel.innerHTML = "";
    state.letters.forEach(function (l) {
      var o = document.createElement("option");
      o.value = l.id;
      o.textContent = l.id + "  ·  " + (l.date_label || l.date || "") + "  ·  " + (l.status || "");
      sel.appendChild(o);
    });
    var startId = keepId || (location.hash || "").replace("#", "") || state.letters[0].id;
    if (!state.byId[startId]) startId = state.letters[0].id;
    selectLetter(startId, true);
  }
  function load() {
    api("/api/letters").then(function (d) {
      showHelperDown(false);
      populate(d);
      refreshChanges();
      refreshHealth();
    }).catch(function (e) {
      if (isNetworkError(e)) showHelperDown(true);
      else toast("Could not load letters: " + e.message, true);
    });
  }
  function reloadLetters() {
    var keep = state.id;
    return api("/api/letters").then(function (d) { populate(d, keep); refreshChanges(); });
  }

  /* ---------------- letter selection ---------------- */
  function selectLetter(id, skipConfirm) {
    if (!skipConfirm && state.dirty && !confirm("You have unsaved changes to " + state.id + ". Discard them?")) {
      $("letterSelect").value = state.id;
      return;
    }
    var l = state.byId[id];
    if (!l) return;
    state.id = id;
    state.work = JSON.parse(JSON.stringify(l));
    state.dirty = false;
    location.hash = id;
    $("letterSelect").value = id;
    renderMeta(l);
    renderFields(state.work);
    renderPreview();
    loadScans(l);
    markDirty(false);
  }

  function renderMeta(l) {
    var bits = [
      ["id", l.id], ["n", l.n], ["date", l.date], ["status", l.status],
      ["chapter", l.location_chapter], ["images", (l.images || []).length], ["folder", l.folder],
    ];
    $("meta").innerHTML = bits.map(function (b) {
      return "<span><b>" + b[0] + ":</b> " + (b[1] == null ? "—" : String(b[1])) + "</span>";
    }).join("");
  }

  /* ---------------- editable fields ---------------- */
  function fieldDefs(l) {
    var s = l.status || "transcribed", main;
    if (s === "telegram") {
      main = [["telegram_routing", "Routing", "text"], ["telegram_to", "To", "area", 2],
              ["telegram_message", "Message", "area", 3], ["telegram_signed", "Signed", "text"]];
    } else if (s === "christmas_card") {
      main = [["card_verse", "Card verse", "area", 5], ["signature", "Signature", "text"],
              ["card_note", "Card note", "area", 3]];
    } else if (s === "envelope_only") {
      main = [["envelope_note", "Envelope note", "area", 3]];
    } else {
      main = [["salutation", "Salutation", "text"], ["body", "Letter body", "body"],
              ["signature", "Signature", "text"], ["postscript", "Postscript (P.S.)", "area", 3]];
    }
    return main.concat([
      ["note", "Editorial note (shown in italics below the letter)", "area", 4],
      ["date_label", "Date label", "text"], ["location_stamp", "Location stamp", "text"],
    ]);
  }
  function renderFields(work) {
    var form = $("fields");
    form.innerHTML = "";
    fieldDefs(work).forEach(function (def) {
      var key = def[0], label = def[1], type = def[2], rows = def[3];
      var wrap = document.createElement("div");
      wrap.className = "field";
      var lab = document.createElement("label");
      lab.textContent = label; lab.setAttribute("for", "f_" + key);
      wrap.appendChild(lab);
      var input;
      if (type === "text") { input = document.createElement("input"); input.type = "text"; }
      else { input = document.createElement("textarea"); if (type === "body") input.className = "body"; else if (rows) input.rows = rows; }
      input.id = "f_" + key;
      input.value = work[key] == null ? "" : String(work[key]);
      input.addEventListener("input", function () { work[key] = input.value; markDirty(true); renderPreview(); });
      wrap.appendChild(input);
      form.appendChild(wrap);
    });
  }

  /* ---------------- live preview ---------------- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function markers(text) {
    return esc(text || "").split(/(\[\[[^\]]+\]\]|\[\?\]|\[[^\]]+\?\])/g).map(function (part) {
      var em = part.match(/^\[\[([^\]]+)\]\]$/);
      if (em) return '<span class="em">' + em[1] + "</span>";
      if (/^\[.*\?\]$/.test(part)) return '<sub class="unc">' + part.replace(/^\[|\]$/g, "") + "</sub>";
      return part;
    }).join("");
  }
  function renderPreview() {
    var w = state.work || {}, h = "";
    if (w.salutation) h += '<div class="pv-sal">' + esc(w.salutation) + "</div>";
    if (w.card_verse) h += "<p>" + esc(w.card_verse).replace(/\n/g, "<br>") + "</p>";
    if (w.telegram_message) {
      if (w.telegram_to) h += "<p>" + esc(w.telegram_to).replace(/\n/g, "<br>") + "</p>";
      h += "<p>" + esc(w.telegram_message) + "</p>";
      if (w.telegram_signed) h += '<div class="pv-sig">' + esc(w.telegram_signed) + "</div>";
    }
    if (w.body) w.body.split(/\n\s*\n/).forEach(function (p) { if (p.trim()) h += "<p>" + markers(p) + "</p>"; });
    if (w.envelope_note) h += "<p><em>" + esc(w.envelope_note) + "</em></p>";
    if (w.signature && !w.telegram_message) h += '<div class="pv-sig">' + esc(w.signature) + "</div>";
    if (w.postscript) h += '<div class="pv-ps"><b>P.S.</b> ' + markers(w.postscript) + "</div>";
    var note = w.note || w.card_note;
    if (note) h += '<div class="pv-note">' + esc(note) + "</div>";
    $("preview").innerHTML = h || "<p><em>(nothing to preview)</em></p>";
  }

  /* ---------------- scans: zoom + pan ---------------- */
  function loadScans(l) {
    // l.images is generated by the server from the files actually in the
    // letter's folder (names vary: _p1, _envelope, _card_front, ...).
    state.pages = (l.images || []).map(function (f) { return "../" + l.folder + "/" + f; });
    state.page = 0; showPage();
  }
  function showPage() {
    var img = $("scanImg"), empty = $("scanEmpty");
    if (!state.pages.length) { img.style.display = "none"; empty.style.display = "flex"; $("pageInfo").textContent = ""; return; }
    empty.style.display = "none"; img.style.display = "block";
    $("pageInfo").textContent = "page " + (state.page + 1) + " / " + state.pages.length;
    img.onload = function () { state.natW = img.naturalWidth; state.natH = img.naturalHeight; fitImage(); };
    img.src = state.pages[state.page];
  }
  function stageRect() { return $("scanStage").getBoundingClientRect(); }
  function applyTransform() {
    $("scanImg").style.transform = "translate(calc(-50% + " + state.tx + "px), calc(-50% + " + state.ty + "px)) scale(" + state.scale + ")";
  }
  function fitImage() {
    var r = stageRect();
    state.scale = (!state.natW || !r.width) ? 1 : Math.min(r.width / state.natW, r.height / state.natH) * 0.96;
    state.fit = state.scale; state.tx = 0; state.ty = 0; applyTransform();
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function zoomAt(cx, cy, factor) {
    var r = stageRect(), sx = r.width / 2, sy = r.height / 2, px = cx - r.left, py = cy - r.top;
    var icx = sx + state.tx, icy = sy + state.ty, ix = (px - icx) / state.scale, iy = (py - icy) / state.scale;
    var ns = clamp(state.scale * factor, state.fit * 0.5, (state.fit * 14) || 14);
    state.tx = px - ix * ns - sx; state.ty = py - iy * ns - sy; state.scale = ns; applyTransform();
  }
  function setupScanInteraction() {
    var stage = $("scanStage");
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (e.ctrlKey) zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89);
      else { state.tx -= e.deltaX; state.ty -= e.deltaY; applyTransform(); }
    }, { passive: false });
    var drag = null;
    stage.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; stage.classList.add("grabbing"); stage.setPointerCapture(e.pointerId); });
    stage.addEventListener("pointermove", function (e) { if (!drag) return; state.tx += e.clientX - drag.x; state.ty += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; applyTransform(); });
    function endDrag() { drag = null; stage.classList.remove("grabbing"); }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("dblclick", function (e) { if (state.scale > state.fit * 1.3) fitImage(); else zoomAt(e.clientX, e.clientY, 2.6); });
    window.addEventListener("resize", function () { if (state.scale === state.fit) fitImage(); });
  }

  /* ---------------- save / publish / sync ---------------- */
  function save() {
    if (!state.id) return;
    setBusy(true);
    api("/api/letter/" + encodeURIComponent(state.id), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.work),
    }).then(function () {
      state.byId[state.id] = JSON.parse(JSON.stringify(state.work));
      var i = state.letters.findIndex(function (l) { return l.id === state.id; });
      if (i >= 0) state.letters[i] = state.byId[state.id];
      markDirty(false); toast("Saved " + state.id + "."); refreshChanges();
    }).catch(function (e) {
      if (isNetworkError(e)) showHelperDown(true);
      else toast("Save failed: " + e.message, true);
    }).finally(function () { setBusy(false); });
  }

  function handleResult(r, okMsg) {
    if (r.ok) { toast(r.published === false ? r.message : (okMsg || r.message || "Done.")); }
    else if (r.overlap) { showOverlap(r); }
    else if (r.offline) { toast(r.message, false); }
    else { toast(r.message || "Something went wrong.", true); }
    refreshHealth(); refreshChanges();
  }

  function publish() {
    if (state.dirty && !confirm("Save your changes first, then publish?")) return;
    setBusy(true); toast("Publishing…");
    api("/api/publish", { method: "POST" })
      .then(function (r) { handleResult(r, r.message); })
      .catch(function (e) { if (isNetworkError(e)) showHelperDown(true); else toast("Publish failed: " + e.message, true); })
      .finally(function () { setBusy(false); });
  }
  function forcePublish() {
    hideOverlay("overlapModal"); setBusy(true); toast("Publishing your version…");
    api("/api/force-publish", { method: "POST" })
      .then(function (r) { handleResult(r); })
      .catch(function (e) { toast("Publish failed: " + e.message, true); })
      .finally(function () { setBusy(false); });
  }
  function sync(fromOverlap) {
    if (fromOverlap) hideOverlay("overlapModal");
    setBusy(true); toast("Syncing…");
    api("/api/sync", { method: "POST" })
      .then(function (r) {
        if (r.ok) { return reloadLetters().then(function () { toast(r.message); }); }
        toast(r.message || "Sync failed.", !r.offline);
      })
      .catch(function (e) { if (isNetworkError(e)) showHelperDown(true); else toast("Sync failed: " + e.message, true); })
      .finally(function () { setBusy(false); refreshHealth(); });
  }
  function rebuild() {
    setBusy(true);
    api("/api/rebuild", { method: "POST" })
      .then(function (r) { toast(r.message || "Rebuilt."); })
      .catch(function (e) { toast("Rebuild failed: " + e.message, true); })
      .finally(function () { setBusy(false); refreshHealth(); });
  }

  function refreshChanges() {
    api("/api/changes").then(function (r) {
      var n = (r.ids || []).length;
      $("changeInfo").textContent = n ? (n + " edited, not yet published") : "all published";
    }).catch(function () {});
  }
  function refreshHealth() {
    api("/api/health").then(renderBanner).catch(function (e) { if (isNetworkError(e)) showHelperDown(true); });
  }
  function renderBanner(h) {
    var b = $("banner");
    if (!h) { b.hidden = true; return; }
    var cls = "ok", msg = "", act = "";
    if (h.letters_json_valid === false || h.letters_js_in_sync === false || h.merge_driver === false) {
      cls = "err"; msg = h.messages && h.messages[0] || "Something needs attention.";
      act = '<button id="bRebuild">Rebuild</button>';
    } else if (h.online && h.behind) {
      cls = "warn"; msg = "The live site has " + h.behind + " newer change(s).";
      act = '<button id="bSync">Sync</button>';
    } else if (h.online === false) {
      cls = "warn"; msg = "Offline — you can still edit; publish later.";
    } else {
      cls = "ok"; msg = "Everything's in sync with the live site.";
    }
    b.className = "ed-banner " + cls;
    b.innerHTML = '<span>' + msg + '</span><span class="b-act">' + act + '</span>';
    b.hidden = false;
    if ($("bSync")) $("bSync").addEventListener("click", function () { sync(false); });
    if ($("bRebuild")) $("bRebuild").addEventListener("click", rebuild);
  }

  /* ---------------- overlays ---------------- */
  function showHelperDown(on) { $("helperDown").hidden = !on; }
  function showOverlay(id) { $(id).hidden = false; }
  function hideOverlay(id) { $(id).hidden = true; }
  function showOverlap(r) { $("overlapMsg").textContent = r.message || ""; showOverlay("overlapModal"); }

  /* ---------------- ui helpers ---------------- */
  var toastTimer;
  function toast(msg, err) {
    var t = $("toast");
    t.textContent = msg; t.className = "ed-toast show" + (err ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "ed-toast"; }, err ? 7000 : 4000);
  }
  function markDirty(d) { state.dirty = d; $("saveBtn").classList.toggle("dirty", d); $("saveBtn").textContent = d ? "Save •" : "Save"; }
  function setBusy(b) { ["saveBtn", "publishBtn", "syncBtn"].forEach(function (id) { $(id).disabled = b; }); }
  function step(delta) {
    var i = state.letters.findIndex(function (l) { return l.id === state.id; });
    var j = clamp(i + delta, 0, state.letters.length - 1);
    if (j !== i) selectLetter(state.letters[j].id);
  }
  function showTab(which) {
    var edit = which === "edit";
    $("fields").style.display = edit ? "" : "none";
    document.querySelector(".legend").style.display = edit ? "" : "none";
    $("preview").classList.toggle("show", !edit);
    $("tabEdit").classList.toggle("active", edit);
    $("tabPreview").classList.toggle("active", !edit);
    if (!edit) renderPreview();
  }

  /* ---------------- wire up ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    setupScanInteraction();
    $("letterSelect").addEventListener("change", function (e) { selectLetter(e.target.value); });
    $("prevBtn").addEventListener("click", function () { step(-1); });
    $("nextBtn").addEventListener("click", function () { step(1); });
    $("pgPrev").addEventListener("click", function () { if (state.page > 0) { state.page--; showPage(); } });
    $("pgNext").addEventListener("click", function () { if (state.page < state.pages.length - 1) { state.page++; showPage(); } });
    document.querySelector('[data-z="in"]').addEventListener("click", function () { var r = stageRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); });
    document.querySelector('[data-z="out"]').addEventListener("click", function () { var r = stageRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); });
    document.querySelector('[data-z="fit"]').addEventListener("click", fitImage);
    $("saveBtn").addEventListener("click", save);
    $("publishBtn").addEventListener("click", publish);
    $("syncBtn").addEventListener("click", function () { sync(false); });
    $("helpBtn").addEventListener("click", function () { showOverlay("helpPanel"); });
    $("helpClose").addEventListener("click", function () { hideOverlay("helpPanel"); });
    $("helpRebuild").addEventListener("click", function () { hideOverlay("helpPanel"); rebuild(); });
    $("helperReload").addEventListener("click", function () { location.reload(); });
    $("overlapSync").addEventListener("click", function () { sync(true); });
    $("overlapForce").addEventListener("click", forcePublish);
    $("overlapClose").addEventListener("click", function () { hideOverlay("overlapModal"); });
    $("tabEdit").addEventListener("click", function () { showTab("edit"); });
    $("tabPreview").addEventListener("click", function () { showTab("preview"); });
    window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });
    load();
  });
})();
