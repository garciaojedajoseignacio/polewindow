#!/usr/bin/env python3
"""PoleWindow Flask app: compare lunar south-pole Sun and Earth windows."""
from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from compute import compute
from sites import SITES

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html", sites=SITES)


@app.route("/api/sites")
def api_sites():
    return jsonify({"sites": SITES})


def _request_payload():
    if request.method == "POST" and request.is_json:
        body = request.get_json(silent=True) or {}
        return body
    args = request.args
    payload = {
        "start": args.get("start"),
        "end": args.get("end"),
        "include_series": args.get("include_series", "1"),
    }
    ids = args.getlist("site_ids") or args.getlist("site_id")
    if not ids and args.get("sites"):
        ids = [part.strip() for part in args.get("sites").split(",") if part.strip()]
    if ids:
        payload["site_ids"] = ids
    if args.get("lat") not in (None, "") and args.get("lon_e", args.get("lon")) not in (
        None,
        "",
    ):
        payload["custom"] = {
            "lat": args.get("lat"),
            "lon_e": args.get("lon_e", args.get("lon")),
            "name": args.get("custom_name") or "Custom site",
        }
    return payload


@app.route("/api/compute", methods=["GET", "POST"])
def api_compute():
    payload = _request_payload()
    if "site_ids" in payload:
        site_ids = payload.get("site_ids")
        if isinstance(site_ids, str):
            site_ids = [part.strip() for part in site_ids.split(",") if part.strip()]
        elif site_ids is None:
            site_ids = None
        else:
            site_ids = list(site_ids)
    else:
        site_ids = None
    include_series = payload.get("include_series", True)
    if isinstance(include_series, str):
        include_series = include_series.lower() not in {"0", "false", "no"}

    custom = payload.get("custom")
    if custom is None and payload.get("lat") not in (None, ""):
        custom = {
            "lat": payload["lat"],
            "lon_e": payload.get("lon_e", payload.get("lon")),
            "name": payload.get("custom_name") or "Custom site",
        }

    try:
        result = compute(
            sites=site_ids,
            start=payload.get("start") or None,
            end=payload.get("end") or None,
            include_series=include_series,
            custom=custom,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"compute failed: {exc}"}), 500
    return jsonify(result)


if __name__ == "__main__":
    # Kernels load on the first compute request (or CLI run).
    app.run(host="127.0.0.1", port=5000, debug=False)
