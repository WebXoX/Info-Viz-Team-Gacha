"""Re-run the notebook's Q4, Q5, Q6 and Q7 cells on the processed tables already in the repository.

Run from the repository root, after prep_q4_q5.py and prep_ontime.py:
    python pipeline/refresh_notebook_tables.py

Why: the full notebook needs the raw T-100 files (several GB, not in the repository). The Q4-Q7 cells only need tables
the notebook made earlier, so this script executes those cells' own code (read from Gacha_EDA_DATA_PREP.ipynb) with:
  f, raw         <- Dashboard/src/data/q4_routes.csv (route x year totals; summing them again changes nothing)
  airport_year   <- Dashboard/src/data/shared_airport_year_F.csv (the notebook's airport x year table)
  Q6 monthly sums <- Dashboard/src/data/q6_ontime_dest_carrier_month.csv (prep_ontime.py: the same destination x
                    airline x month sums that the notebook's Q6 step 1 builds from the raw monthly files)

Only tables a page reads are written (to Dashboard/src/data/, with the notebook's file names): q7_airport_year_exploratory.
Tables that pipeline/prep_q4_q5.py also writes (q4_routes, q5_airport_year_tier) are compared instead, so the two code
paths are checked against each other. The notebook's other tables are computed but not saved, because no page uses them.
The notebook's output/samples/ extracts are not touched: they are the Milestone 2 record linked from MILESTONE2.md.
"""
import io
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "Dashboard" / "src" / "data"
NOTEBOOK = ROOT / "Gacha_EDA_DATA_PREP.ipynb"
WRITE = {"q7_airport_year_exploratory"}
COMPARE = {"q4_routes", "q5_airport_year_tier"}

cells = [''.join(c["source"]) for c in json.loads(NOTEBOOK.read_text(encoding="utf8"))["cells"]
         if c["cell_type"] == "code"]


def cell(prefix):
    hits = [c for c in cells if c.startswith(prefix)]
    assert len(hits) == 1, f"expected one notebook cell starting with {prefix!r}, found {len(hits)}"
    return hits[0]


written = []


def export(name, data, preview_sort=None):
    """Same contract as the notebook's export(), writing into Dashboard/src/data (no samples)."""
    if data is None or data.empty:
        print(f"{name}: no rows, no output generated")
        return None
    if preview_sort:
        data = data.sort_values(preview_sort)
    text = data.to_csv(index=False)
    target = DATA / f"{name}.csv"
    if name in COMPARE:
        pd.testing.assert_frame_equal(pd.read_csv(target), pd.read_csv(io.StringIO(text)), check_dtype=False)
        print(f"{name}: {len(data):,} rows, identical to the pipeline's file")
    elif name in WRITE:
        target.write_text(text, encoding="utf8", newline="")
        written.append(name)
        print(f"{name}: {len(data):,} rows written")
    else:
        print(f"{name}: {len(data):,} rows, not saved (no page uses it)")
    return data


ns = {
    "np": np, "pd": pd, "Path": Path, "display": lambda *a, **k: None, "export": export,
    "ANALYSIS_START_YEAR": 2015, "ANALYSIS_END_YEAR": 2025,
    # No raw On-Time folder here, so the Q6 step 1 cell defines its functions and reads nothing.
    "DATA_DIR": ROOT / "__no_raw_data__",
}
routes = pd.read_csv(DATA / "q4_routes.csv")
ns.update(raw=routes, f=routes, airport_year=pd.read_csv(DATA / "shared_airport_year_F.csv"))

exec(cell("# Active route (Q4 and Q7)"), ns)
exec(cell("# Q5: FAA-style hub tiers"), ns)

ns["ONTIME_DIR_OPTIONS"] = []
step1 = cell("# Q6 step 1").replace(
    "ONTIME_DIR = next((folder for folder in ONTIME_DIR_OPTIONS if folder.is_dir()), ONTIME_DIR_OPTIONS[0])",
    "ONTIME_DIR = DATA_DIR")
exec(step1, ns)
assert ns["q6_month_additive"].empty, "the Q6 step 1 cell unexpectedly read raw files"
monthly = pd.read_csv(DATA / "q6_ontime_dest_carrier_month.csv").rename(columns={
    "dest_airport_id": "airport_id", "scheduled_flights": "reported_flights", "valid_arrivals": "valid_arrival_flights",
    "arrival_delay_sum_min": "arrival_delay_sum", "carrier_delay_min": "carrier_delay_min_sum",
    "weather_delay_min": "weather_delay_min_sum", "nas_delay_min": "nas_delay_min_sum",
    "security_delay_min": "security_delay_min_sum", "late_aircraft_delay_min": "late_aircraft_delay_min_sum"})
keys, additive = ns["OTP_KEYS"], ns["OTP_ADDITIVE"]
ns["q6_month_additive"] = monthly.groupby(keys, as_index=False)[additive].sum()
ns["coverage"] = set(map(tuple, monthly[["year", "month"]].drop_duplicates().astype(int).values.tolist()))
exec(cell("# Q6 step 2"), ns)

exec(cell("q7 = airport_year[['year','airport_id','airport','passengers','seats']]"), ns)

# Checks against the page tables.
q7 = pd.read_csv(DATA / "q7_airport_year_exploratory.csv")
q4 = pd.read_csv(DATA / "q4_airport_year.csv").set_index(["year", "airport_id"]).nonstop_destinations
both = q7.set_index(["year", "airport_id"]).loc[q4.index, "nonstop_destinations"]
assert (both == q4).all(), "Q7 destination counts differ from Q4"
atl = q7[(q7.airport == "ATL") & (q7.year == 2025)].iloc[0]
print(f"ATL 2025: {int(atl.nonstop_destinations)} destinations, average arrival delay {atl.avg_arrival_delay_min:.2f} min")
print("written:", ", ".join(written))
