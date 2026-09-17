import { renderList, renderDetail, neighbors } from "./view.js";
import { subscribeItems, loadPhoto, signIn, signOut, isSignedIn, onAuth, saveItem, addTodayItem, deleteItem, savePhoto } from "./data.js";
import { makePhotoPair } from "./image.js";
import { STORE_NAME } from "./config.js";

const state = { items: [], query: "", activeCat: null, editing: false, signedIn: false, busy: false, photos: {}, pendingPhoto: null };  // pendingPhoto: 撮影済み・未保存の {thumb, full}
const $ = (s) => document.querySelector(s);
const main = $("#main"), editBtn = $("#edit-btn"), search = $("#search");
$("#store-name").textContent = STORE_NAME;

const route = () => { const m = location.hash.match(/^#item\/(.+)$/); return m ? { page: "item", id: decodeURIComponent(m[1]) } : { page: "list" }; };

function render() {
  const r = route();
  editBtn.textContent = state.editing ? "編集終了" : "編集";
  editBtn.classList.toggle("on", state.editing);
  document.body.classList.toggle("editing", state.editing);
  if (r.page === "item") {
    const item = state.items.find(i => i.id === r.id);
    search.hidden = true;
    const pending = state.pendingPhoto?.id === r.id ? state.pendingPhoto : null;
    main.innerHTML = item ? renderDetail(item, { editing: state.editing, fullPhoto: pending ? pending.full : state.photos[r.id], pendingPhoto: !!pending, ...neighbors(state.items, r.id) }) : `<p class="empty">読み込み中…</p>`;
    window.scrollTo(0, 0);
    if (item && item.photoUrl && !(r.id in state.photos)) {
      state.photos[r.id] = undefined;  // 二重読み防止
      loadPhoto(r.id).then(d => { state.photos[r.id] = d; if (route().id === r.id) render(); });
    }
  } else {
    search.hidden = false;
    main.innerHTML = renderList(state.items, { query: state.query, activeCat: state.activeCat, editing: state.editing });
  }
}

// --- 編集モード ---
async function toggleEdit() {
  if (state.editing) {
    if (state.pendingPhoto && !confirm("撮った写真が未保存です。破棄して編集を終了しますか？")) return;
    state.pendingPhoto = null; state.editing = false; return render();
  }
  if (!isSignedIn()) {
    const pw = prompt("社員パスワードを入力");
    if (!pw) return;
    try { await signIn(pw); } catch (e) { alert("パスワードが違います"); return; }
  }
  state.editing = true; render();
}

function collectDetailForm() {
  const art = $("article.detail");
  const rows = [...art.querySelectorAll("tr[data-row]")].map(tr => ({
    name: tr.querySelector('[data-ing="name"]').value.trim(),
    qty: (v => v === "" ? null : Number(v))(tr.querySelector('[data-ing="qty"]').value.trim()),
    unit: tr.querySelector('[data-ing="unit"]').value.trim(),
  })).filter(g => g.name);
  const priceRaw = art.querySelector('[data-field="price"]').value.trim();
  return { name: art.querySelector('[data-field="name"]').value.trim(),
           price: priceRaw === "" ? null : Number(priceRaw),
           steps: art.querySelector('[data-field="steps"]').value, ingredients: rows };
}

async function withBusy(fn) {
  if (state.busy) return; state.busy = true; document.body.classList.add("busy");
  try { await fn(); } catch (e) { console.error(e); alert("保存に失敗しました: " + (e.message || e)); }
  finally { state.busy = false; document.body.classList.remove("busy"); }
}

main.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-action],[data-cat]");
  if (!t) return;
  if (t.dataset.cat) { state.activeCat = state.activeCat === t.dataset.cat ? null : t.dataset.cat; return render(); }
  const id = $("article.detail")?.dataset.id;
  switch (t.dataset.action) {
    case "save": return withBusy(async () => {
      if (state.pendingPhoto?.id === id) { await savePhoto(id, state.pendingPhoto); state.photos[id] = state.pendingPhoto.full; state.pendingPhoto = null; }
      await saveItem(id, collectDetailForm());
    });
    case "delete": if (confirm("この品を削除しますか？")) return withBusy(async () => { await deleteItem(id); location.hash = ""; }); return;
    case "add-today": { const name = prompt("品名"); if (name?.trim()) return withBusy(async () => { const nid = await addTodayItem(name.trim()); location.hash = `#item/${nid}`; }); return; }
    case "add-row": { const item = state.items.find(i => i.id === id); const cur = collectDetailForm(); cur.ingredients.push({ name: "", qty: null, unit: "" });
      main.innerHTML = renderDetail({ ...item, ...cur }, { editing: true, fullPhoto: state.pendingPhoto?.id === id ? state.pendingPhoto.full : state.photos[id], pendingPhoto: state.pendingPhoto?.id === id, ...neighbors(state.items, id) }); return; }
    case "del-row": { const item = state.items.find(i => i.id === id); const cur = collectDetailForm(); cur.ingredients.splice(Number(t.dataset.row), 1);
      main.innerHTML = renderDetail({ ...item, ...cur }, { editing: true, fullPhoto: state.pendingPhoto?.id === id ? state.pendingPhoto.full : state.photos[id], pendingPhoto: state.pendingPhoto?.id === id, ...neighbors(state.items, id) }); return; }
  }
});

main.addEventListener("change", async (ev) => {
  const input = ev.target;
  if (input.dataset.action !== "photo" || !input.files?.[0]) return;
  const id = $("article.detail").dataset.id;
  await withBusy(async () => {
    const pair = await makePhotoPair(input.files[0]);
    state.pendingPhoto = { id, ...pair };   // 「保存」を押すまで送らない
    const item = state.items.find(i => i.id === id); const cur = collectDetailForm();
    main.innerHTML = renderDetail({ ...item, ...cur }, { editing: true, fullPhoto: pair.full, pendingPhoto: true, ...neighbors(state.items, id) });
  });
});

// --- スワイプで前後 ---
let sx = null, sy = null;
main.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
main.addEventListener("touchend", (e) => {
  if (sx === null || route().page !== "item" || state.editing) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = sy = null;
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
  const { prev, next } = neighbors(state.items, route().id);
  const to = dx < 0 ? next : prev; if (to) location.hash = `#item/${to}`;
}, { passive: true });

editBtn.addEventListener("click", toggleEdit);
search.addEventListener("input", () => { state.query = search.value; render(); });
window.addEventListener("hashchange", () => { if (state.pendingPhoto && route().id !== state.pendingPhoto.id) state.pendingPhoto = null; render(); });
onAuth((ok) => { state.signedIn = ok; if (!ok) state.editing = false; render(); });
subscribeItems((items) => { state.items = items; render(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
