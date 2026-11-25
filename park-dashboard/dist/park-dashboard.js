"use strict";
(() => {
  // park-dashboard/src/plugin.ts
  var WINDOW_CLASS = "park-dashboard";
  var HISTORY_KEY = "dashboard.cashHistory";
  var RATING_HISTORY_KEY = "dashboard.ratingHistory";
  var HISTORY_MAX = 30;
  var GUEST_SAMPLE_MAX = 400;
  var MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  var THOUGHT_LABELS = {
    hungry: "Hungry",
    thirsty: "Thirsty",
    toilet: "Needs a bathroom",
    cant_afford_ride: "Can't afford a ride",
    go_home: "Heading home",
    sick: "Nauseous",
    very_sick: "Very nauseous",
    lost: "Lost",
    happy: "Happy",
    litter: "Disgusted by litter",
    vandalism: "Upset by vandalism",
    drowned: "Witnessed an accident"
  };
  var state = { cashHistory: [], ratingHistory: [] };
  var win = null;
  function fmtMoney(units) {
    return context.formatString("{CURRENCY2DP}", units);
  }
  function fmtNumber(n) {
    return n.toLocaleString("en-US");
  }
  function thoughtLabel(type) {
    const known = THOUGHT_LABELS[type];
    if (known !== void 0) {
      return known;
    }
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
  }
  function inGameDate() {
    return `Y${date.year} ${MONTHS[date.month]} ${date.day}`;
  }
  function loadState() {
    const storage = context.getParkStorage();
    const cash = storage.get(HISTORY_KEY);
    const rating = storage.get(RATING_HISTORY_KEY);
    state.cashHistory = Array.isArray(cash) ? cash : [];
    state.ratingHistory = Array.isArray(rating) ? rating : [];
  }
  function recordDay() {
    state.cashHistory.push(park.cash);
    state.ratingHistory.push(park.rating);
    if (state.cashHistory.length > HISTORY_MAX) {
      state.cashHistory = state.cashHistory.slice(-HISTORY_MAX);
    }
    if (state.ratingHistory.length > HISTORY_MAX) {
      state.ratingHistory = state.ratingHistory.slice(-HISTORY_MAX);
    }
    const storage = context.getParkStorage();
    storage.set(HISTORY_KEY, state.cashHistory);
    storage.set(RATING_HISTORY_KEY, state.ratingHistory);
  }
  function ratingTrend() {
    const hist = state.ratingHistory;
    if (hist.length < 8) {
      return "";
    }
    const diff = hist[hist.length - 1] - hist[hist.length - 8];
    if (diff > 0) {
      return ` (up ${diff} this week)`;
    }
    if (diff < 0) {
      return ` (down ${-diff} this week)`;
    }
    return " (steady)";
  }
  function sampleGuests() {
    const all = map.getAllEntities("guest");
    const stride = Math.max(1, Math.ceil(all.length / GUEST_SAMPLE_MAX));
    const counts = /* @__PURE__ */ new Map();
    let happinessSum = 0;
    let sampled = 0;
    for (let i = 0; i < all.length; i += stride) {
      const guest = all[i];
      happinessSum += guest.happiness;
      sampled++;
      for (const thought of guest.thoughts) {
        counts.set(thought.type, (counts.get(thought.type) ?? 0) + 1);
      }
    }
    const topThoughts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      count: all.length,
      avgHappiness: sampled > 0 ? Math.round(happinessSum / sampled / 255 * 100) : 0,
      topThoughts
    };
  }
  function collectRideStats() {
    const stats = { open: 0, closed: 0, testing: 0, simulating: 0, broken: 0, worstQueues: [] };
    for (const ride of map.rides) {
      if (ride.status === "open") {
        stats.open++;
      } else if (ride.status === "closed") {
        stats.closed++;
      } else if (ride.status === "testing") {
        stats.testing++;
      } else if (ride.status === "simulating") {
        stats.simulating++;
      }
      if (ride.breakdown) {
        stats.broken++;
      }
      let wait = 0;
      for (const station of ride.stations) {
        if (station.queueTime > wait) {
          wait = station.queueTime;
        }
      }
      if (wait > 0) {
        stats.worstQueues.push({ name: ride.name, wait });
      }
    }
    stats.worstQueues.sort((a, b) => b.wait - a.wait);
    stats.worstQueues = stats.worstQueues.slice(0, 3);
    return stats;
  }
  function buildWidgets() {
    return [
      { type: "label", name: "hdr", x: 8, y: 16, width: 250, height: 10, text: "" },
      { type: "groupbox", name: "finbox", x: 4, y: 30, width: 264, height: 88, text: "Finances" },
      { type: "label", name: "cash", x: 10, y: 46, width: 250, height: 10, text: "" },
      { type: "label", name: "company", x: 10, y: 60, width: 250, height: 10, text: "" },
      { type: "label", name: "rating", x: 10, y: 74, width: 250, height: 10, text: "" },
      { type: "custom", name: "spark", x: 10, y: 88, width: 250, height: 26, onDraw: drawSparkline },
      { type: "groupbox", name: "guestbox", x: 4, y: 122, width: 264, height: 52, text: "Guests" },
      { type: "label", name: "guests", x: 10, y: 136, width: 250, height: 10, text: "" },
      { type: "label", name: "thoughts", x: 10, y: 150, width: 252, height: 10, text: "" },
      { type: "groupbox", name: "ridebox", x: 4, y: 178, width: 264, height: 66, text: "Rides" },
      { type: "label", name: "ridestats", x: 10, y: 192, width: 250, height: 10, text: "" },
      { type: "label", name: "queue0", x: 10, y: 206, width: 250, height: 10, text: "" },
      { type: "label", name: "queue1", x: 10, y: 218, width: 250, height: 10, text: "" },
      { type: "label", name: "queue2", x: 10, y: 230, width: 250, height: 10, text: "" },
      { type: "label", name: "updated", x: 8, y: 250, width: 160, height: 10, text: "" },
      {
        type: "button",
        name: "refresh",
        x: 190,
        y: 246,
        width: 74,
        height: 24,
        text: "Refresh",
        onClick: () => refreshAll()
      }
    ];
  }
  function drawSparkline(g) {
    const hist = state.cashHistory;
    const w = g.width;
    const h = g.height;
    g.well(0, 0, w, h);
    if (hist.length < 2) {
      g.text("Collecting history...", 4, Math.floor(h / 2) - 5);
      return;
    }
    let min = hist[0];
    let max = hist[0];
    for (const v of hist) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    g.colour = 2;
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i < hist.length; i++) {
      const x = 1 + Math.round(i / (hist.length - 1) * (w - 2));
      const y = h - 2 - Math.round((hist[i] - min) / range * (h - 4));
      if (i > 0) {
        g.line(prevX, prevY, x, y);
      }
      prevX = x;
      prevY = y;
    }
  }
  function setText(name, text) {
    if (win === null) {
      return;
    }
    win.findWidget(name).text = text;
  }
  function refreshAll() {
    if (typeof ui === "undefined") {
      return;
    }
    if (win === null) {
      openWindow();
      return;
    }
    const guests = sampleGuests();
    const rides = collectRideStats();
    setText("hdr", `${park.name} - ${inGameDate()}`);
    setText("cash", `Cash: ${fmtMoney(park.cash)}`);
    setText("company", `Company value: ${fmtMoney(park.companyValue)}`);
    setText("rating", `Park rating: ${park.rating}${ratingTrend()}`);
    setText("guests", `${fmtNumber(guests.count)} guests - avg happiness ${guests.avgHappiness}%`);
    const thoughtText = guests.topThoughts.map(([type, n]) => `${thoughtLabel(type)} (${n})`).join(", ");
    setText("thoughts", thoughtText.length > 0 ? `Thinking: ${thoughtText}` : "No notable thoughts");
    setText(
      "ridestats",
      `Open ${rides.open} - Closed ${rides.closed} - Broken ${rides.broken} - Testing ${rides.testing} - Sim ${rides.simulating}`
    );
    for (let i = 0; i < 3; i++) {
      const q = rides.worstQueues[i];
      setText(`queue${i}`, q ? `${i + 1}. ${q.name} - ${q.wait} min wait` : "");
    }
    setText("updated", `Updated ${inGameDate()}`);
  }
  function openWindow() {
    if (typeof ui === "undefined") {
      return;
    }
    if (win !== null) {
      try {
        win.bringToFront();
        return;
      } catch {
        win = null;
      }
    }
    win = ui.openWindow({
      classification: WINDOW_CLASS,
      width: 272,
      height: 278,
      title: "Park Dashboard",
      colours: [1, 1, 1],
      widgets: buildWidgets(),
      onClose: () => {
        win = null;
      }
    });
    refreshAll();
  }
  function onDay() {
    if (context.mode !== "normal") {
      return;
    }
    recordDay();
    refreshAll();
  }
  function main() {
    loadState();
    context.subscribe("interval.day", onDay);
    if (typeof ui !== "undefined") {
      ui.registerMenuItem("Park Dashboard", openWindow);
      if (context.mode === "normal") {
        openWindow();
      }
    }
  }
  registerPlugin({
    name: "Park Dashboard",
    version: "0.1.0",
    authors: ["sleuthy-sloth"],
    type: "local",
    licence: "MIT",
    targetApiVersion: context.apiVersion,
    main
  });
})();
