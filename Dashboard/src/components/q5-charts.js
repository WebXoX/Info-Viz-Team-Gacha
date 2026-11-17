// Q5 chart: change in each airport group's share of national passengers since 2015, plus the data helpers.
import * as d3 from "npm:d3";
import {chartFrame, dodge, fmt} from "./viz.js";

export const TIERS = ["Large hub", "Medium hub", "Small & non-hub"];
export const TOP = "Top 10 busiest airports";
export const SERIES = [
  {name: "Large hub", color: "var(--viz-s1)", symbol: d3.symbolCircle},
  {name: "Medium hub", color: "var(--viz-s2)", symbol: d3.symbolSquare},
  {name: "Small & non-hub", color: "var(--viz-s3)", symbol: d3.symbolTriangle},
  {name: TOP, color: "var(--viz-s4)", symbol: d3.symbolDiamond, dash: "5 4"}
];

/**
 * Group-year rows from the airport-year tier table.
 * mode "annual": tiers and the top 10 are re-assigned every year (the default; the notebook's q5_group_year table).
 * mode "fixed": every airport keeps its 2015 tier and the top 10 is 2015's top 10, so a group's share changes only
 *   because its members' traffic changed. Airports with no passengers in 2015 join "Small & non-hub".
 */
export function groupYears(airportYears, mode) {
  const first = d3.min(airportYears, (d) => d.year);
  const base = new Map(airportYears.filter((d) => d.year === first).map((d) => [d.airport_id, d]));
  const national = d3.rollup(airportYears, (v) => d3.sum(v, (d) => d.passengers), (d) => d.year);
  const tierOf = (d) => (mode === "fixed" ? base.get(d.airport_id)?.tier ?? "Small & non-hub" : d.tier);
  const inTop = (d) => (mode === "fixed" ? (base.get(d.airport_id)?.rank_in_year ?? Infinity) <= 10 : d.rank_in_year <= 10);
  const rows = [];
  for (const [year, list] of d3.group(airportYears, (d) => d.year)) {
    for (const s of [...TIERS, TOP]) {
      const members = list.filter((d) => (s === TOP ? inTop(d) : tierOf(d) === s));
      const passengers = d3.sum(members, (d) => d.passengers);
      rows.push({year, series: s, airport_count: members.length, passengers,
        share_of_national_pct: (100 * passengers) / national.get(year)});
    }
  }
  const start = new Map(rows.filter((d) => d.year === first).map((d) => [d.series, d.share_of_national_pct]));
  for (const r of rows) r.share_change_from_2015_pp = r.share_of_national_pct - start.get(r.series);
  return rows.sort((a, b) => d3.ascending(a.year, b.year));
}

export function shareChangeChart(rows, {visible, width}) {
  const frame = chartFrame();
  const narrow = width < 600;
  const height = narrow ? 320 : 380;
  const margin = {top: 34, right: narrow ? 16 : 190, bottom: 34, left: 56};
  const shown = SERIES.filter((s) => visible.includes(s.name));
  const data = rows.filter((d) => visible.includes(d.series));
  const years = [...new Set(rows.map((d) => d.year))];
  const x = d3.scaleLinear().domain(d3.extent(years)).range([margin.left, width - margin.right]);
  const ext = d3.extent([0, ...data.map((d) => d.share_change_from_2015_pp)]);
  const y = d3.scaleLinear().domain([Math.min(ext[0], -0.5), Math.max(ext[1], 0.5)]).nice()
    .range([height - margin.bottom, margin.top]);

  const svg = d3.create("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("role", "img")
    .attr("aria-label", "Change in share of national passengers since 2015, by airport group");
  svg.append("g").attr("class", "grid").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.min(years.length, width / 60)).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat((v) => `${v > 0 ? "+" : ""}${d3.format(".1f")(v)}`))
    .call((g) => g.select(".domain").remove());
  svg.append("text").attr("class", "axis-title").attr("x", 4).attr("y", 12)
    .text("Change in share since 2015 (percentage points; 0 = the 2015 share)");
  svg.append("line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", y(0)).attr("y2", y(0))
    .style("stroke", "var(--viz-ink-2)").attr("stroke-width", 1);
  // Direction words in the left corners, where every line is still near zero.
  svg.append("text").attr("class", "label-2").attr("x", margin.left + 6).attr("y", margin.top + 12).text("↑ Gained share");
  svg.append("text").attr("class", "label-2").attr("x", margin.left + 6).attr("y", height - margin.bottom - 8).text("↓ Lost share");

  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.share_change_from_2015_pp));
  for (const s of shown) {
    const pts = data.filter((d) => d.series === s.name);
    svg.append("path").datum(pts).attr("d", line).attr("fill", "none").style("stroke", s.color)
      .attr("stroke-width", 2).attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
      .attr("stroke-dasharray", s.dash ?? null);
    svg.append("g").selectAll("path").data(pts).join("path")
      .attr("d", d3.symbol(s.symbol, 52)).attr("transform", (d) => `translate(${x(d.year)},${y(d.share_change_from_2015_pp)})`)
      .style("fill", s.color).style("stroke", "var(--viz-surface)").attr("stroke-width", 2);
  }

  // Direct labels at the right end; spread apart with leader lines when the lines converge.
  if (!narrow) {
    const last = d3.max(years);
    const ends = shown.map((s) => ({s, d: data.find((r) => r.series === s.name && r.year === last)})).filter((e) => e.d);
    const ly = dodge(ends.map((e) => y(e.d.share_change_from_2015_pp)), 30, margin.top + 8, height - margin.bottom - 20);
    ends.forEach((e, i) => {
      const x0 = x(last) + 8, x1 = x(last) + 22;
      svg.append("path").attr("d", `M${x0},${y(e.d.share_change_from_2015_pp)}L${x1},${ly[i]}`)
        .attr("fill", "none").style("stroke", "var(--viz-muted)").attr("stroke-width", 1);
      const t = svg.append("text").attr("x", x1 + 4).attr("y", ly[i]).attr("dy", "-0.15em");
      t.append("tspan").attr("class", "label").attr("font-weight", 600).text(e.s.name === TOP ? "Top 10" : e.s.name);
      t.append("tspan").attr("class", "label-2").attr("x", x1 + 4).attr("dy", "1.25em")
        .text(`${fmt.signedPp2(e.d.share_change_from_2015_pp)} pp · ${d3.format(".1f")(e.d.share_of_national_pct)}% share`);
    });
  }

  // Crosshair tooltip: every visible series at the nearest year.
  const cross = svg.append("line").attr("y1", margin.top).attr("y2", height - margin.bottom)
    .style("stroke", "var(--viz-ink-2)").attr("stroke-width", 1).attr("visibility", "hidden");
  svg.append("rect").attr("x", margin.left - 10).attr("y", margin.top).attr("width", width - margin.left - margin.right + 20)
    .attr("height", height - margin.top - margin.bottom).attr("fill", "transparent")
    .on("pointermove", (event) => {
      const yr = Math.max(years[0], Math.min(years.at(-1), Math.round(x.invert(d3.pointer(event)[0]))));
      cross.attr("x1", x(yr)).attr("x2", x(yr)).attr("visibility", "visible");
      const rowsAt = shown.map((s) => data.find((d) => d.series === s.name && d.year === yr)).filter(Boolean)
        .sort((a, b) => d3.descending(a.share_change_from_2015_pp, b.share_change_from_2015_pp));
      frame.show(event, String(yr), rowsAt.map((d) => ({
        key: `${d.series} (${d.airport_count} airports)`,
        value: `${fmt.signedPp2(d.share_change_from_2015_pp)} pp · ${d3.format(".2f")(d.share_of_national_pct)}%`,
        color: SERIES.find((s) => s.name === d.series).color
      })), "Change since 2015 in percentage points, then the share of national passengers.");
    })
    .on("pointerleave", () => { cross.attr("visibility", "hidden"); frame.hide(); });

  frame.root.prepend(svg.node());
  return frame.root;
}

/** Counts of airports by 2015 tier (rows) and tier in `year` (columns), including airports without passengers. */
export function membershipTable(airportYears, year) {
  const t15 = new Map(airportYears.filter((d) => d.year === 2015).map((d) => [d.airport_id, d.tier]));
  const tY = new Map(airportYears.filter((d) => d.year === year).map((d) => [d.airport_id, d.tier]));
  const states = [...TIERS, "No passengers"];
  const ids = new Set([...t15.keys(), ...tY.keys()]);
  const count = new Map();
  for (const id of ids) {
    const k = `${t15.get(id) ?? "No passengers"}|${tY.get(id) ?? "No passengers"}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const table = document.createElement("table");
  table.className = "viz-matrix";
  const head = table.createTHead().insertRow();
  const corner = document.createElement("th");
  corner.textContent = `2015 tier ↓  /  ${year} tier →`;
  head.append(corner);
  for (const c of states) head.append(Object.assign(document.createElement("th"), {textContent: c}));
  const body = table.createTBody();
  for (const r of states) {
    const tr = body.insertRow();
    tr.append(Object.assign(document.createElement("th"), {textContent: r}));
    for (const c of states) {
      const td = tr.insertCell();
      const n = r === "No passengers" && c === "No passengers" ? null : count.get(`${r}|${c}`) ?? 0;
      td.textContent = n == null ? "" : fmt.int(n);
      if (r === c) td.className = "same";
    }
  }
  return table;
}
