const DateField = (() => {
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const PRECISIONS = ["year", "month", "week", "day"];
  const YEAR_MIN = 1800;
  const YEAR_MAX = new Date().getFullYear() + 5;

  function _sel(id) { return document.getElementById(id); }

  function _fillYears(el) {
    if (el.options.length > 1) return; // already populated
    el.innerHTML = '<option value="">Year</option>';
    for (let y = YEAR_MAX; y >= YEAR_MIN; y--) {
      el.innerHTML += `<option value="${y}">${y}</option>`;
    }
  }

  function _fillMonths(el) {
    if (el.options.length > 1) return;
    el.innerHTML = '<option value="">Month</option>';
    MONTHS.forEach((m, i) => {
      el.innerHTML += `<option value="${i + 1}">${m}</option>`;
    });
  }

  function _fillDays(el, year, month) {
    const days = year && month ? new Date(year, month, 0).getDate() : 31;
    const current = el.value;
    el.innerHTML = '<option value="">Day</option>';
    for (let d = 1; d <= days; d++) {
      el.innerHTML += `<option value="${d}">${d}</option>`;
    }
    if (current && parseInt(current) <= days) el.value = current;
  }

  function _showInput(prefix, precision) {
    for (const p of PRECISIONS) {
      const el = _sel(`${prefix}-date-${p}`);
      if (el) el.classList.toggle("hidden", p !== precision);
    }
  }

  function init(prefix) {
    // Populate year/month selects for each precision widget
    _fillYears(_sel(`${prefix}-date-year`));

    _fillYears(_sel(`${prefix}-date-month-y`));
    _fillMonths(_sel(`${prefix}-date-month-m`));

    _fillYears(_sel(`${prefix}-date-week-y`));
    _fillMonths(_sel(`${prefix}-date-week-m`));

    _fillYears(_sel(`${prefix}-date-day-y`));
    _fillMonths(_sel(`${prefix}-date-day-m`));
    _fillDays(_sel(`${prefix}-date-day-d`), null, null);

    // Re-fill days when year/month changes
    const dayY = _sel(`${prefix}-date-day-y`);
    const dayM = _sel(`${prefix}-date-day-m`);
    const dayD = _sel(`${prefix}-date-day-d`);
    const refill = () => _fillDays(dayD, parseInt(dayY.value) || null, parseInt(dayM.value) || null);
    dayY.addEventListener("change", refill);
    dayM.addEventListener("change", refill);

    _sel(`${prefix}-date-precision`).addEventListener("change", e => _showInput(prefix, e.target.value));
  }

  function read(prefix) {
    const precision = _sel(`${prefix}-date-precision`).value;
    if (!precision) return { date_value: null, date_precision: null };

    let date_value = null;

    if (precision === "year") {
      const y = _sel(`${prefix}-date-year`).value;
      if (!y) return { date_value: null, date_precision: null };
      date_value = `${y}-01-01`;

    } else if (precision === "month") {
      const y = _sel(`${prefix}-date-month-y`).value;
      const m = _sel(`${prefix}-date-month-m`).value;
      if (!y || !m) return { date_value: null, date_precision: null };
      date_value = `${y}-${String(m).padStart(2, "0")}-01`;

    } else if (precision === "week") {
      const y = parseInt(_sel(`${prefix}-date-week-y`).value);
      const m = parseInt(_sel(`${prefix}-date-week-m`).value);
      const n = parseInt(_sel(`${prefix}-date-week-n`).value);
      if (!y || !m) return { date_value: null, date_precision: null };
      const firstOfMonth = new Date(y, m - 1, 1);
      const startOfWeek1 = new Date(firstOfMonth);
      startOfWeek1.setDate(1 - ((firstOfMonth.getDay() + 6) % 7));
      const target = new Date(startOfWeek1);
      target.setDate(startOfWeek1.getDate() + (n - 1) * 7);
      date_value = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`;

    } else { // day
      const y = _sel(`${prefix}-date-day-y`).value;
      const m = _sel(`${prefix}-date-day-m`).value;
      const d = _sel(`${prefix}-date-day-d`).value;
      if (!y || !m || !d) return { date_value: null, date_precision: null };
      date_value = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }

    return { date_value, date_precision: precision };
  }

  function set(prefix, image) {
    const precision = image.date_precision || "";
    _sel(`${prefix}-date-precision`).value = precision;
    _showInput(prefix, precision);
    if (!precision || !image.date_value) return;

    const [y, m, d] = image.date_value.slice(0, 10).split("-").map(Number);

    if (precision === "year") {
      _sel(`${prefix}-date-year`).value = y;

    } else if (precision === "month") {
      _sel(`${prefix}-date-month-y`).value = y;
      _sel(`${prefix}-date-month-m`).value = m;

    } else if (precision === "week") {
      _sel(`${prefix}-date-week-y`).value = y;
      _sel(`${prefix}-date-week-m`).value = m;
      const firstOfMonth = new Date(y, m - 1, 1);
      const startOfWeek1 = new Date(firstOfMonth);
      startOfWeek1.setDate(1 - ((firstOfMonth.getDay() + 6) % 7));
      const stored = new Date(y, m - 1, d);
      const weekNum = Math.floor(Math.round((stored - startOfWeek1) / 86400000) / 7) + 1;
      _sel(`${prefix}-date-week-n`).value = String(Math.max(1, Math.min(5, weekNum)));

    } else { // day
      _sel(`${prefix}-date-day-y`).value = y;
      _sel(`${prefix}-date-day-m`).value = m;
      _fillDays(_sel(`${prefix}-date-day-d`), y, m);
      _sel(`${prefix}-date-day-d`).value = d;
    }
  }

  function reset(prefix) {
    _sel(`${prefix}-date-precision`).value = "";
    _showInput(prefix, "");
  }

  function format(date_value, date_precision) {
    if (!date_value || !date_precision) return "";
    const [y, m, d] = date_value.slice(0, 10).split("-").map(Number);

    if (date_precision === "year") return String(y);

    if (date_precision === "month") return `${MONTHS[m - 1]} ${y}`;

    if (date_precision === "week") {
      const firstOfMonth = new Date(y, m - 1, 1);
      const startOfWeek1 = new Date(firstOfMonth);
      startOfWeek1.setDate(1 - ((firstOfMonth.getDay() + 6) % 7));
      const stored = new Date(y, m - 1, d);
      const weekNum = Math.floor(Math.round((stored - startOfWeek1) / 86400000) / 7) + 1;
      return `Week ${weekNum}, ${MONTHS[m - 1]} ${y}`;
    }

    // day
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  return { init, read, set, reset, format };
})();
