"""Q4 and Q5 D3 inputs, built from the notebook's processed T-100 tables.

Run from the repository root:   python pipeline/prep_q4_q5.py

Inputs (written by Gacha_EDA_DATA_PREP.ipynb from the raw T-100 Domestic Segment files, Class F, 2015-2025):
  Dashboard/src/data/q4_routes.csv              year x origin airport x destination airport: performed departures
  Dashboard/src/data/shared_airport_year_F.csv  year x origin airport: passengers, departures, labels

Outputs (Dashboard/src/data/, read by q4.md and q5.md):
  q4_airport_year.csv      one row per airport and year: active nonstop destinations and change since 2015
  q4_national_year.csv     one row per year: active routes nationwide, airports new or gone vs. 2015
  q5_airport_year_tier.csv one row per airport and year: share of national passengers and hub tier

Definitions (the Milestone 2 report, sections Q4 and Q5):
- Q4 active route: an origin -> destination pair with at least 52 performed departures in the calendar year
  (one a week on average; it does not prove weekly or year-round service). Routes are directional.
- Q5 tiers follow the FAA hub thresholds, re-assigned every year from that year's share of national passengers:
  large hub >= 1%, medium hub 0.25% to < 1%, small hub and non-hub (< 0.25%) merged. FAA uses enplanements;
  T-100 origin passengers (passenger segments) are the closest measure in our data.

The notebook's Q4 and Q5 cells use the same definitions since Milestone 3 (refresh_notebook_tables.py checks that the
two give identical tables). The Milestone 2 outputs, which used a 1-departure route rule and fixed 2019 terciles, are on
the data-processing branch.
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "Dashboard" / "src" / "data"

FIRST, LAST = 2015, 2025
MIN_ROUTE_DEPARTURES = 52
LARGE_SHARE, MEDIUM_SHARE = 1.0, 0.25
TOP_N = 10
TIERS = ["Large hub", "Medium hub", "Small & non-hub"]
TOP_LABEL = "Top 10 busiest airports"


def save(name, df):
    df.to_csv(DATA / f"{name}.csv", index=False)
    print(f"{name}: {len(df):,} rows")


routes = pd.read_csv(DATA / "q4_routes.csv")
airports = pd.read_csv(DATA / "shared_airport_year_F.csv")
assert routes.year.between(FIRST, LAST).all() and routes.year.nunique() == LAST - FIRST + 1
assert airports.year.between(FIRST, LAST).all() and airports.year.nunique() == LAST - FIRST + 1
assert not airports.duplicated(["year", "airport_id"]).any()

# Latest code, city and state for each airport id (codes can change over time).
labels = (airports.sort_values("year").drop_duplicates("airport_id", keep="last")
          .set_index("airport_id")[["airport", "city", "state"]])

# ------------------------------------------------------------------------------------------------ Q4
active = routes[routes.departures_performed >= MIN_ROUTE_DEPARTURES]
q4 = (active.groupby(["year", "airport_id"], as_index=False)
      .agg(nonstop_destinations=("dest_airport_id", "nunique")))
base = q4[q4.year == FIRST].set_index("airport_id").nonstop_destinations
q4["destinations_2015"] = q4.airport_id.map(base).astype("Int64")      # empty = no active route in 2015
q4["change_from_2015"] = (q4.nonstop_destinations - q4.destinations_2015).astype("Int64")
q4["pct_change_from_2015"] = (100 * q4.change_from_2015 / q4.destinations_2015).astype("Float64").round(1)
q4 = q4.join(labels, on="airport_id").sort_values(["year", "airport_id"])
save("q4_airport_year", q4[["year", "airport_id", "airport", "city", "state", "nonstop_destinations",
                            "destinations_2015", "change_from_2015", "pct_change_from_2015"]])

ids = q4.groupby("year").airport_id.agg(set)
nat4 = (q4.groupby("year", as_index=False)
        .agg(airports_with_service=("airport_id", "nunique"), active_nonstop_routes=("nonstop_destinations", "sum")))
first_routes = nat4.active_nonstop_routes.iloc[0]
nat4["routes_change_from_2015"] = nat4.active_nonstop_routes - first_routes
nat4["routes_pct_change_from_2015"] = (100 * nat4.routes_change_from_2015 / first_routes).round(1)
nat4["airports_in_both"] = [len(ids[y] & ids[FIRST]) for y in nat4.year]
nat4["airports_new_vs_2015"] = [len(ids[y] - ids[FIRST]) for y in nat4.year]
nat4["airports_gone_vs_2015"] = [len(ids[FIRST] - ids[y]) for y in nat4.year]
save("q4_national_year", nat4)
print(nat4.to_string(index=False))

# ------------------------------------------------------------------------------------------------ Q5
ay = airports[airports.passengers > 0][["year", "airport_id", "passengers"]].copy()
ay["passengers"] = ay.passengers.astype("int64")
national = ay.groupby("year").passengers.sum()
ay["share_of_national_pct"] = 100 * ay.passengers / ay.year.map(national)
ay["tier"] = np.select([ay.share_of_national_pct >= LARGE_SHARE, ay.share_of_national_pct >= MEDIUM_SHARE],
                       TIERS[:2], default=TIERS[2])
ay["rank_in_year"] = ay.groupby("year").passengers.rank(ascending=False, method="first").astype(int)
ay = ay.join(labels, on="airport_id").sort_values(["year", "rank_in_year"])
ay["share_of_national_pct"] = ay.share_of_national_pct.round(4)
save("q5_airport_year_tier", ay[["year", "airport_id", "airport", "city", "state", "passengers",
                                 "share_of_national_pct", "rank_in_year", "tier"]])

q5 = (ay.groupby(["year", "tier"], as_index=False)
      .agg(airport_count=("airport_id", "nunique"), passengers=("passengers", "sum"))
      .rename(columns={"tier": "series"}))
top = (ay[ay.rank_in_year <= TOP_N].groupby("year", as_index=False)
       .agg(airport_count=("airport_id", "nunique"), passengers=("passengers", "sum")))
top["series"] = TOP_LABEL
q5 = pd.concat([q5, top], ignore_index=True)
q5["share_of_national_pct"] = (100 * q5.passengers / q5.year.map(national)).round(2)
q5["share_change_from_2015_pp"] = (
    q5.share_of_national_pct - q5.series.map(q5[q5.year == FIRST].set_index("series").share_of_national_pct)
).round(2)
order = {s: i for i, s in enumerate(TIERS + [TOP_LABEL])}
q5 = q5.sort_values(["year", "series"], key=lambda c: c.map(order) if c.name == "series" else c)
# Group totals are computed on the Q5 page from q5_airport_year_tier.csv; printed here as a check.
print(q5.pivot(index="year", columns="series", values="share_of_national_pct").to_string())
