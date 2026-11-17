// Shared helpers for the Q4-Q6 pages: tooltip, legend, table view, code view, rounded bar ends.
import * as d3 from "npm:d3";

export const fmt = {
  int: d3.format(","),
  signedInt: (v) => (v === 0 ? "0" : d3.format("+,")(v)),
  pct1: d3.format(".1f"),
  signedPct1: d3.format("+.1f"),
  signedPp2: (v) => (Math.abs(v) < 0.005 ? "0.00" : d3.format("+.2f")(v))
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** A chart container with a tooltip that stays inside it. rows: [{key, value, color?, dash?}] */
export function chartFrame() {
  const root = el("div", "viz-chart");
  const tip = el("div", "viz-tip");
  tip.setAttribute("role", "tooltip");
  root.append(tip);

  function place(event) {
    const box = root.getBoundingClientRect();
    let x, y;
    if (event && event.clientX != null && event.type !== "focus") {
      x = event.clientX - box.left; y = event.clientY - box.top;
    } else {
      const r = event.target.getBoundingClientRect();
      x = r.left + r.width / 2 - box.left; y = r.top - box.top;
    }
    const left = x + 14 + tip.offsetWidth > box.width ? x - 14 - tip.offsetWidth : x + 14;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
  }

  function show(event, title, rows, note) {
    tip.replaceChildren(el("div", "t-title", title));
    for (const r of rows) {
      const row = el("div", "t-row");
      const key = el("span", "t-key");
      if (r.color) {
        const swatch = el("i");
        swatch.style.background = r.color;
        key.append(swatch);
      }
      key.append(document.createTextNode(r.key));
      row.append(key, el("span", "t-val", r.value));
      tip.append(row);
    }
    if (note) tip.append(el("div", "t-note", note));
    tip.style.display = "block";
    place(event);
  }

  const hide = () => (tip.style.display = "none");
  return {root, show, move: place, hide};
}

/** Wire hover + keyboard focus on a d3 selection of hit targets. content(d) -> [title, rows, note] */
export function bindTip(selection, frame, content, onEnter, onLeave) {
  selection
    .attr("tabindex", 0)
    .on("pointerenter focus", (event, d) => { frame.show(event, ...content(d)); onEnter?.(event, d); })
    .on("pointermove", (event) => frame.move(event))
    .on("pointerleave blur", (event, d) => { frame.hide(); onLeave?.(event, d); });
}

/** Static legend. items: [{label, color, shape: "rect" | "line", dash?}] */
export function legend(items) {
  const box = el("div", "viz-legend");
  for (const it of items) {
    const item = el("span", "item");
    item.append(swatch(it), document.createTextNode(it.label));
    box.append(item);
  }
  return box;
}

export function swatch({color, shape = "rect", dash, symbol}) {
  if (shape === "rect") {
    const s = el("span", "key-rect");
    s.style.background = color;
    return s;
  }
  const svg = d3.create("svg").attr("width", 26).attr("height", 12).attr("aria-hidden", true);
  svg.append("line").attr("x1", 1).attr("x2", 25).attr("y1", 6).attr("y2", 6)
    .style("stroke", color).attr("stroke-width", 2).attr("stroke-dasharray", dash ?? null);
  if (symbol) svg.append("path").attr("d", d3.symbol(symbol, 40)()).attr("transform", "translate(13,6)")
    .style("fill", color).style("stroke", "var(--viz-surface)").attr("stroke-width", 1.5);
  return svg.node();
}

/** A collapsible table view so every value is reachable without hovering. columns: [{label, value: d => text}] */
export function tableView(summary, rows, columns) {
  const details = el("details", "viz-details");
  details.append(el("summary", null, summary));
  const scroll = el("div", "scroll");
  const table = el("table");
  const head = el("tr");
  for (const c of columns) head.append(el("th", null, c.label));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);
  for (const r of rows) {
    const tr = el("tr");
    for (const c of columns) tr.append(el("td", null, c.value(r)));
    table.tBodies[0].append(tr);
  }
  scroll.append(table);
  details.append(scroll);
  return details;
}

/** Collapsible source listing for the write-up ("show the D3 code"). */
export function codeView(summary, source) {
  const details = el("details", "viz-details");
  const pre = el("pre");
  pre.append(el("code", null, source));
  details.append(el("summary", null, summary), pre);
  return details;
}

/** Horizontal bar from the baseline x0 to x1, square at the baseline, 4px round at the data end. */
export function hBar(x0, x1, y, h, r = 4) {
  const dir = x1 >= x0 ? 1 : -1;
  const len = Math.abs(x1 - x0);
  const rr = Math.min(r, len, h / 2);
  const end = x1;
  const p = d3.path();
  p.moveTo(x0, y);
  p.lineTo(end - dir * rr, y);
  p.arcTo(end, y, end, y + rr, rr);
  p.lineTo(end, y + h - rr);
  p.arcTo(end, y + h, end - dir * rr, y + h, rr);
  p.lineTo(x0, y + h);
  p.closePath();
  return p.toString();
}

/** Spread labels vertically so they never overlap; returns new y per item (keeps order). */
export function dodge(ys, gap, min, max) {
  const order = ys.map((y, i) => ({y, i})).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; ++k) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = order.length ? order[order.length - 1].y - max : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (let k = 0; k < order.length; ++k) order[k].y = Math.max(order[k].y, k ? order[k - 1].y + gap : min);
  const out = [];
  for (const o of order) out[o.i] = o.y;
  return out;
}
