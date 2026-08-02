/* ===========================================================================
   瀏覽計數器 — Supabase RPC
   ---------------------------------------------------------------------------
   標記方式（HTML 端）：
     data-counter-self="<id>"   本頁計數器：每個工作階段累加一次，其餘只讀
     data-counter-view="<id>"   別頁的計數（首頁卡片用）：永遠只讀，不累加

   設定未填時整個計數器區塊維持隱藏，網站其他部分照常運作。
   =========================================================================== */
(function () {
  "use strict";

  var cfg = (window.SITE_CONFIG || {}).supabase || {};
  var BASE = (cfg.url || "").replace(/\/+$/, "");
  var KEY = cfg.anonKey || "";
  if (!BASE || !KEY) return;

  var HEADERS = {
    "Content-Type": "application/json",
    apikey: KEY,
    Authorization: "Bearer " + KEY
  };

  function rpc(fn, body) {
    return fetch(BASE + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body || {})
    }).then(function (res) {
      if (!res.ok) throw new Error(fn + " " + res.status);
      return res.json();
    });
  }

  function format(n) {
    return Number(n).toLocaleString("zh-Hant-TW");
  }

  /* 把數字填進所有掛著同一個 id 的節點 -------------------------------- */
  function paint(id, value) {
    var sel = '[data-counter-self="' + id + '"],[data-counter-view="' + id + '"]';
    document.querySelectorAll(sel).forEach(function (el) {
      var num = el.querySelector(".num") || el;
      num.textContent = format(value);
      el.classList.remove("is-loading");
      el.removeAttribute("hidden");
    });
  }

  /* 一次查多筆；資料庫若還沒建 get_counters 就退回逐筆 get_counter ----- */
  function readMany(ids) {
    if (!ids.length) return;
    rpc("get_counters", { counter_ids: ids })
      .then(function (rows) {
        var seen = Object.create(null);
        (rows || []).forEach(function (r) {
          seen[r.id] = r.count;
          paint(r.id, r.count);
        });
        ids.forEach(function (id) {
          if (!(id in seen)) paint(id, 0);
        });
      })
      .catch(function () {
        ids.forEach(function (id) {
          rpc("get_counter", { counter_id: id })
            .then(function (n) { paint(id, n); })
            .catch(function () { /* 靜默失敗：維持隱藏 */ });
        });
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var selfEl = document.querySelector("[data-counter-self]");
    var selfId = selfEl && selfEl.getAttribute("data-counter-self");

    /* 首頁卡片上的各篇文章瀏覽數（唯讀），排除本頁自己的 id */
    var viewIds = [];
    document.querySelectorAll("[data-counter-view]").forEach(function (el) {
      var id = el.getAttribute("data-counter-view");
      if (id && id !== selfId && viewIds.indexOf(id) === -1) viewIds.push(id);
    });

    if (selfId) {
      /* 同一分頁重整只讀不加，避免自己灌爆自己的數字 */
      var mark = "counted:" + selfId;
      var counted = false;
      try { counted = sessionStorage.getItem(mark) === "1"; } catch (e) { /* 私密模式 */ }

      if (counted) {
        readMany([selfId]);
      } else {
        rpc("increment_counter", { counter_id: selfId })
          .then(function (n) {
            try { sessionStorage.setItem(mark, "1"); } catch (e) {}
            paint(selfId, n);
          })
          .catch(function () { readMany([selfId]); });
      }
    }

    readMany(viewIds);
  });
})();
