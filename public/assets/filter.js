/* ===========================================================================
   首頁分類篩選
   ---------------------------------------------------------------------------
   純漸進增強：卡片本來就全部靜態寫在 HTML 裡，
   沒有 JavaScript（或腳本掛掉）時只是「全部顯示」，不會有東西不見，
   搜尋引擎抓到的也一直是完整清單。

   兩種進入方式：
     · 點首頁的分類鈕            → 就地篩選，網址同步成 ?tag=骨科仁心
     · 從頁尾／外部帶 ?tag= 進來 → 載入時直接套用

   篩選條件比對的是卡片上的 data-tag，由 tools/build.mjs 產生。
   =========================================================================== */

(() => {
  const ALL = "*";

  const chipBox = document.querySelector(".chips");
  const grid = document.querySelector(".card-grid");
  const empty = document.querySelector(".filter-empty");
  if (!chipBox || !grid) return;

  const chips = [...chipBox.querySelectorAll("[data-filter]")];
  const cards = [...grid.querySelectorAll(".card[data-tag]")];
  if (!chips.length || !cards.length) return;

  /* 這個站真的有的分類，用來擋掉網址亂帶的 ?tag= */
  const known = new Set(chips.map((c) => c.dataset.filter));

  function apply(tag, { push } = { push: false }) {
    const wanted = known.has(tag) ? tag : ALL;

    let shown = 0;
    for (const card of cards) {
      const hit = wanted === ALL || card.dataset.tag === wanted;
      card.hidden = !hit;
      if (hit) shown++;
    }

    for (const chip of chips) {
      const on = chip.dataset.filter === wanted;
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    }

    if (empty) empty.hidden = shown > 0;

    if (push) {
      const url = new URL(location.href);
      if (wanted === ALL) url.searchParams.delete("tag");
      else url.searchParams.set("tag", wanted);
      url.hash = "posts";
      history.pushState({ tag: wanted }, "", url);
    }
  }

  chipBox.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    apply(chip.dataset.filter, { push: true });
  });

  /* 上一頁／下一頁也要跟著回到對的分類 */
  addEventListener("popstate", () => {
    apply(new URL(location.href).searchParams.get("tag") || ALL);
  });

  apply(new URL(location.href).searchParams.get("tag") || ALL);
})();
