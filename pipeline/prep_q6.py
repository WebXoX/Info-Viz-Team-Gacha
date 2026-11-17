"""Q6 step 2: the tables behind the two Q6 views.

Run after prep_q4_q5.py and prep_ontime.py, from the repository root:   python pipeline/prep_q6.py

Inputs (Dashboard/src/data/):
  q6_ontime_dest_carrier_month.csv   prep_ontime.py: destination airport x carrier x month, counts and minute sums
  q5_airport_year_tier.csv           prep_q4_q5.py: hub tier per airport and year (defines "busy" airports)
  shared_airport_year_F.csv          notebook: T-100 Class F performed departures per airport and year
  Domestic Segment data/*.csv        raw T-100 file in the repo, used only for carrier names
Outputs (Dashboard/src/data/, read by q6.md):
  q6_airport_change.csv  View 1: one row per busy airport, 2018 vs. 2025 traffic and on-time rate
  q6_airport_delays.csv  View 2: one row per busy airport, 2025 delay minutes per flight by cause, worst month
  q6_carrier_delays.csv  View 2 (carrier switch): the same columns per reporting carrier

Definitions
- Busy airport: a large or medium hub in 2025 (at least 0.25% of national passengers, the Q5 tiers).
- Traffic: T-100 Class F performed departures from the airport. On-time rates come from a different source
  (BTS On-Time, reporting carriers only), so coverage = valid on-time arrivals / T-100 performed departures is
  reported, and View 1 keeps an airport only if coverage is at least 50% in both years.
- 2018 is the start year because the reporting threshold fell from 1% to 0.5% of domestic scheduled passenger
  revenue in 2018; comparing years under the same rule avoids a reporting artifact. The reporting carriers can
  still differ between years, so coverage is shown next to every rate.
- Delay minutes per flight = sum of the five BTS cause minutes / valid arrivals (ratios of sums, so weighted).
  Causes describe the late flight, not where the delay started.
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "Dashboard" / "src" / "data"
CAUSE = ["carrier_delay_min", "late_aircraft_delay_min", "nas_delay_min", "weather_delay_min", "security_delay_min"]
PER_FLIGHT = [c.replace("_delay_min", "_min_per_flight") for c in CAUSE]
ADD = ["scheduled_flights", "cancelled_flights", "valid_arrivals", "ontime_arrivals", "arrival_delay_sum_min", *CAUSE]
START, END = 2018, 2025
MIN_COVERAGE = 50.0
MIN_CARRIER_FLIGHTS = 50_000
MIN_MONTH_FLIGHTS = 500
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

ot = pd.read_csv(DATA / "q6_ontime_dest_carrier_month.csv")
tier = pd.read_csv(DATA / "q5_airport_year_tier.csv")
t100 = pd.read_csv(DATA / "shared_airport_year_F.csv")[["year", "airport_id", "departures_performed"]]
for y in (START, END):
    n = ot[ot.year == y].month.nunique()
    assert n == 12, f"{y} has {n} months of on-time data; download the missing months first"
assert ot.groupby("dest_airport_id").airport.nunique().max() == 1, "an airport id with two codes"

raw_t100 = sorted((ROOT / "Domestic Segment data").glob("*.csv"))
names = (pd.concat(pd.read_csv(p, usecols=["AIRLINE_ID", "UNIQUE_CARRIER_NAME"]) for p in raw_t100)
         .dropna().drop_duplicates("AIRLINE_ID", keep="last")
         .set_index("AIRLINE_ID").UNIQUE_CARRIER_NAME)
# Carriers that no longer file T-100 under their own name in the repo's raw file (Hawaiian merged into Alaska).
NAME_BY_CODE = {"HA": "Hawaiian Airlines Inc."}


def write(name, df):
    df.to_csv(DATA / f"{name}.csv", index=False)
    print(f"{name}: {len(df):,} rows")


def with_rates(g):
    g = g[g.valid_arrivals > 0].copy()
    g["on_time_rate_pct"] = (100 * g.ontime_arrivals / g.valid_arrivals).round(2)
    g["cancelled_pct"] = (100 * g.cancelled_flights / g.scheduled_flights).round(2)
    g["delay_min_per_flight"] = (g[CAUSE].sum(axis=1) / g.valid_arrivals).round(2)
    for c, p in zip(CAUSE, PER_FLIGHT):
        g[p] = (g[c] / g.valid_arrivals).round(2)
    return g


def worst_month(df, key):
    """Month of END with the most delay minutes per flight, per key (months with too few flights are skipped)."""
    m = df[df.year == END].groupby([key, "month"], as_index=False)[ADD].sum()
    m = m[m.valid_arrivals >= MIN_MONTH_FLIGHTS]
    m["m_delay"] = m[CAUSE].sum(axis=1) / m.valid_arrivals
    w = m.sort_values("m_delay", ascending=False).drop_duplicates(key).set_index(key)
    return pd.DataFrame({"worst_month": w.month.map(lambda i: MONTHS[i - 1]),
                         "worst_month_delay_min_per_flight": w.m_delay.round(2)})


label = ot.drop_duplicates("dest_airport_id").set_index("dest_airport_id").airport
city = tier.drop_duplicates("airport_id", keep="last").set_index("airport_id").city
busy = tier[(tier.year == END) & tier.tier.isin(["Large hub", "Medium hub"])][["airport_id", "tier"]]
busy = busy.rename(columns={"tier": "tier_2025"})
print(f"busy airports (large or medium hub in {END}): {len(busy)}")

# ------------------------------------------------------------------------------------------------ View 1
ay = (ot[ot.year.isin([START, END])].groupby(["year", "dest_airport_id"], as_index=False)[ADD].sum()
      .rename(columns={"dest_airport_id": "airport_id"})
      .merge(t100, on=["year", "airport_id"], how="left"))
ay["coverage_pct"] = 100 * ay.valid_arrivals / ay.departures_performed
ay = with_rates(ay)
wide = ay.pivot(index="airport_id", columns="year",
                values=["departures_performed", "valid_arrivals", "coverage_pct", "on_time_rate_pct"])
wide.columns = [f"{a}_{b}" for a, b in wide.columns]
v1 = busy.merge(wide.reset_index(), on="airport_id", how="left")
v1["airport"], v1["city"] = v1.airport_id.map(label), v1.airport_id.map(city)
ok = (v1[f"coverage_pct_{START}"].ge(MIN_COVERAGE) & v1[f"coverage_pct_{END}"].ge(MIN_COVERAGE)
      & v1[f"on_time_rate_pct_{START}"].notna() & v1[f"on_time_rate_pct_{END}"].notna())
print("excluded (coverage < 50% or no on-time data in a year):", v1.loc[~ok, "airport"].fillna("?").tolist())
v1["included"] = ok
v1["traffic_change_pct"] = (100 * (v1[f"departures_performed_{END}"] / v1[f"departures_performed_{START}"] - 1)).round(1)
v1["on_time_change_pp"] = (v1[f"on_time_rate_pct_{END}"] - v1[f"on_time_rate_pct_{START}"]).round(2)
for y in (START, END):
    v1[f"coverage_pct_{y}"] = v1[f"coverage_pct_{y}"].round(1)
cols = ["airport_id", "airport", "city", "tier_2025", "included",
        f"departures_performed_{START}", f"departures_performed_{END}", "traffic_change_pct",
        f"valid_arrivals_{START}", f"valid_arrivals_{END}",
        f"on_time_rate_pct_{START}", f"on_time_rate_pct_{END}", "on_time_change_pp",
        f"coverage_pct_{START}", f"coverage_pct_{END}"]
v1 = v1[cols].sort_values("on_time_change_pp")
write("q6_airport_change", v1)
inc = v1[v1.included]
print(f"View 1: {len(inc)} airports drawn; on-time rate fell at {int((inc.on_time_change_pp < 0).sum())}")
print("correlation traffic change vs on-time change:", round(inc.traffic_change_pct.corr(inc.on_time_change_pp), 2))

# ------------------------------------------------------------------------------------------------ View 2
a = (ot[ot.year == END].groupby("dest_airport_id", as_index=False)[ADD].sum()
     .rename(columns={"dest_airport_id": "airport_id"}))
a = with_rates(busy.merge(a, on="airport_id", how="inner"))
a["airport"], a["city"] = a.airport_id.map(label), a.airport_id.map(city)
a = a.join(worst_month(ot.rename(columns={"dest_airport_id": "key"}), "key"), on="airport_id")
a = a.sort_values("delay_min_per_flight", ascending=False).reset_index(drop=True)
a.insert(0, "rank_most_delay_prone", a.index + 1)
keep = ["airport_id", "airport", "city", "tier_2025", "valid_arrivals", "on_time_rate_pct", "cancelled_pct",
        "delay_min_per_flight", *PER_FLIGHT, "worst_month", "worst_month_delay_min_per_flight"]
write("q6_airport_delays", a[["rank_most_delay_prone", *keep]])
print(a[["airport", "valid_arrivals", "on_time_rate_pct", "delay_min_per_flight", "worst_month"]].head(15).to_string())

c = ot[ot.year == END].groupby("carrier_id", as_index=False)[ADD].sum()
c = with_rates(c[c.valid_arrivals >= MIN_CARRIER_FLIGHTS])
c["carrier_code"] = c.carrier_id.map(ot.drop_duplicates("carrier_id").set_index("carrier_id").carrier_code)
c["carrier_name"] = c.carrier_id.map(names).fillna(c.carrier_code.map(NAME_BY_CODE)).fillna(c.carrier_code)
c = c.join(worst_month(ot.rename(columns={"carrier_id": "key"}), "key"), on="carrier_id")
c = c.sort_values("delay_min_per_flight", ascending=False).reset_index(drop=True)
c.insert(0, "rank_most_delay_prone", c.index + 1)
ckeep = ["rank_most_delay_prone", "carrier_id", "carrier_code", "carrier_name", "valid_arrivals", "on_time_rate_pct",
         "cancelled_pct", "delay_min_per_flight", *PER_FLIGHT, "worst_month", "worst_month_delay_min_per_flight"]
write("q6_carrier_delays", c[ckeep])
print(c[["carrier_code", "carrier_name", "valid_arrivals", "delay_min_per_flight"]].to_string())
