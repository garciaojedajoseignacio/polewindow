/* PoleWindow translations. English static text is read from index.html;
   this file holds the Chilean Spanish versions and the strings built in JS. */
window.POLEWINDOW_I18N = {
  dirs: {
    en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"],
    es: ["N", "NE", "E", "SE", "S", "SO", "O", "NO", "N"],
  },
  siteNames: {
    connecting_ridge: "Connecting Ridge (sitio de alunizaje propuesto)",
    peak_near_shackleton: "Peak Near Shackleton (sitio de alunizaje propuesto)",
    shackleton_center: "Centro del cráter Shackleton",
    haworth_center: "Centro del cráter Haworth",
    faustini_center: "Centro del cráter Faustini",
  },
  es: {
    title: "PoleWindow — Navegador de sitios de alunizaje en el polo sur lunar",
    tag: "Navegador de sitios de alunizaje en el polo sur lunar · NASA Space Apps 2026 · Equipo Kirby Landers",
    navExplore: "Explorar", navMethod: "Método", navSources: "Datos y fuentes", navAbout: "Equipo",
    hero: '¿Dónde, en el polo sur de la Luna, un módulo de alunizaje recibe más <b class="sun">luz solar</b> para generar energía y tiene más tiempo a la vista la <b class="earth">Tierra</b> para comunicarse por radio? PoleWindow lo calcula hora a hora para todo <span data-year>2027</span> con efemérides de NASA JPL y el relieve medido por el altímetro láser LOLA del LRO.',
    rangeLabel: "Rango de fechas (UTC)",
    loading: "Cargando datos horarios…",
    loaded: "Datos horarios cargados",
    mTerrain: "Relieve (LOLA)", mSpherical: "Esférico",
    kBoth: "Sol + Tierra", kSun: "Sol", kEarth: "Tierra", kDark: "Noche más larga",
    zFull: "Vista hasta 84°S", zPole: "Zoom al polo",
    heat: "Mapa de calor",
    mapNote: "Haz clic en cualquier punto del mapa para ver sus valores y su línea de tiempo. Proyección estereográfica polar sur, 0°E arriba, 90°E a la derecha, ±200 km alrededor del polo (o ±40 km con zoom). Relieve: LRO LOLA LDEM_75S_240M (sombreado ilustrativo, no es iluminación real).",
    pickTitle: "Punto seleccionado",
    pickEmpty: "Haz clic en el mapa para elegir cualquier lugar entre 84°S y el polo.",
    pickOpen: "Ver detalle completo ↓",
    bestTitle: "Mejores puntos de la grilla",
    bestNote: "Puntos de la grilla con más tiempo de Sol y Tierra a la vez en el rango elegido. Son candidatos para estudiar, no regiones de alunizaje oficiales.",
    rankTitle: "Ranking de sitios",
    thSite: "Sitio", thSun: "Sol %", thEarth: "Tierra %", thBoth: "Ambos %",
    thLongSun: "Sol continuo más largo", thLongDark: "Noche más larga",
    thBlackout: "Corte más largo con la Tierra", thDrops: "Cortes con la Tierra",
    rankNote: "Porcentaje de horas del rango elegido con el centro del cuerpo sobre el horizonte. Los valores \"más largo\" son tramos continuos (recortados al rango). Cortes con la Tierra = cuántas veces se pierde la línea de vista directa con la Tierra. Ordenado por Ambos %; haz clic en una columna para ordenar o en una fila para abrir el sitio.",
    tlCap: "Línea de tiempo en el rango elegido (pasa el mouse o toca para ver fecha y hora, UTC)",
    hzCap: "Horizonte local (LOLA) con las trayectorias del Sol y la Tierra en el rango elegido",
    keyTerr: "horizonte con relieve", keySun: "centro del Sol", keyEarth: "centro de la Tierra", keyZero: "horizonte esférico (0°)",
    hzNone: "Los perfiles de horizonte se guardan para los cinco sitios citados; para los puntos de la grilla la línea de tiempo usa el mismo método de horizonte LOLA.",
    footer: "PoleWindow · Sin afiliación ni respaldo de la NASA. Datos de la NASA usados según su política de dominio público.",
    method: `<h2>Método</h2>
    <ol>
      <li><b>Geometría.</b> Las posiciones del Sol y la Tierra vistas desde la Luna vienen de la efeméride planetaria <b>DE421</b> de NASA JPL, rotadas al sistema lunar <b>Mean Earth / Polar Axis</b> (<code>MOON_ME_DE421</code>) con kernels SPICE de NAIF, usando la biblioteca abierta Skyfield. Incluye tiempo de luz y aberración.</li>
      <li><b>Muestreo.</b> Cada hora de <span data-year>2027</span> (UTC), <span data-nhours>8760</span> muestras. Para cada lugar calculamos la elevación y el azimut topocéntricos del centro del Sol y del centro de la Tierra.</li>
      <li><b>Horizonte esférico.</b> Un cuerpo está "a la vista" si su centro está sobre 0° de elevación en una esfera lisa. No considera montañas ni cráteres.</li>
      <li><b>Horizonte con relieve (por defecto).</b> Con el modelo de elevación polar LRO LOLA (240 m/píxel) trazamos 360 rayos (cada 1° de azimut) hasta <span class="rayKm">150</span> km, muestreamos el terreno cada 240 m sobre círculos máximos, consideramos la curvatura lunar y guardamos el mayor ángulo de elevación por azimut. El observador está <span class="obsH">2</span> m sobre la superficie LOLA. Un cuerpo está a la vista si su centro supera el horizonte en su azimut.</li>
      <li><b>Métricas.</b> Sol % (energía), Tierra % (línea de vista directa para radio), Sol + Tierra % (ambos a la vez), sol continuo y noche más largos, corte más largo con la Tierra y número de cortes de contacto con la Tierra.</li>
      <li><b>Grilla y rangos de fechas.</b> <span class="gridN">—</span> puntos: cada 1,5 km dentro de 36 km del polo y cada 6 km hasta 84°S. La visibilidad hora a hora de cada punto se guarda comprimida (codificación por tramos) y todas las estadísticas del rango elegido se recalculan en tu navegador.</li>
    </ol>
    <h3>Validación</h3>
    <ul>
      <li>Nuestro cálculo vectorizado de elevaciones coincide con el cálculo topocéntrico de Skyfield para los cinco sitios <span class="valDiff">—</span>° (ene–mar 2027).</li>
      <li>El cálculo con Skyfield se contrastó con <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> (que en esa consulta usó DE441) para las elevaciones del Sol y la Tierra en los sitios.</li>
      <li>La orientación del modelo de elevación se verificó con rasgos conocidos (el cráter Shackleton aparece como una depresión de ~2,4 km en su centro según el nomenclátor), y los puntos de la grilla con más sol (hasta cerca de 68% de 2027) se concentran en el borde de Shackleton y en el connecting ridge, las mismas zonas que los estudios publicados con LOLA describen como muy iluminadas (p. ej., Mazarico et al., 2011). Nuestros máximos son menores que los publicados por la grilla de 1,5 km, el modelo de 240 m y la regla del centro del disco.</li>
    </ul>
    <h3>Limitaciones</h3>
    <ul>
      <li>La visibilidad usa el <b>centro</b> del cuerpo; no se modelan el disco solar parcial, la altura ni la orientación de los paneles solares, ni el disco parcial de la Tierra.</li>
      <li>La resolución de 240 m suaviza cumbres y crestas pequeñas; la iluminación real en una posición específica puede ser distinta. Existen productos LOLA de mayor resolución (5–20 m) que no se usaron en esta demo.</li>
      <li>Solo un año (2027); el patrón de iluminación polar cambia en el ciclo nodal lunar de ~18,6 años.</li>
      <li>La visibilidad de la Tierra es solo línea de vista geométrica, no un enlace de radio. No se modelan satélites de retransmisión.</li>
      <li>Los centros de cráter del nomenclátor quedan en fondos en sombra permanente en el modelo con relieve; son puntos de referencia, no recomendaciones de alunizaje.</li>
      <li>No es un producto oficial de la NASA ni una herramienta de planificación de misiones.</li>
    </ul>`,
    sources: `<h2>Datos y fuentes</h2>
    <ul>
      <li><b>Efeméride planetaria JPL DE421</b> — Folkner, W. M., Williams, J. G., Boggs, D. H. (2008), <i>The Planetary and Lunar Ephemeris DE421</i>, JPL IOM 343R-08-003. Kernel: <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/" target="_blank" rel="noopener">NAIF generic_kernels/spk/planets/de421.bsp</a>.</li>
      <li><b>Kernels SPICE de NAIF para el sistema lunar</b> — <code>moon_080317.tf</code>, <code>moon_pa_de421_1900-2050.bpc</code>, <code>pck00008.tpc</code> de los <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/" target="_blank" rel="noopener">kernels genéricos de NASA NAIF</a>.</li>
      <li><b>Relieve LRO LOLA</b> — registro de datos en grilla del Lunar Orbiter Laser Altimeter <code>LDEM_75S_240M</code> (conjunto LRO-L-LOLA-4-GDR-V1.0, versión 2.0, 2017), 240 m/píxel en estereográfica polar sur, del <a href="https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/" target="_blank" rel="noopener">NASA PDS Geosciences Node</a>. Smith, D. E. et al. (2010), <i>The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission</i>, Space Sci. Rev. 150, 209–241. Datos de la NASA, dominio público.</li>
      <li><b>Sitios</b> — Puntos propuestos de Connecting Ridge y Peak Near Shackleton: Gracy &amp; Lee, 55th LPSC (2024), <a href="https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf" target="_blank" rel="noopener">resumen 1695</a> (dentro de regiones candidatas de Artemis III de la NASA). Centros de los cráteres Shackleton, Haworth y Faustini: <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener">nomenclátor planetario USGS/IAU</a>.</li>
      <li><b>Literatura de iluminación</b> — Mazarico, E. et al. (2011), <i>Illumination conditions of the lunar polar regions using LOLA topography</i>, Icarus 211, 1066–1081.</li>
      <li><b>Software</b> — <a href="https://rhodesmill.org/skyfield/" target="_blank" rel="noopener">Skyfield</a>, NumPy, Pillow. La página es HTML, CSS y JavaScript simples, sin servicios externos.</li>
    </ul>
    <p class="muted small">Datos precalculados: <a href="data/sites.json">sites.json</a> · <a href="data/grid.json">grid.json</a> · <a href="data/hourly.bin">hourly.bin</a>. Se regeneran con <code>python scripts/precompute.py --validate</code> (ver README).</p>`,
    about: `<h2>Equipo</h2>
    <p><b>Equipo Kirby Landers</b> — José Ignacio García Ojeda (dueño del equipo) y Tamar Scarleth Huenchuman Sanchez, Osorno, Chile. Hecho para el NASA Space Apps Challenge 2026, desafío <i>Lunar Landing Site Navigator</i>.</p>
    <p><b>Uso de IA:</b> el código se escribió con ayuda de GitHub Copilot y un asistente de IA. Todos los resultados salen de los datos abiertos y el código del <a href="https://github.com/garciaojedajoseignacio/polewindow" target="_blank" rel="noopener">repositorio</a>, con licencia MIT.</p>`,
  },
  dyn: {
    en: {
      methT: "terrain", methS: "spherical", wholeRange: "entire range",
      rangeFull: "the full year {y}", rangeInfo: "{n} days · {h} hours",
      pFull: "Full year {y}", pQ1: "Q1 (Jan–Mar)", pQ2: "Q2 (Apr–Jun)", pQ3: "Q3 (Jul–Sep)", pQ4: "Q4 (Oct–Dec)", pCustom: "Custom",
      leg_both: "Sun + Earth visible, % of range", leg_sun: "Sun visible, % of range", leg_earth: "Earth visible, % of range", leg_dark: "Longest continuous night",
      outside: "Outside the precomputed grid (84°S to the pole). Click closer to the center.",
      pickEmpty: "Click the map to choose any location between 84°S and the pole.",
      pickInfo: "LOLA elevation {e} m · grid cell {c} km", colTerr: "Terrain", colSph: "Spherical",
      kSun: "Sun", kEarth: "Earth", kBoth: "Sun + Earth",
      cSun: "Sun visible", cEarth: "Earth visible", cBoth: "Sun + Earth", cLongSun: "Longest sunlight", cLongDark: "Longest night", cBlackout: "Longest Earth blackout", cDrops: "Earth drop-outs",
      bSun: "Sun", bEarth: "Earth", bBoth: "Both",
      bestItem: '{ll} — <b>{b}%</b> both <span class="muted">(Sun {s}%, Earth {e}%)</span>',
      selPoint: "Selected point", pointName: "Grid point {ll}",
      dMetaPt: "{ll} · LOLA elevation {e} m (relative to 1737.4 km) · precomputed grid point, cell {c} km",
      dMetaSite: "{ll} · LOLA elevation {e} m (relative to 1737.4 km) · Source: {src}",
      within: "within {v}",
      whyMain: "{site} ranks #1 for {range} ({method} horizon) because the Sun and Earth are both in view {a}% of the time, versus {b}% at {other}",
      whyNight: ", and its longest night lasts {a} versus {b}",
      whySun: ", with up to {a} of continuous sunlight",
      whyDrops: ", with fewer Earth contact drop-outs ({a} versus {b})",
      whyBlackout: ", and its longest Earth blackout is shorter ({a} versus {b})",
      whyNone: "No site has the Sun and Earth in view at the same time in {range}.",
    },
    es: {
      methT: "relieve", methS: "esférico", wholeRange: "todo el rango",
      rangeFull: "todo el año {y}", rangeInfo: "{n} días · {h} horas",
      pFull: "Año completo {y}", pQ1: "T1 (ene–mar)", pQ2: "T2 (abr–jun)", pQ3: "T3 (jul–sep)", pQ4: "T4 (oct–dic)", pCustom: "Personalizado",
      leg_both: "Sol + Tierra a la vista, % del rango", leg_sun: "Sol a la vista, % del rango", leg_earth: "Tierra a la vista, % del rango", leg_dark: "Noche continua más larga",
      outside: "Fuera de la grilla precalculada (de 84°S al polo). Haz clic más cerca del centro.",
      pickEmpty: "Haz clic en el mapa para elegir cualquier lugar entre 84°S y el polo.",
      pickInfo: "Elevación LOLA {e} m · celda de {c} km", colTerr: "Relieve", colSph: "Esférico",
      kSun: "Sol", kEarth: "Tierra", kBoth: "Sol + Tierra",
      cSun: "Sol a la vista", cEarth: "Tierra a la vista", cBoth: "Sol + Tierra", cLongSun: "Sol continuo más largo", cLongDark: "Noche más larga", cBlackout: "Corte más largo con la Tierra", cDrops: "Cortes con la Tierra",
      bSun: "Sol", bEarth: "Tierra", bBoth: "Ambos",
      bestItem: '{ll} — <b>{b}%</b> ambos <span class="muted">(Sol {s}%, Tierra {e}%)</span>',
      selPoint: "Punto seleccionado", pointName: "Punto de la grilla {ll}",
      dMetaPt: "{ll} · Elevación LOLA {e} m (respecto de 1737,4 km) · punto precalculado de la grilla, celda de {c} km",
      dMetaSite: "{ll} · Elevación LOLA {e} m (respecto de 1737,4 km) · Fuente: {src}",
      within: "con una diferencia máxima de {v}",
      whyMain: "{site} queda en el puesto 1 para {range} (modelo {method}) porque tiene el Sol y la Tierra a la vista al mismo tiempo el {a}% del tiempo, contra {b}% en {other}",
      whyNight: ", y su noche más larga dura {a} contra {b}",
      whySun: ", con hasta {a} de sol continuo",
      whyDrops: ", con menos cortes de contacto con la Tierra ({a} contra {b})",
      whyBlackout: ", y su corte más largo con la Tierra es más corto ({a} contra {b})",
      whyNone: "Ningún sitio tiene el Sol y la Tierra a la vista al mismo tiempo en {range}.",
    },
  },
};
