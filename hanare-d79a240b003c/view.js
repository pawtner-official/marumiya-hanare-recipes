import { CATEGORIES, TODAY_CATEGORY } from "./config.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const formatQty = (qty, unit) => (qty === null || qty === undefined || qty === "") ? "" : `${qty}${unit || ""}`;
const yen = (p) => (p === null || p === undefined) ? "" : `¥${Number(p).toLocaleString("ja-JP")}`;

export function groupByCategory(items) {
  const m = new Map();
  for (const cat of CATEGORIES) {
    const list = items.filter(i => !i.hidden && i.category === cat).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (list.length) m.set(cat, list);
  }
  return m;
}

export function neighbors(items, id) {
  const me = items.find(i => i.id === id);
  if (!me) return { prev: null, next: null };
  const list = groupByCategory(items).get(me.category) || [];
  const idx = list.findIndex(i => i.id === id);
  return { prev: idx > 0 ? list[idx - 1].id : null, next: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null };
}

function thumb(item) {
  return item.photoUrl
    ? `<img class="thumb" src="${esc(item.photoUrl)}" alt="" loading="lazy">`
    : `<div class="thumb no-photo">写真なし</div>`;
}

export function renderList(items, { query = "", activeCat = null, editing = false }) {
  const q = query.trim();
  const groups = groupByCategory(items);
  const cats = [...groups.keys()];
  if (editing && !groups.has(TODAY_CATEGORY)) cats.push(TODAY_CATEGORY);
  const tabs = cats.map(c => `<button class="tab${c === activeCat ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  const sections = cats.map(cat => {
    let list = groups.get(cat) || [];
    if (q) list = list.filter(i => i.name.includes(q));
    if (activeCat && cat !== activeCat) return "";
    if (!list.length && !(editing && cat === TODAY_CATEGORY)) return "";
    const cards = list.map(i => `
      <a class="card" href="#item/${esc(i.id)}">${thumb(i)}
        <div class="card-body"><div class="name">${esc(i.name)}</div><div class="price">${yen(i.price)}</div></div></a>`).join("");
    const add = editing && cat === TODAY_CATEGORY ? `<button class="btn add" data-action="add-today">＋ うまいっしょに追加</button>` : "";
    return `<section id="cat-${esc(cat)}"><h2>${esc(cat)}</h2><div class="grid">${cards}</div>${add}</section>`;
  }).join("");
  return `<div class="tabs">${tabs}</div><div class="list">${sections || `<p class="empty">該当なし</p>`}</div>`;
}

function ingredientsTable(item, editing) {
  const rows = (item.ingredients || []).map((g, i) => editing
    ? `<tr data-row="${i}"><td><input data-ing="name" value="${esc(g.name)}"></td><td><input data-ing="qty" inputmode="decimal" value="${esc(g.qty ?? "")}"></td><td><input data-ing="unit" value="${esc(g.unit)}"></td><td><button class="btn-x" data-action="del-row" data-row="${i}">×</button></td></tr>`
    : `<tr><td>${esc(g.name)}</td><td class="qty">${esc(formatQty(g.qty, g.unit))}</td></tr>`).join("");
  const addRow = editing ? `<tr><td colspan="4"><button class="btn small" data-action="add-row">＋ 材料を追加</button></td></tr>` : "";
  return `<table class="ing">${rows}${addRow}</table>`;
}

export function renderDetail(item, { editing = false, prev = null, next = null, fullPhoto = null }) {
  // fullPhoto（1200px）が届くまではサムネ（200px）を拡大表示してつなぐ
  const src = fullPhoto || item.photoUrl;
  const photo = src ? `<img class="photo${fullPhoto ? "" : " loading"}" src="${esc(src)}" alt="${esc(item.name)}">` : `<div class="photo no-photo">写真なし</div>`;
  const camera = editing ? `<label class="camera-overlay">📷 タップして撮影<input type="file" accept="image/*" capture="environment" data-action="photo" hidden></label>` : "";
  const steps = editing
    ? `<textarea data-field="steps" rows="8" placeholder="手順を入力（1行1工程）">${esc(item.steps)}</textarea>`
    : (item.steps?.trim() ? `<ol class="steps">${item.steps.split(/\n+/).filter(Boolean).map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : `<p class="empty">手順は未登録</p>`);
  const title = editing
    ? `<input class="title-input" data-field="name" value="${esc(item.name)}"><input class="price-input" data-field="price" inputmode="numeric" placeholder="税込価格" value="${esc(item.price ?? "")}">`
    : `<h1>${esc(item.name)}</h1><div class="price big">${yen(item.price)}</div>`;
  const updated = item.updatedAt ? `<div class="meta">最終更新 ${esc(item.updatedAt)}</div>` : "";
  const nav = `<div class="nav"><a class="btn ghost${prev ? "" : " disabled"}" href="#item/${esc(prev || item.id)}">‹ 前</a><a class="btn ghost" href="#">一覧</a><a class="btn ghost${next ? "" : " disabled"}" href="#item/${esc(next || item.id)}">次 ›</a></div>`;
  const editBar = editing ? `<div class="editbar"><button class="btn primary" data-action="save">保存</button>${item.category === TODAY_CATEGORY && !/^\d{4}$/.test(item.id) ? `<button class="btn danger" data-action="delete">この品を削除</button>` : ""}</div>` : "";
  return `<article class="detail" data-id="${esc(item.id)}">
    <div class="photo-wrap">${photo}${camera}</div>
    <div class="detail-body">${title}<div class="cat">${esc(item.category)}</div>
      <h3>材料</h3>${ingredientsTable(item, editing)}
      <h3>手順</h3>${steps}${updated}${editBar}</div>${nav}</article>`;
}
