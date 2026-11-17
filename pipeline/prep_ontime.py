"""Q6 step 1: aggregate BTS On-Time Performance flights to destination airport x carrier x month.

Run from the repository root:
    python pipeline/download_ontime.py  RAW_DIR      # 132 monthly zips, 2015-2025, about 3.5 GB
    python pipeline/prep_ontime.py      RAW_DIR

RAW_DIR holds the monthly BTS zips as downloaded (On_Time_Reporting_Carrier_On_Time_Performance_1987_present_YYYY_M.zip);
they are read without unzipping. Each file's aggregate is cached in RAW_DIR/_agg/ so a rerun only reads new files.
Writes Dashboard/src/data/q6_ontime_dest_carrier_month.csv

Definitions
- Arrival outcomes are attributed to the DESTINATION airport, where the flight landed (DestAirportID).
- Valid arrival = not cancelled, not diverted, and ArrDelay recorded. A missing ArrDelay is never treated as zero.
- On time = ArrDelay < 15 minutes (the BTS definition).
- Delay-cause minutes (carrier, weather, NAS = air traffic system, security, late aircraft) are reported by BTS only for
  flights that arrived 15 or more minutes late; they are summed here, never averaged, so later rates are weighted.
- scheduled_flights counts every reported flight (including cancelled and diverted ones) and is kept so coverage
  and cancellation rates can be shown; it is not the T-100 performed-departures count.
"""
import re
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Dashboard" / "src" / "data" / "q6_ontime_dest_carrier_month.csv"
FIRST, LAST = 2015, 2025

READ = {"Year": "Int64", "Month": "Int64", "DestAirportID": "Int64", "Dest": "string",
        "DOT_ID_Reporting_Airline": "Int64", "Reporting_Airline": "string",
        "ArrDelay": "float64", "Cancelled": "float64", "Diverted": "float64",
        "CarrierDelay": "float64", "WeatherDelay": "float64", "NASDelay": "float64",
        "SecurityDelay": "float64", "LateAircraftDelay": "float64"}
CAUSES = {"CarrierDelay": "carrier_delay_min", "WeatherDelay": "weather_delay_min", "NASDelay": "nas_delay_min",
          "SecurityDelay": "security_delay_min", "LateAircraftDelay": "late_aircraft_delay_min"}
KEYS = ["year", "month", "dest_airport_id", "airport", "carrier_id", "carrier_code"]
SUMS = ["scheduled_flights", "cancelled_flights", "diverted_flights", "valid_arrivals", "ontime_arrivals",
        "delayed_15plus", "arrival_delay_sum_min", *CAUSES.values()]


def aggregate(path: Path) -> pd.DataFrame:
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        df = pd.read_csv(z.open(name), usecols=list(READ), dtype=READ)
    df = df.rename(columns={"Year": "year", "Month": "month", "DestAirportID": "dest_airport_id", "Dest": "airport",
                            "DOT_ID_Reporting_Airline": "carrier_id", "Reporting_Airline": "carrier_code"})
    missing_keys = df[["year", "month", "dest_airport_id", "carrier_id"]].isna().any(axis=1)
    assert not missing_keys.any(), f"{path.name}: {int(missing_keys.sum())} rows without year/month/airport/carrier"
    valid = df.Cancelled.eq(0) & df.Diverted.eq(0) & df.ArrDelay.notna()
    df["scheduled_flights"] = 1
    df["cancelled_flights"] = df.Cancelled.eq(1).astype("int64")
    df["diverted_flights"] = df.Diverted.eq(1).astype("int64")
    df["valid_arrivals"] = valid.astype("int64")
    df["ontime_arrivals"] = (valid & df.ArrDelay.lt(15)).astype("int64")
    df["delayed_15plus"] = (valid & df.ArrDelay.ge(15)).astype("int64")
    df["arrival_delay_sum_min"] = df.ArrDelay.where(valid, 0.0)
    for src, dst in CAUSES.items():
        # Causes are blank for on-time flights (no cause to report), so a blank here is a true zero contribution.
        df[dst] = df[src].where(valid, 0.0).fillna(0.0)
    return df.groupby(KEYS, as_index=False)[SUMS].sum()


def cached(path: Path) -> Path:
    cache = path.parent / "_agg" / (path.stem + ".csv")
    if not cache.exists():
        cache.parent.mkdir(exist_ok=True)
        tmp = cache.with_suffix(".tmp")
        aggregate(path).to_csv(tmp, index=False)
        tmp.replace(cache)
    return cache


def year_month(path: Path):
    y, m = map(int, re.search(r"_(\d{4})_(\d{1,2})\.zip$", path.name).groups())
    return y, m


if __name__ == "__main__":
    raw = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "raw_data" / "on_time"
    files = sorted((p for p in raw.glob("*.zip") if FIRST <= year_month(p)[0] <= LAST), key=year_month)
    print(f"{len(files)} monthly files in {raw}")
    with ProcessPoolExecutor(max_workers=4) as ex:
        caches = list(ex.map(cached, files))
    df = pd.concat([pd.read_csv(c) for c in caches], ignore_index=True)
    assert not df.duplicated(KEYS).any(), "the same month appears in two files"
    df = df.sort_values(KEYS)
    df.to_csv(OUT, index=False)
    months = df.groupby("year").month.nunique()
    print(f"{OUT.name}: {len(df):,} rows")
    print(pd.DataFrame({"months": months, "flights": df.groupby("year").scheduled_flights.sum()}).to_string())
    incomplete = months[months < 12]
    if len(incomplete):
        print("WARNING: years with fewer than 12 months:", incomplete.to_dict())
