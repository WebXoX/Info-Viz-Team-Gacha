"""Download the BTS On-Time Performance monthly zips for 2015-2025 (132 files, about 3.5 GB).

Run from the repository root:   python pipeline/download_ontime.py RAW_DIR
Then:                           python pipeline/prep_ontime.py RAW_DIR
Source: https://www.transtats.bts.gov/PREZIP/ (the same files as the "Prezipped File" option on
https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ). Valid files already in RAW_DIR are skipped.
"""
import sys
import requests
import zipfile
import time
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
BASE_URL = "https://www.transtats.bts.gov/PREZIP/"
OUTPUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "raw_data" / "on_time"

YEARS = range(2015, 2026)
MONTHS = range(1, 13)

MAX_WORKERS = 6
MAX_RETRIES = 4
CHUNK_SIZE = 1024 * 1024  # 1 MB

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def download_file(year, month):

    filename = (
        "On_Time_Reporting_Carrier_On_Time_Performance_"
        f"1987_present_{year}_{month}.zip"
    )

    filepath = OUTPUT_DIR / filename
    temp_path = filepath.with_suffix(".zip.tmp")
    url = BASE_URL + filename

    # Skip previously downloaded valid files
    if filepath.exists():
        try:
            with zipfile.ZipFile(filepath) as z:
                if z.testzip() is None:
                    return filename, "Already exists"
        except Exception:
            pass

        filepath.unlink(missing_ok=True)

    temp_path.unlink(missing_ok=True)

    for attempt in range(MAX_RETRIES):

        try:
            with requests.get(
                url,
                stream=True,
                timeout=(20, 180),
                headers={"User-Agent": "Mozilla/5.0"}
            ) as response:

                response.raise_for_status()

                # Check that response is a ZIP
                first_chunk = True
                downloaded = 0

                with open(temp_path, "wb") as f:

                    for chunk in response.iter_content(
                        chunk_size=CHUNK_SIZE
                    ):
                        if not chunk:
                            continue

                        if first_chunk:
                            if not chunk.startswith(b"PK"):
                                raise ValueError(
                                    "Response is not a ZIP file"
                                )
                            first_chunk = False

                        f.write(chunk)
                        downloaded += len(chunk)

                if downloaded == 0:
                    raise ValueError("Empty download")

            # Verify ZIP integrity
            with zipfile.ZipFile(temp_path) as z:
                bad_file = z.testzip()

                if bad_file:
                    raise ValueError(
                        f"Corrupt ZIP member: {bad_file}"
                    )

            # Atomic rename after successful validation
            os.replace(temp_path, filepath)

            return filename, f"Downloaded ({downloaded / 1e6:.1f} MB)"

        except Exception as e:

            temp_path.unlink(missing_ok=True)

            if attempt == MAX_RETRIES - 1:
                return filename, f"FAILED: {str(e)}"

            wait = 2 ** attempt
            time.sleep(wait)


def main():

    tasks = [
        (year, month)
        for year in YEARS
        for month in MONTHS
    ]

    print(f"Total files: {len(tasks)}")
    print(f"Concurrent workers: {MAX_WORKERS}\n")

    results = []
    start = time.time()

    with ThreadPoolExecutor(
        max_workers=MAX_WORKERS
    ) as executor:

        futures = {
            executor.submit(download_file, y, m): (y, m)
            for y, m in tasks
        }

        for future in as_completed(futures):

            filename, status = future.result()
            results.append((filename, status))

            print(f"{status}: {filename}")

    elapsed = time.time() - start

    failed = [
        item for item in results
        if item[1].startswith("FAILED")
    ]

    print("\n" + "=" * 60)
    print(f"Completed: {len(results) - len(failed)}/{len(tasks)}")
    print(f"Failed: {len(failed)}")
    print(f"Time taken: {elapsed / 60:.2f} minutes")

    if failed:
        print("\nFailed downloads:")
        for filename, status in failed:
            print(filename, status)

        with open(OUTPUT_DIR / "failed_downloads.txt", "w") as f:
            for filename, status in failed:
                f.write(f"{filename}: {status}\n")

    print("=" * 60)


if __name__ == "__main__":
    main()
