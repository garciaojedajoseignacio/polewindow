(() => {
  const form = document.getElementById("controls");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const tableBody = document.querySelector("#ranking-table tbody");
  const spanLabel = document.getElementById("span-label");
  const chartSelect = document.getElementById("chart-site");
  const computeBtn = document.getElementById("compute-btn");
  const chartCanvas = document.getElementById("elev-chart");
  let chart;
  let lastResult;

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function selectedIds() {
    return [...form.querySelectorAll('input[name="site_ids"]:checked')].map(
      (el) => el.value
    );
  }

  function customPayload() {
    const lat = document.getElementById("custom-lat").value.trim();
    const lon = document.getElementById("custom-lon").value.trim();
    if (lat === "" && lon === "") return null;
    if (lat === "" || lon === "") {
      throw new Error("Enter both latitude and longitude for a custom site.");
    }
    return {
      lat: Number(lat),
      lon_e: Number(lon),
      name: document.getElementById("custom-name").value.trim() || "Custom site",
    };
  }

  function renderRanking(result) {
    const span = result.method.time_span_utc;
    spanLabel.textContent = `${span[0]} to ${span[1]} UTC · ${result.method.n_samples} hourly samples · ${result.method.horizon}.`;
    tableBody.innerHTML = "";
    for (const row of result.ranking) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.rank}</td>
        <td>${row.name}</td>
        <td>${row.sun_center_pct.toFixed(2)}%</td>
        <td>${row.earth_center_pct.toFixed(2)}%</td>
        <td>${row.both_center_pct.toFixed(2)}%</td>
        <td>${row.sun_limb_pct.toFixed(2)}%</td>
        <td>${row.earth_limb_pct.toFixed(2)}%</td>
      `;
      tableBody.appendChild(tr);
    }
  }

  function renderChartOptions(result) {
    const previous = chartSelect.value;
    chartSelect.innerHTML = "";
    for (const site of result.sites) {
      const option = document.createElement("option");
      option.value = site.id;
      option.textContent = site.name;
      chartSelect.appendChild(option);
    }
    if ([...chartSelect.options].some((opt) => opt.value === previous)) {
      chartSelect.value = previous;
    }
    drawChart(result, chartSelect.value);
  }

  function drawChart(result, siteId) {
    const site = result.sites.find((item) => item.id === siteId) || result.sites[0];
    if (!site || !site.series || typeof Chart === "undefined") return;
    const labels = site.series.times.map((t) => t.replace("T", " ").replace("Z", ""));
    const data = {
      labels,
      datasets: [
        {
          label: "Sun elevation (°)",
          data: site.series.sun_alt,
          borderColor: "#f0b429",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
        },
        {
          label: "Earth elevation (°)",
          data: site.series.earth_alt,
          borderColor: "#5b9fd6",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
        },
      ],
    };
    const options = {
      responsive: true,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#e8edf7" } },
        title: { display: true, text: site.name, color: "#e8edf7" },
      },
      scales: {
        x: {
          ticks: { color: "#9aa6c0", maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: "#2a3555" },
        },
        y: {
          title: { display: true, text: "Elevation (deg)", color: "#9aa6c0" },
          ticks: { color: "#9aa6c0" },
          grid: { color: "#2a3555" },
        },
      },
    };
    if (chart) chart.destroy();
    chart = new Chart(chartCanvas, { type: "line", data, options });
  }

  chartSelect.addEventListener("change", () => {
    if (lastResult) drawChart(lastResult, chartSelect.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let custom;
    try {
      custom = customPayload();
    } catch (err) {
      setStatus(err.message, true);
      return;
    }
    const siteIds = selectedIds();
    if (siteIds.length === 0 && !custom) {
      setStatus("Select at least one site, or enter custom coordinates.", true);
      return;
    }
    const body = {
      site_ids: siteIds,
      start: document.getElementById("start").value,
      end: document.getElementById("end").value,
      include_series: true,
    };
    if (custom) body.custom = custom;

    computeBtn.disabled = true;
    setStatus("Computing elevations…");
    try {
      const response = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Request failed (${response.status})`);
      }
      lastResult = result;
      renderRanking(result);
      renderChartOptions(result);
      resultsEl.hidden = false;
      setStatus("Done.");
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      computeBtn.disabled = false;
    }
  });
})();
