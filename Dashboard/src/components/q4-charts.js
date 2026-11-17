// Q4 charts: diverging ranked bars of change in active nonstop destinations, and the national routes trend.
import * as d3 from "npm:d3";
import {bindTip, chartFrame, fmt, hBar} from "./viz.js";

/**
 * Diverging ranked bar chart.
 * rows: airports with service in both years, already ordered (gainers first, then losers), each with
 *   airport, city, destinations_2015, nonstop_destinations, change_from_2015, pct_change_from_2015.
 */
export function divergingBars(rows, {year, width}) {
  const frame = chartFrame();
  const narrow = width < 560;
  const rowH = 26, barH = 16;
  const margin = {top: 34, right: narrow ? 40 : 128, bottom: 36, left: narrow ? 52 : 200};
  const valueText = (d) => narrow ? fmt.signedInt(d.change_from_2015)
    : `${fmt.signedInt(d.change_from_2015)}  (${d.destinations_2015} to ${d.nonstop_destinations})`;
  // Room left of the zero line for the labels of losing airports.
  const lossPad = rows.some((d) => d.change_from_2015 < 0) ? (narrow ? 34 : 112) : 0;
  const height = margin.top + margin.bottom + rows.length * rowH + 12;
  const maxAbs = d3.max(rows, (d) => Math.abs(d.change_from_2015)) ?? 1;
  const minChange = Math.min(0, d3.min(rows, (d) => d.change_from_2015) ?? 0);
  const maxChange = Math.max(0, d3.max(rows, (d) => d.change_from_2015) ?? 0);
  // One shared scale with zero inside, so gains and losses are directly comparable bar for bar.
  const x = d3.scaleLinear()
    .domain([Math.min(minChange, -maxAbs * 0.12), Math.max(maxChange, maxAbs * 0.12)])
    .range([margin.left + lossPad, width - margin.right]).nice();
  const gainers = rows.filter((d) => d.change_from_2015 > 0).length;
  const y = (i) => margin.top + i * rowH + (i >= gainers && gainers > 0 ? 12 : 0);

  const svg = d3.create("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width)
    .attr("role", "img")
    .attr("aria-label", `Change in active nonstop destinations, ${year} versus 2015, for the biggest gainers and losers`);

  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 90).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 90).tickFormat(fmt.signedInt));
  svg.append("text").attr("class", "axis-title").attr("x", x(0)).attr("y", height - 4).attr("text-anchor", "middle")
    .text(`Change in active nonstop destinations, 2015 to ${year}`);
  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", margin.top - 8).attr("y2", height - margin.bottom)
    .style("stroke", "var(--viz-ink-2)").attr("stroke-width", 1);
  svg.append("text").attr("class", "label-2").attr("x", x(0) + 6).attr("y", margin.top - 14).text("Gained →");
  svg.append("text").attr("class", "label-2").attr("x", x(0) - 6).attr("y", margin.top - 14)
    .attr("text-anchor", "end").text("← Lost");

  const row = svg.append("g").selectAll("g").data(rows).join("g")
    .attr("transform", (d, i) => `translate(0,${y(i)})`);

  row.append("text").attr("class", "label").attr("x", margin.left - 10).attr("y", rowH / 2)
    .attr("dy", "0.35em").attr("text-anchor", "end").attr("font-weight", 600).text((d) => d.airport);
  if (!narrow) {
    row.append("text").attr("class", "label-2").attr("x", margin.left - 50).attr("y", rowH / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").text((d) => truncate(d.city, 22));
  }

  row.append("path")
    .attr("d", (d) => hBar(x(0), x(d.change_from_2015), (rowH - barH) / 2, barH))
    .style("fill", (d) => (d.change_from_2015 >= 0 ? "var(--viz-gain)" : "var(--viz-loss)"));

  row.append("text").attr("class", "label")
    .attr("x", (d) => x(d.change_from_2015) + (d.change_from_2015 >= 0 ? 6 : -6))
    .attr("y", rowH / 2).attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.change_from_2015 >= 0 ? "start" : "end"))
    .style("font-variant-numeric", "tabular-nums")
    .text(valueText);

  const hit = row.append("rect").attr("class", "hit").attr("x", 0).attr("width", width).attr("height", rowH)
    .attr("fill", "transparent");
  bindTip(hit, frame, (d) => [
    `${d.airport} · ${d.city}`,
    [
      {key: "Destinations in 2015", value: fmt.int(d.destinations_2015)},
      {key: `Destinations in ${year}`, value: fmt.int(d.nonstop_destinations)},
      {key: "Change", value: fmt.signedInt(d.change_from_2015)},
      {key: "Percent change", value: `${fmt.signedPct1(d.pct_change_from_2015)}%`}
    ],
    "A destination counts when the route had at least 52 performed departures that year."
  ], (event) => d3.select(event.currentTarget).attr("fill", "var(--viz-grid)").attr("fill-opacity", 0.5),
     (event) => d3.select(event.currentTarget).attr("fill", "transparent"));

  frame.root.prepend(svg.node());
  return frame.root;
}

/** National active nonstop routes per year, with the selected year marked. One series, so no legend. */
export function routesTrend(national, {year, width}) {
  const frame = chartFrame();
  const height = 200;
  const margin = {top: 22, right: 24, bottom: 28, left: 52};
  const x = d3.scaleLinear().domain(d3.extent(national, (d) => d.year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(national, (d) => d.active_nonstop_routes)]).nice()
    .range([height - margin.bottom, margin.top]);

  const svg = d3.create("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width)
    .attr("role", "img").attr("aria-label", "Active nonstop routes nationwide, 2015 to 2025");
  svg.append("g").attr("class", "grid").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.min(11, width / 60)).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")))
    .call((g) => g.select(".domain").remove());

  svg.append("path").datum(national)
    .attr("d", d3.area().x((d) => x(d.year)).y0(y(0)).y1((d) => y(d.active_nonstop_routes)))
    .style("fill", "var(--viz-s1)").attr("fill-opacity", 0.1);
  svg.append("path").datum(national)
    .attr("d", d3.line().x((d) => x(d.year)).y((d) => y(d.active_nonstop_routes)))
    .attr("fill", "none").style("stroke", "var(--viz-s1)").attr("stroke-width", 2)
    .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");

  const sel = national.find((d) => d.year === year);
  for (const d of [national[0], sel]) {
    if (!d) continue;
    svg.append("circle").attr("cx", x(d.year)).attr("cy", y(d.active_nonstop_routes)).attr("r", 5)
      .style("fill", "var(--viz-s1)").style("stroke", "var(--viz-surface)").attr("stroke-width", 2);
    svg.append("text").attr("class", "label").attr("x", x(d.year)).attr("y", y(d.active_nonstop_routes) - 10)
      .attr("text-anchor", d.year === national[0].year ? "start" : d.year === 2025 ? "end" : "middle")
      .text(fmt.int(d.active_nonstop_routes));
  }

  // Crosshair: snap to the nearest year anywhere over the plot.
  const cross = svg.append("line").attr("y1", margin.top).attr("y2", height - margin.bottom)
    .style("stroke", "var(--viz-ink-2)").attr("stroke-width", 1).attr("visibility", "hidden");
  svg.append("rect").attr("x", margin.left).attr("y", margin.top).attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom).attr("fill", "transparent")
    .on("pointermove", (event) => {
      const yr = Math.round(x.invert(d3.pointer(event)[0]));
      const d = national.find((n) => n.year === yr);
      if (!d) return;
      cross.attr("x1", x(yr)).attr("x2", x(yr)).attr("visibility", "visible");
      frame.show(event, String(yr), [
        {key: "Active nonstop routes", value: fmt.int(d.active_nonstop_routes)},
        {key: "Change vs. 2015", value: `${fmt.signedInt(d.routes_change_from_2015)} (${fmt.signedPct1(d.routes_pct_change_from_2015)}%)`},
        {key: "Airports with an active route", value: fmt.int(d.airports_with_service)}
      ]);
    })
    .on("pointerleave", () => { cross.attr("visibility", "hidden"); frame.hide(); });

  frame.root.prepend(svg.node());
  return frame.root;
}

function truncate(s, n) {
  return s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? "";
}
