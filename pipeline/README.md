# Data pipeline for Q4-Q7

These scripts make the Q4-Q7 dashboard inputs from documented sources, so the D3 tables match the definitions on the pages. They answer the Milestone 2 feedback that the report's Q4-Q6 definitions differed from the notebook's outputs, and that Q7 must use the Q4 route rule.

The processing notebook (`Gacha_EDA_DATA_PREP.ipynb`) uses the same definitions since Milestone 3: an active route needs at least 52 performed departures in the year (Q4, Q7), airport groups are FAA-style hub tiers re-assigned every year (Q5), and on-time arrivals are grouped by the destination airport (Q6, Q7).

## Run

From the repository root, with Python 3.10+ and `pandas`, `numpy`, `requests`:

```
python pipeline/prep_q4_q5.py                          # seconds; needs only files already in the repo
python pipeline/download_ontime.py ../raw_data/on_time  # once; 132 zips, about 3.5 GB, 1-2 hours
python pipeline/prep_ontime.py     ../raw_data/on_time  # about 10 minutes; caches per-file results
python pipeline/prep_q6.py                             # seconds
python pipeline/refresh_notebook_tables.py             # seconds; re-runs the notebook's Q4-Q7 cells
```

The raw on-time zips stay outside the repository (they are too large for GitHub). `prep_ontime.py` reads them without unzipping.

`refresh_notebook_tables.py` exists because the full notebook needs the raw T-100 files, which are not in the repository. It runs the notebook's own Q4, Q5, Q6 and Q7 code (read from the `.ipynb`) on tables the notebook made earlier. It writes only the table a page reads (`q7_airport_year_exploratory.csv`), and checks that the notebook's `q4_routes` and `q5_airport_year_tier` are identical to the pipeline's. The notebook's other tables are computed but not saved, because no page uses them; a full notebook run still writes them to `output/processed/`.

## Inputs and sources

| Input | Where it comes from |
|---|---|
| `Dashboard/src/data/q4_routes.csv` | `Gacha_EDA_DATA_PREP.ipynb`, from the raw T-100 files: performed departures and passengers per year, origin and destination airport, Class F, 2015-2025 |
| `Dashboard/src/data/shared_airport_year_F.csv` | Same notebook: Class F passengers, departures and seats per origin airport and year, with airport code, city and state |
| BTS On-Time monthly zips | `https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_YYYY_M.zip`, the "Prezipped File" option of [Reporting Carrier On-Time Performance (1987-present)](https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ&QO_fu146_anzr=b0-gvzr). Columns used: Year, Month, DestAirportID, Dest, DOT_ID_Reporting_Airline, Reporting_Airline, ArrDelay, Cancelled, Diverted, CarrierDelay, WeatherDelay, NASDelay, SecurityDelay, LateAircraftDelay |
| Raw T-100 file in `Domestic Segment data/` | [T-100 Domestic Segment (U.S. Carriers)](https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FIM&QO_fu146_anzr=Nv4%20Pn44vr45); used by `prep_q6.py` only for airline names |

Census files used by the notebook (Q3): [NST-EST2025-ALLDATA.csv](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv) (2020-2025 state estimates) and [nst-est2020int-pop.xlsx](https://www2.census.gov/programs-surveys/popest/tables/2010-2020/intercensal/national/nst-est2020int-pop.xlsx) (2010-2020 intercensal state estimates).

## Data files in `Dashboard/src/data/`

The folder keeps only files a page reads, plus the three inputs needed to rebuild the Q4-Q7 tables.

| File | Made by | Used by |
|---|---|---|
| `q4_airport_year.csv`, `q4_national_year.csv` | `prep_q4_q5.py` | Q4 |
| `q5_airport_year_tier.csv` | `prep_q4_q5.py` (the notebook's Q5 cell gives the same table) | Q5, Q6 (busy airports) |
| `q6_airport_change.csv`, `q6_airport_delays.csv`, `q6_carrier_delays.csv` | `prep_q6.py` | Q6 |
| `q7_airport_year_exploratory.csv` | the notebook's Q7 cell (`refresh_notebook_tables.py`) | Q7 |
| `q4_routes.csv`, `shared_airport_year_F.csv` | the notebook (from the raw T-100 files) | input to `prep_q4_q5.py` and the notebook's Q4-Q7 cells |
| `q6_ontime_dest_carrier_month.csv` | `prep_ontime.py` (from the raw On-Time files) | input to `prep_q6.py` and the notebook's Q6 cells |
| `q1_*`, `q2_*`, `q3_*` | the notebook | Q1-Q3 (Joe's pages; not all of them are read yet) |

## Changes since Milestone 2

Our Milestone 2 report and chart designs already used the definitions below, but the processing notebook had not been updated to match, so its tables disagreed with the report (the Milestone 2 feedback pointed this out). The notebook now uses them too.

| Question | Milestone 2 notebook | Now |
|---|---|---|
| Q4 | a route counted with 1 departure in the year | 52 performed departures (Atlanta 2025: 182 -> 158 destinations) |
| Q5 | fixed terciles of 2019 passenger volume | FAA-style hub tiers re-assigned every year |
| Q6 | arrivals grouped by the **origin** airport; departure delays included | arrivals grouped by the **destination** airport; departure delays dropped; cause minutes counted for valid arrivals only |
| Q7 | 1-departure destination counts and origin-based delays | Q4 destination counts (0 for an airport with seats but no active route) and destination-based delays |

Removed from `Dashboard/src/data/` because no page uses them: `q4_destinations_airport_year.csv`, `q5_airport_size_assignments.csv`, `q5_size_group_year.csv`, `q5_top10_concentration.csv`, `q6_airport_carrier_month.csv`, `q6_airport_carrier_year.csv`, `q6_airport_month.csv`, `q6_airport_year.csv`, `q6_airport_year_complete.csv`, `q6_month_coverage.csv` and `q7_delay_join_coverage_by_year.csv`. The Milestone 2 versions of these files and of the notebook are on the `data-processing` branch. The `output/samples/` extracts linked from `MILESTONE2.md` are unchanged.

## Checks

- The pipeline tables reproduce every number in the Milestone 2 report's Q4-Q6 samples (for example 6,324 active routes in 2015 and 7,773 in 2025; 29 large hubs with 68.45% of passengers in 2015; Newark 24.67 delay minutes per flight in 2025; on-time rate lower in 2025 than in 2018 at 68 of 71 busy airports).
- `refresh_notebook_tables.py` checks that the notebook's `q4_routes` and `q5_airport_year_tier` are identical to the pipeline's, and that every Q7 destination count equals Q4's.
