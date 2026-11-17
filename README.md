# US Domestic Aviation, 2015-2025

**Team 8: Gacha**
**Members:** Ronak Pradhan (rp4803), Joe Perinchery (jp8276)
**Course:** Information Visualization

This repository holds our final project. This README is the **Milestone 3** write-up (first draft of the D3 visualizations). The Milestone 2 report is kept unchanged in [MILESTONE2.md](MILESTONE2.md).

## Introduction

We look at how U.S. domestic air travel changed from 2015 through 2025, using complete calendar years. Our main audience is airline network and operations planners, with airport operators and government planners as secondary audiences. The dashboard moves from the national picture to states and airports, then to routes, airport groups, on-time performance, and airports whose capacity and connectivity do not match.

## How to view the visualizations

The visualizations are an [Observable Framework](https://observablehq.com/framework/) site in the `Dashboard/` folder. You need [Node.js](https://nodejs.org/) 18 or newer.

```
git clone https://github.com/WebXoX/Info-Viz-Team-Gacha.git
cd Info-Viz-Team-Gacha
git checkout milestone-3
cd Dashboard
npm install
npm run dev
```

Then open <http://127.0.0.1:3000>. The home page links to every question, and the sidebar lists them too. All data the pages need is already in `Dashboard/src/data/`, so no download is required.

## Questions and pages

Each page states its question, shows the D3 visualization, and describes what it shows. The D3 code is in the page itself (`Dashboard/src/qN.md`) or in `Dashboard/src/components/`; the Q4-Q6 pages also show their code in a "Show the D3 code" section.

| Page | Question |
|---|---|
| [Q1](Dashboard/src/q1.md) | Which airports and carriers move the most passengers, freight, mail, and estimated total payload, and where do their rankings disagree? |
| [Q2](Dashboard/src/q2.md) | How has domestic passenger traffic and capacity changed nationally, by state and airport since 2015, and how did each recover relative to 2019? |
| [Q3](Dashboard/src/q3.md) | How does domestic passenger activity compare with state population? |
| [Q4](Dashboard/src/q4.md) | How have nonstop routes changed since 2015, and which airports gained or lost the most destinations? |
| [Q5](Dashboard/src/q5.md) | Do small airports follow different trends than major hubs, and has traffic concentrated at the busiest airports? |
| [Q6](Dashboard/src/q6.md) | Did on-time performance keep pace with traffic, and which airports and carriers are most delay-prone, when, and why? |
| [Q7](Dashboard/src/q7.md) | Where do capacity and connectivity indicators suggest a potential mismatch? |

## Data

| Dataset | Used for | Source |
|---|---|---|
| BTS T-100 Domestic Segment (U.S. carriers), 2015-2025 | passengers, seats, departures, freight, mail and routes (all questions) | [BTS T-100 Domestic Segment](https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FIM&QO_fu146_anzr=Nv4%20Pn44vr45) |
| BTS Reporting Carrier On-Time Performance, 2015-2025 | on-time arrivals, delays and delay causes (Q6, Q7) | [BTS On-Time Performance](https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ&QO_fu146_anzr=b0-gvzr) |
| U.S. Census state population estimates | population (Q3) | [NST-EST2025-ALLDATA.csv](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv) (2020-2025) and [nst-est2020int-pop.xlsx](https://www2.census.gov/programs-surveys/popest/tables/2010-2020/intercensal/national/nst-est2020int-pop.xlsx) (2010-2020) |

The raw files are large, so the repository holds one sample file of each BTS dataset (Git LFS) and the processed tables the pages use (`Dashboard/src/data/`). To rebuild the tables:

- `Gacha_EDA_DATA_PREP.ipynb` cleans and aggregates the raw T-100, On-Time and Census files. Its first cell lists the input folders.
- `pipeline/` builds the Q4-Q6 page tables and re-runs the notebook's Q4-Q7 cells; see [pipeline/README.md](pipeline/README.md) for the commands, sources and checks.

## Changes since Milestone 2

The Milestone 2 feedback found that some numbers in our processing notebook did not match the definitions in our report. Our proposal, chart designs and report were based on the right definitions, but the notebook had not been updated to reflect them, which is why the tables disagreed. Ronak has now updated the notebook's Q4, Q5, Q6 and Q7 cells, so the notebook and the pages use the same definitions:

- **Active route (Q4, Q7):** a route counts when it had at least 52 performed departures in the year. The notebook had counted a route with a single departure, so Q7 disagreed with Q4 (Atlanta 2025: 182 destinations on Q7, 158 on Q4). Both now give 158.
- **Airport groups (Q5):** FAA-style hub tiers, re-assigned every year from each airport's share of national passengers. The notebook had used fixed 2019 terciles.
- **On-time arrivals (Q6, Q7):** grouped by the destination airport, where the flight landed. The notebook had grouped them by the origin airport.

We also removed the old Q4-Q7 data files that no page uses. [pipeline/README.md](pipeline/README.md#changes-since-milestone-2) lists every file that changed or was removed. The Milestone 2 versions of the notebook and data are on the `data-processing` branch.

## Who built what

- **Joe Perinchery:** Q1, Q2 and Q3, and the first version of Q7.
- **Ronak Pradhan:** Q4, Q5 and Q6, and the data pipeline in `pipeline/`.
- **Q7 route fix:** Joe built Q7 first. Q7 uses the same route data as Q4, but it used a different definition of an active route, so the two pages gave different numbers and Q7 flagged airports that looked irregular. Ronak fixed this by moving Q7 (and the notebook) to the Q4 definition, and updated the Q7 page to match.

## What to expect in Milestone 4

- **One visual style for all plots.** The pages currently use two styles (tooltips, legends and colors). We have not finalized it yet and will choose one style for every chart.
- **Data-quality appendix.** A section on the data decisions behind the numbers: duplicate rows, missing carrier IDs, passengers above seats, missing values, and on-time data coverage.
- **A clearer story.** A short summary on the home page that connects the questions, and a conclusion page.

## Use of AI

We used ChatGPT for some parts of the work and Claude for others, mainly to help with coding and debugging the D3 visualizations. The ideas, the concept, the proposal, the approach for each question, and the initial implementation were done by us, Joe and Ronak. We also used AI to help set up the Observable Framework project. After we finished our first draft, we used AI to review the submission against the Milestone 3 requirements and the feedback from earlier milestones, to check whether we had missed anything.
