"use strict";
(() => {
  // quest-board/src/plugin.ts
  var STORAGE_KEY = "questboard.v1";
  var WINDOW_CLASS = "quest-board";
  var MAX_SLOTS = 3;
  var CHEAT_ADD_MONEY = 16;
  var TEMPLATES = [
    {
      kind: "guests",
      titles: ["Crowd Magnet", "Standing Room Only", "Gate Busters"],
      minTarget: 250,
      maxTarget: 800,
      step: 25,
      reward: (t) => t * 40,
      goal: (t) => `Have ${t} guests in the park at once`
    },
    {
      kind: "rating",
      titles: ["Talk of the Town", "Rave Reviews", "Park of the Year"],
      minTarget: 550,
      maxTarget: 925,
      step: 25,
      reward: (t) => t * 20,
      goal: (t) => `Raise the park rating to ${t}`
    },
    {
      kind: "earn",
      titles: ["Cash Cow", "Coin Rush", "Boom Times"],
      minTarget: 15e3,
      maxTarget: 12e4,
      step: 5e3,
      reward: (t) => Math.round(t * 0.5),
      goal: (t) => `Pocket ${fmtMoney(t)} in earnings`
    },
    {
      kind: "rides",
      titles: ["Full Roster", "One More Ride", "Expansion Drive"],
      minTarget: 4,
      maxTarget: 13,
      step: 1,
      reward: (t) => t * 3e3,
      goal: (t) => `Have ${t} rides in the park`
    },
    {
      kind: "excitement",
      titles: ["Thrill Seekers", "White-Knuckle Club", "Fear Merchants"],
      minTarget: 400,
      maxTarget: 825,
      step: 25,
      reward: (t) => t * 30,
      goal: (t) => `Build a ride rated ${excitementDisplay(t)} excitement or higher`
    },
    {
      kind: "value",
      titles: ["Prime Property", "Company Valuation", "Priceless"],
      minTarget: 3e5,
      maxTarget: 125e4,
      step: 5e4,
      reward: (t) => Math.round(t / 20),
      goal: (t) => `Grow the park value to ${fmtMoney(t)}`
    }
  ];
  var state = { nextId: 1, quests: [], collected: 0 };
  var win = null;
  function fmtMoney(units) {
    return context.formatString("{CURRENCY2DP}", units);
  }
  function fmtNumber(n) {
    return n.toLocaleString("en-US");
  }
  function excitementDisplay(units) {
    return (units / 100).toFixed(2);
  }
  function progressBar(progress, target) {
    const ratio = target > 0 ? Math.max(0, Math.min(1, progress / target)) : 0;
    const filled = Math.round(ratio * 10);
    const pct = Math.floor(ratio * 100);
    return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}] ${pct}%`;
  }
  function loadState() {
    const storage = context.getParkStorage();
    const loaded = storage.get(STORAGE_KEY);
    if (loaded && Array.isArray(loaded.quests)) {
      state = loaded;
      for (const q of state.quests) {
        if (q.kind === "earn" && !q.done && q.startCash === void 0) {
          q.startCash = park.cash;
        }
      }
    }
    while (state.quests.length < MAX_SLOTS) {
      state.quests.push(makeQuest());
    }
    saveState();
  }
  function saveState() {
    context.getParkStorage().set(STORAGE_KEY, state);
  }
  function makeQuest(avoidKinds = []) {
    const pool = TEMPLATES.filter((t) => !avoidKinds.includes(t.kind));
    const chosen = pool.length > 0 ? pool[Math.floor(context.getRandom(0, pool.length))] : TEMPLATES[0];
    const steps = Math.floor((chosen.maxTarget - chosen.minTarget) / chosen.step);
    const target = chosen.minTarget + chosen.step * context.getRandom(0, steps + 1);
    const titles = chosen.titles;
    const title = titles[context.getRandom(0, titles.length)];
    return {
      id: state.nextId++,
      kind: chosen.kind,
      title,
      goal: chosen.goal(target),
      target,
      reward: chosen.reward(target),
      startCash: chosen.kind === "earn" ? park.cash : 0,
      done: false
    };
  }
  function reroll(slot) {
    const otherKinds = state.quests.filter((_, i) => i !== slot).map((q) => q.kind);
    state.quests[slot] = makeQuest(otherKinds);
    saveState();
    refreshWindow();
  }
  function newSet() {
    state.quests = [makeQuest(), makeQuest(), makeQuest()];
    saveState();
    refreshWindow();
  }
  function currentProgress(q) {
    switch (q.kind) {
      case "guests":
        return park.guests;
      case "rating":
        return park.rating;
      case "earn":
        return park.cash - q.startCash;
      case "rides":
        return map.rides.length;
      case "excitement": {
        let best = 0;
        for (const ride of map.rides) {
          if (ride.excitement > best) {
            best = ride.excitement;
          }
        }
        return best;
      }
      case "value":
        return park.value;
    }
  }
  function progressDetail(q, progress) {
    switch (q.kind) {
      case "guests":
        return `${fmtNumber(progress)} of ${fmtNumber(q.target)} guests in park`;
      case "rating":
        return `${progress} of ${q.target} rating`;
      case "earn":
        return `${fmtMoney(Math.max(0, progress))} of ${fmtMoney(q.target)} earned`;
      case "rides":
        return `${progress} of ${q.target} rides`;
      case "excitement":
        return `Best ride: ${excitementDisplay(progress)} (target ${excitementDisplay(q.target)})`;
      case "value":
        return `${fmtMoney(progress)} of ${fmtMoney(q.target)} value`;
    }
  }
  function onDay() {
    if (context.mode !== "normal") {
      return;
    }
    for (const q of state.quests) {
      if (q.done) {
        continue;
      }
      const progress = currentProgress(q);
      if (progress >= q.target) {
        q.done = true;
        state.collected += q.reward;
        payBounty(q.reward);
        park.postMessage(`Quest complete: ${q.title} - bounty paid ${fmtMoney(q.reward)}`);
      }
    }
    saveState();
    refreshWindow();
  }
  function payBounty(amount) {
    context.executeAction("cheatset", { type: CHEAT_ADD_MONEY, param1: amount, param2: 0 });
  }
  function questDoneMarker(q) {
    return q.done ? " - COMPLETE" : "";
  }
  function buildWidgets() {
    const widgets = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const y = 32 + i * 58;
      widgets.push({ type: "groupbox", name: `box${i}`, x: 4, y, width: 350, height: 54, text: "" });
      widgets.push({ type: "label", name: `bar${i}`, x: 10, y: y + 20, width: 250, height: 10, text: "" });
      widgets.push({ type: "label", name: `detail${i}`, x: 10, y: y + 34, width: 252, height: 10, text: "" });
      widgets.push({
        type: "button",
        name: `reroll${i}`,
        x: 268,
        y: y + 18,
        width: 76,
        height: 26,
        text: "Reroll",
        onClick: () => reroll(i)
      });
    }
    widgets.push({
      type: "label",
      name: "collected",
      x: 10,
      y: 212,
      width: 250,
      height: 10,
      text: ""
    });
    widgets.push({
      type: "button",
      name: "newset",
      x: 268,
      y: 208,
      width: 86,
      height: 26,
      text: "New quests",
      onClick: () => newSet()
    });
    return widgets;
  }
  function refreshWindow() {
    if (typeof ui === "undefined" || win === null) {
      return;
    }
    try {
      for (let i = 0; i < MAX_SLOTS; i++) {
        const q = state.quests[i];
        const box = win.findWidget(`box${i}`);
        box.text = `${q.title}${questDoneMarker(q)}`;
        const bar = win.findWidget(`bar${i}`);
        bar.text = q.done ? `${fmtMoney(q.reward)} bounty paid` : progressBar(currentProgress(q), q.target);
        const detail = win.findWidget(`detail${i}`);
        detail.text = q.done ? q.goal : `${q.goal} - ${progressDetail(q, currentProgress(q))}`;
        const rerollBtn = win.findWidget(`reroll${i}`);
        rerollBtn.isDisabled = q.done;
      }
      const collected = win.findWidget("collected");
      collected.text = `Bounties collected: ${fmtMoney(state.collected)}`;
      const newSetBtn = win.findWidget("newset");
      newSetBtn.isDisabled = !state.quests.every((q) => q.done);
    } catch {
      win = null;
    }
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
      width: 360,
      height: 246,
      title: "Quest Board",
      colours: [24, 1, 1],
      widgets: buildWidgets(),
      onClose: () => {
        win = null;
      }
    });
    refreshWindow();
  }
  function main() {
    loadState();
    context.subscribe("interval.day", onDay);
    if (typeof ui !== "undefined") {
      ui.registerMenuItem("Quest Board", openWindow);
      if (context.mode === "normal") {
        openWindow();
      }
    }
  }
  registerPlugin({
    name: "Quest Board",
    version: "0.1.0",
    authors: ["sleuthy-sloth"],
    type: "local",
    licence: "MIT",
    targetApiVersion: context.apiVersion,
    main
  });
})();
