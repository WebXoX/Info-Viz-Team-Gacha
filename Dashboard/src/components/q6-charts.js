// Q6 charts: View 1, traffic change vs. on-time change (scatter); View 2, delay minutes per flight by cause (stacked bars).
import * as d3 from "npm:d3";
import {bindTip, chartFrame, fmt} from "./viz.js";

export const CAUSES = [
  {key: "carrier_min_per_flight", label: "Airline (carrier)", color: "var(--viz-s1)"},
  {key: "late_aircraft_min_per_flight", label: "Late incoming aircraft", color: "var(--viz-s2)"},
  {key: "nas_min_per_flight", label: "Air traffic system (NAS)", color: "var(--viz-s3)"},
  {key: "weather_min_per_flight", label: "Weather", color: "var(--viz-s4)"},
  {key: "security_min_per_flight", label: "Security", color: "var(--viz-s5)"}
];

const X_CAP = 50; // percent; airports beyond it are drawn at the edge with their value, so one outlier does not squash the rest

/** View 1. rows: q6_airport_change.csv rows with included === true. */
export function paceScatter(rows, {width, labelled}) {
  const frame = chartFrame();
  const narrow = width < 600;
  const height = narrow ? 360 : 460;
  const margin = {top: 30, right: narrow ? 30 : 56, bottom: 64, left: 56};
  const xMin = Math.min(-40, d3.min(rows, (d) => d.traffic_change_pct));
  const x = d3.scaleLinear().domain([xMin, X_CAP]).range([margin.left, width - margin.right]).nice();
  const yExt = d3.extent(rows, (d) => d.on_time_change_pp);
  const y = d3.scaleLinear().domain([Math.min(-10, yExt[0]), Math.max(4, yExt[1])]).nice()
    .range([height - margin.bottom, margin.top]);
  const cx = (d) => x(Math.min(d.traffic_change_pct, x.domain()[1]));
  const cy = (d) => y(d.on_time_change_pp);

  const svg = d3.create("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("role", "img")
    .attr("aria-label", "Change in performed departures versus change in on-time arrival rate, 2018 to 2025, busy airports");

  // The "on-time rate fell" region, below the zero line.
  svg.append("rect").attr("x", margin.left).attr("width", width - margin.left - margin.right)
    .attr("y", y(0)).attr("height", height - margin.bottom - y(0)).style("fill", "var(--viz-wash)");
  svg.append("g").attr("class", "grid").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 80).tickFormat((v) => `${v > 0 ? "+" : ""}${v}%`));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat((v) => `${v > 0 ? "+" : ""}${v}`))
    .call((g) => g.select(".domain").remove());
  svg.append("text").attr("class", "axis-title").attr("x", (margin.left + width - margin.right) / 2).attr("y", height - 8)
    .attr("text-anchor", "middle").text(narrow ? "Change in departures, 2018 to 2025" : "Change in performed departures (T-100), 2018 to 2025");
  svg.append("text").attr("class", "axis-title").attr("x", 4).attr("y", 14)
    .text("Change in on-time arrival rate (percentage points)");
  for (const [v, axis] of [[0, "y"], [0, "x"]]) {
    if (axis === "y") svg.append("line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", y(v)).attr("y2", y(v))
      .style("stroke", "var(--viz-ink-2)");
    else svg.append("line").attr("x1", x(v)).attr("x2", x(v)).attr("y1", margin.top).attr("y2", height - margin.bottom)
      .style("stroke", "var(--viz-axis)");
  }
  // Direction words on both axes, so neither sign has to be decoded from the tick labels.
  svg.append("text").attr("class", "label-2").attr("x", x(0) - 8).attr("y", height - margin.bottom + 34)
    .attr("text-anchor", "end").text("← Fewer departures");
  svg.append("text").attr("class", "label-2").attr("x", x(0) + 8).attr("y", height - margin.bottom + 34)
    .text("More departures →");
  // Right-hand corners: no airport both grew fast and improved, or fell below -9 points, so these stay clear.
  svg.append("text").attr("class", "label-2").attr("x", width - margin.right - 6).attr("y", height - margin.bottom - 8)
    .attr("text-anchor", "end").text("↓ On-time rate fell");
  svg.append("text").attr("class", "label-2").attr("x", width - margin.right - 6).attr("y", margin.top + 12)
    .attr("text-anchor", "end").text("↑ On-time rate rose");

  const dots = svg.append("g").selectAll("circle").data(rows).join("circle")
    .attr("cx", cx).attr("cy", cy).attr("r", 5.5)
    .style("fill", (d) => (d.tier_2025 === "Large hub" ? "var(--viz-s1)" : "var(--viz-surface)"))
    .style("stroke", "var(--viz-s1)").attr("stroke-width", 2);

  // Points past the cap: an arrow and the true value.
  for (const d of rows.filter((r) => r.traffic_change_pct > x.domain()[1])) {
    svg.append("text").attr("class", "label").attr("x", cx(d) - 8).attr("y", cy(d) + 18).attr("text-anchor", "end")
      .text(narrow ? `${d.airport} →` : `${d.airport} ${fmt.signedPct1(d.traffic_change_pct)}% →`);
  }
  const lab = rows.filter((d) => (narrow ? ["EWR", "DCA", "SFO"] : labelled).includes(d.airport) && d.traffic_change_pct <= x.domain()[1]);
  svg.append("g").selectAll("text").data(lab).join("text").attr("class", "label")
    .attr("x", (d) => cx(d) + (cx(d) > width - margin.right - 50 ? -9 : 9))
    .attr("text-anchor", (d) => (cx(d) > width - margin.right - 50 ? "end" : "start"))
    .attr("y", cy).attr("dy", "0.35em").attr("font-weight", 600).text((d) => d.airport);

  // Nearest-point hover over the whole plot, so a reader never has to hit an 11px dot.
  const delaunay = d3.Delaunay.from(rows, cx, cy);
  const ring = svg.append("circle").attr("r", 9).attr("fill", "none").style("stroke", "var(--viz-ink)")
    .attr("stroke-width", 1.5).attr("visibility", "hidden");
  svg.append("rect").attr("x", margin.left).attr("y", margin.top).attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom).attr("fill", "transparent")
    .on("pointermove", (event) => {
      const [px, py] = d3.pointer(event);
      const i = delaunay.find(px, py);
      const d = rows[i];
      if (Math.hypot(cx(d) - px, cy(d) - py) > 40) { ring.attr("visibility", "hidden"); frame.hide(); return; }
      ring.attr("cx", cx(d)).attr("cy", cy(d)).attr("visibility", "visible");
      frame.show(event, `${d.airport} · ${d.city}`, [
        {key: "Group in 2025", value: d.tier_2025},
        {key: "Departures 2018 → 2025", value: `${fmt.int(d.departures_performed_2018)} → ${fmt.int(d.departures_performed_2025)}`},
        {key: "Traffic change", value: `${fmt.signedPct1(d.traffic_change_pct)}%`},
        {key: "On-time 2018 → 2025", value: `${d3.format(".1f")(d.on_time_rate_pct_2018)}% → ${d3.format(".1f")(d.on_time_rate_pct_2025)}%`},
        {key: "On-time change", value: `${fmt.signedPp2(d.on_time_change_pp)} pp`},
        {key: "On-time data coverage", value: `${d.coverage_pct_2018}% / ${d.coverage_pct_2025}%`}
      ], "Coverage = arrivals with on-time data / T-100 departures, 2018 / 2025.");
    })
    .on("pointerleave", () => { ring.attr("visibility", "hidden"); frame.hide(); });

  frame.root.prepend(svg.node());
  return frame.root;
}

/** View 2. rows: q6_airport_delays.csv or q6_carrier_delays.csv rows, ranked; name(d) gives the row label. */
export function causeBars(rows, {width, name, detail}) {
  const frame = chartFrame();
  const narrow = width < 640;
  const rowH = 28, barH = 18, gap = 2;
  const margin = {top: 8, right: narrow ? 46 : 250, bottom: 40, left: narrow ? 70 : 180};
  const height = margin.top + margin.bottom + rows.length * rowH;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.delay_min_per_flight)]).nice()
    .range([margin.left, width - margin.right]);

  const svg = d3.create("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("role", "img")
    .attr("aria-label", "Arrival delay minutes per flight by cause, 2025");
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 100).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 100));
  svg.append("text").attr("class", "axis-title").attr("x", margin.left).attr("y", height - 6)
    .text(narrow ? "Delay minutes per arriving flight, 2025" : "Delay minutes per arriving flight, 2025 (all valid arrivals, on time or not)");

  const row = svg.append("g").selectAll("g").data(rows).join("g")
    .attr("transform", (d, i) => `translate(0,${margin.top + i * rowH})`);
  row.append("text").attr("class", "label").attr("x", margin.left - 8).attr("y", rowH / 2).attr("dy", "0.35em")
    .attr("text-anchor", "end").text((d) => name(d, narrow));

  // Segments in a fixed order so one cause can be compared down the bars; 2px surface gap between segments.
  row.each(function (d) {
    const g = d3.select(this);
    let acc = 0;
    const segs = CAUSES.map((c) => {
      const s = {c, v: d[c.key], x0: acc};
      acc += d[c.key];
      return s;
    }).filter((s) => s.v > 0);
    segs.forEach((s, i) => {
      const last = i === segs.length - 1;
      const x0 = x(s.x0) + (i ? gap / 2 : 0);
      const x1 = x(s.x0 + s.v) - (last ? 0 : gap / 2);
      if (x1 - x0 < 0.5) return;
      const r = last ? Math.min(4, x1 - x0) : 0;
      g.append("path").style("fill", s.c.color)
        .attr("d", `M${x0},${(rowH - barH) / 2}H${x1 - r}${r ? `a${r},${r} 0 0 1 ${r},${r}` : ""}V${(rowH + barH) / 2 - r}${r ? `a${r},${r} 0 0 1 ${-r},${r}` : ""}H${x0}Z`);
    });
  });

  row.append("text").attr("class", "label").attr("x", (d) => x(d.delay_min_per_flight) + 6).attr("y", rowH / 2)
    .attr("dy", "0.35em").style("font-variant-numeric", "tabular-nums")
    .text((d) => narrow ? d3.format(".1f")(d.delay_min_per_flight)
      : `${d3.format(".1f")(d.delay_min_per_flight)} min · ${d3.format(".1f")(d.on_time_rate_pct)}% on time · worst ${d.worst_month} (${d3.format(".1f")(d.worst_month_delay_min_per_flight)})`);

  const hit = row.append("rect").attr("class", "hit").attr("width", width).attr("height", rowH).attr("fill", "transparent");
  bindTip(hit, frame, (d) => [
    `#${d.rank_most_delay_prone} ${name(d, false)}`,
    [
      {key: "Delay minutes per flight", value: d3.format(".2f")(d.delay_min_per_flight)},
      ...CAUSES.map((c) => ({key: c.label, value: d3.format(".2f")(d[c.key]), color: c.color})),
      {key: "On-time arrival rate", value: `${d3.format(".1f")(d.on_time_rate_pct)}%`},
      {key: "Cancelled", value: `${d3.format(".1f")(d.cancelled_pct)}%`},
      {key: "Valid arrivals", value: fmt.int(d.valid_arrivals)},
      {key: "Worst month of 2025", value: `${d.worst_month}, ${d3.format(".1f")(d.worst_month_delay_min_per_flight)} min/flight`}
    ],
    detail
  ], (event) => d3.select(event.currentTarget).attr("fill", "var(--viz-grid)").attr("fill-opacity", 0.45),
     (event) => d3.select(event.currentTarget).attr("fill", "transparent"));

  frame.root.prepend(svg.node());
  return frame.root;
}
