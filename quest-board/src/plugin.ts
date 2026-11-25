/**
 * Quest Board - procedural park quests with cash bounties for OpenRCT2.
 *
 * Rolls three quests per park, tracks progress day by day, pays the bounty
 * through the game's cheatset action (CheatType::addMoney) when a quest is
 * completed, and posts the completion to the park's news feed. State lives in
 * the park storage, so quests survive save/load and are per-park.
 */

const STORAGE_KEY = "questboard.v1";
const WINDOW_CLASS = "quest-board";
const MAX_SLOTS = 3;

// CheatType::addMoney, positionally defined in src/openrct2/Cheats.h
const CHEAT_ADD_MONEY = 16;

type QuestKind = "guests" | "rating" | "earn" | "rides" | "excitement" | "value";

interface Quest {
    id: number;
    kind: QuestKind;
    title: string;
    goal: string;
    target: number;
    reward: number;
    /** Cash level when this quest was issued; only used by "earn" quests. */
    startCash: number;
    done: boolean;
}

interface QuestState {
    nextId: number;
    quests: Quest[];
    /** Total bounty money paid out so far. */
    collected: number;
}

interface QuestTemplate {
    kind: QuestKind;
    titles: string[];
    /** Target range and step, in the quest's own units. */
    minTarget: number;
    maxTarget: number;
    step: number;
    /** Bounty in money units, derived from the rolled target. */
    reward: (target: number) => number;
    goal: (target: number) => string;
}

const TEMPLATES: QuestTemplate[] = [
    {
        kind: "guests",
        titles: ["Crowd Magnet", "Standing Room Only", "Gate Busters"],
        minTarget: 250,
        maxTarget: 800,
        step: 25,
        reward: (t) => t * 40,
        goal: (t) => `Have ${t} guests in the park at once`,
    },
    {
        kind: "rating",
        titles: ["Talk of the Town", "Rave Reviews", "Park of the Year"],
        minTarget: 550,
        maxTarget: 925,
        step: 25,
        reward: (t) => t * 20,
        goal: (t) => `Raise the park rating to ${t}`,
    },
    {
        kind: "earn",
        titles: ["Cash Cow", "Coin Rush", "Boom Times"],
        minTarget: 15000,
        maxTarget: 120000,
        step: 5000,
        reward: (t) => Math.round(t * 0.5),
        goal: (t) => `Pocket ${fmtMoney(t)} in earnings`,
    },
    {
        kind: "rides",
        titles: ["Full Roster", "One More Ride", "Expansion Drive"],
        minTarget: 4,
        maxTarget: 13,
        step: 1,
        reward: (t) => t * 3000,
        goal: (t) => `Have ${t} rides in the park`,
    },
    {
        kind: "excitement",
        titles: ["Thrill Seekers", "White-Knuckle Club", "Fear Merchants"],
        minTarget: 400,
        maxTarget: 825,
        step: 25,
        reward: (t) => t * 30,
        goal: (t) => `Build a ride rated ${excitementDisplay(t)} excitement or higher`,
    },
    {
        kind: "value",
        titles: ["Prime Property", "Company Valuation", "Priceless"],
        minTarget: 300000,
        maxTarget: 1250000,
        step: 50000,
        reward: (t) => Math.round(t / 20),
        goal: (t) => `Grow the park value to ${fmtMoney(t)}`,
    },
];

let state: QuestState = { nextId: 1, quests: [], collected: 0 };
let win: Window | null = null;

// ---------------------------------------------------------------------------
// Money and display helpers
// ---------------------------------------------------------------------------

/** Game money is stored in fixed-point units of 1/10. */
function fmtMoney(units: number): string {
    return context.formatString("{CURRENCY2DP}", units);
}

function fmtNumber(n: number): string {
    return n.toLocaleString("en-US");
}

function excitementDisplay(units: number): string {
    return (units / 100).toFixed(2);
}

function progressBar(progress: number, target: number): string {
    const ratio = target > 0 ? Math.max(0, Math.min(1, progress / target)) : 0;
    const filled = Math.round(ratio * 10);
    const pct = Math.floor(ratio * 100);
    return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}] ${pct}%`;
}

// ---------------------------------------------------------------------------
// State: load / save / generation
// ---------------------------------------------------------------------------

function loadState(): void {
    const storage = context.getParkStorage();
    const loaded = storage.get<QuestState | undefined>(STORAGE_KEY);
    if (loaded && Array.isArray(loaded.quests)) {
        state = loaded;
        // Heal earn quests whose baseline was saved from another park.
        for (const q of state.quests) {
            if (q.kind === "earn" && !q.done && q.startCash === undefined) {
                q.startCash = park.cash;
            }
        }
    }
    while (state.quests.length < MAX_SLOTS) {
        state.quests.push(makeQuest());
    }
    saveState();
}

function saveState(): void {
    context.getParkStorage().set(STORAGE_KEY, state);
}

function makeQuest(avoidKinds: QuestKind[] = []): Quest {
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
        done: false,
    };
}

function reroll(slot: number): void {
    const otherKinds = state.quests.filter((_, i) => i !== slot).map((q) => q.kind);
    state.quests[slot] = makeQuest(otherKinds);
    saveState();
    refreshWindow();
}

function newSet(): void {
    state.quests = [makeQuest(), makeQuest(), makeQuest()];
    saveState();
    refreshWindow();
}

// ---------------------------------------------------------------------------
// Progress and completion
// ---------------------------------------------------------------------------

function currentProgress(q: Quest): number {
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

function progressDetail(q: Quest, progress: number): string {
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

function onDay(): void {
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

function payBounty(amount: number): void {
    context.executeAction("cheatset", { type: CHEAT_ADD_MONEY, param1: amount, param2: 0 });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function questDoneMarker(q: Quest): string {
    return q.done ? " - COMPLETE" : "";
}

function buildWidgets(): WidgetDesc[] {
    const widgets: WidgetDesc[] = [];
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
            onClick: () => reroll(i),
        });
    }
    widgets.push({
        type: "label",
        name: "collected",
        x: 10,
        y: 212,
        width: 250,
        height: 10,
        text: "",
    });
    widgets.push({
        type: "button",
        name: "newset",
        x: 268,
        y: 208,
        width: 86,
        height: 26,
        text: "New quests",
        onClick: () => newSet(),
    });
    return widgets;
}

function refreshWindow(): void {
    if (typeof ui === "undefined" || win === null) {
        return;
    }
    try {
        for (let i = 0; i < MAX_SLOTS; i++) {
            const q = state.quests[i];
            const box = win.findWidget<GroupBoxWidget>(`box${i}`);
            box.text = `${q.title}${questDoneMarker(q)}`;
            const bar = win.findWidget<LabelWidget>(`bar${i}`);
            bar.text = q.done
                ? `${fmtMoney(q.reward)} bounty paid`
                : `${progressBar(currentProgress(q), q.target)} ${progressDetail(q, currentProgress(q))}`;
            const detail = win.findWidget<LabelWidget>(`detail${i}`);
            detail.text = q.goal;
            const rerollBtn = win.findWidget<ButtonWidget>(`reroll${i}`);
            rerollBtn.isDisabled = q.done;
        }
        const collected = win.findWidget<LabelWidget>("collected");
        collected.text = `Bounties collected: ${fmtMoney(state.collected)}`;
        const newSetBtn = win.findWidget<ButtonWidget>("newset");
        newSetBtn.isDisabled = !state.quests.every((q) => q.done);
    } catch {
        // The window was closed; ignore.
        win = null;
    }
}

function openWindow(): void {
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
        height: 238,
        title: "Quest Board",
        colours: [24, 1, 1],
        widgets: buildWidgets(),
        onClose: () => {
            win = null;
        },
    });
    refreshWindow();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
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
    main,
});
