"use strict";
(() => {
  // peep-stories/src/plugin.ts
  var WINDOW_CLASS = "peep-stories";
  var STORAGE_KEY_PREFIX = "story.";
  var STORY_LINE_WIDTH = 52;
  var STORY_MAX_LINES = 13;
  function pick(seed, bank) {
    return bank[Math.abs(seed * 2654435761) % bank.length];
  }
  function wrapText(text, width) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      if (line.length === 0) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += " " + word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line.length > 0) {
      lines.push(line);
    }
    return lines;
  }
  function bar(value, min, max, label) {
    const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const filled = Math.round(ratio * 10);
    return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}] ${label}`;
  }
  var ITEM_LABELS = {
    balloon: "a balloon",
    hat: "a hat",
    tshirt: "a t-shirt",
    toy: "a toy",
    umbrella: "an umbrella",
    photo1: "an on-ride photo",
    photo2: "a photo",
    photo3: "a photo",
    photo4: "a photo",
    sunglasses: "sunglasses",
    burger: "a burger",
    chips: "fries",
    ice_cream: "an ice cream",
    candyfloss: "candyfloss",
    drink: "a drink",
    pizza: "a slice of pizza",
    pretzel: "a pretzel",
    cookie: "a cookie",
    coffee: "a coffee",
    hot_dog: "a hot dog"
  };
  function itemLabel(type) {
    return ITEM_LABELS[type] ?? "some souvenir";
  }
  var ARRIVALS = [
    "caught the first bus in and beat the gates",
    "parked three lots over to save two dollars",
    "has been talking about this trip for three weeks",
    "won these tickets at the county fair",
    "traded a Saturday shift at work to be here",
    "arrived with a plan and a laminated park map",
    "says the drive out is half the fun, and means it",
    "took the day off unpaid and calls it an investment"
  ];
  var QUIRKS = [
    "counts the coasters before doing anything else",
    "refuses to ride anything without a lap bar",
    "collects a map on every visit, ever since 2019",
    "has strong opinions about pretzel salt distribution",
    "naps on the bench by the fountain, every single time",
    "rates every corn dog in the tri-state area out of ten",
    "will not admit which ride made them sick last summer",
    "buys a souvenir on the way in, to get it out of the way"
  ];
  var HUNGRY_LINES = [
    "is hungry enough to hear the churro stand calling their name",
    "has been circling the food court like a shark with a wristband",
    "would trade the hat right off their head for a hot dog"
  ];
  var THIRSTY_LINES = [
    "would trade that balloon for a cold lemonade and not think twice",
    "is on hour three of nothing but fountain soda and pretzel salt"
  ];
  var TOILET_LINES = [
    "is doing a very determined walk toward the nearest restroom",
    "is polite about it, but the situation is becoming urgent"
  ];
  var NAUSEA_LINES = [
    "is regretting the third lap on the spinner, silently",
    "is practicing some very controlled breathing near a bench"
  ];
  var TIRED_LINES = [
    "is running on fumes and stubbornness",
    "claims to be fine while visibly considering a bench nap"
  ];
  var LOST_LINES = [
    "has now passed the same kettle corn stand three times and will not admit to being lost",
    "is lost, but committed to acting like this is the scenic route",
    "asked a stranger for directions, got new ones, and is somehow more lost"
  ];
  var BROKE_LINES = [
    "is down to pocket lint and watching rides from the fence line",
    "spent the last of it on entry and calls that a choice"
  ];
  var HAPPY_KICKERS = [
    "By their own count, best day of the season.",
    "Would do the whole day again, in this exact order.",
    "Already planning who to bring next time."
  ];
  var MID_KICKERS = [
    "So far, a perfectly solid afternoon.",
    "No complaints filed, a few noted.",
    "The day is holding at three stars out of five, with upside."
  ];
  var SAD_KICKERS = [
    "The day hasn't gone to plan yet, but there is still time.",
    "Tomorrow will be better, and they intend to test that.",
    "Is keeping score, and the score is not favorable."
  ];
  function moodKicker(happiness) {
    if (happiness >= 192) {
      return pick(happiness, HAPPY_KICKERS);
    }
    if (happiness >= 96) {
      return pick(happiness, MID_KICKERS);
    }
    return pick(happiness, SAD_KICKERS);
  }
  function pressingNeed(s) {
    if (s.isLost) {
      return pick(s.id, LOST_LINES);
    }
    if (s.toilet > 200) {
      return pick(s.id + 1, TOILET_LINES);
    }
    if (s.hunger < 60) {
      return pick(s.id + 2, HUNGRY_LINES);
    }
    if (s.thirst < 60) {
      return pick(s.id + 3, THIRSTY_LINES);
    }
    if (s.nausea > 170) {
      return pick(s.id + 4, NAUSEA_LINES);
    }
    if (s.energy < 55) {
      return pick(s.id + 5, TIRED_LINES);
    }
    if (s.cash < 30) {
      return pick(s.id + 6, BROKE_LINES);
    }
    return "";
  }
  function generateStory(s) {
    const name = s.name;
    const arrival = pick(s.id + 7, ARRIVALS);
    const quirk = pick(s.id + 8, QUIRKS);
    const sentences = [];
    sentences.push(`${name} ${arrival}.`);
    sentences.push(`They ${quirk}.`);
    const need = pressingNeed(s);
    if (need !== "") {
      sentences.push(`Right now, ${name} ${need}.`);
    } else if (s.items.length > 0) {
      sentences.push(`They are carrying ${s.items.map(itemLabel).join(" and ")} and guarding ${s.items.length > 1 ? "them" : "it"} like winnings.`);
    } else if (s.favouriteRide !== null) {
      sentences.push(`Ask them where to start and they will point you straight to ${s.favouriteRide}.`);
    }
    sentences.push(moodKicker(s.happiness));
    return sentences.join(" ");
  }
  function toStoryInputs(guest) {
    const thoughtTypes = guest.thoughts.map((t) => t.type);
    let favName = null;
    if (guest.favouriteRide !== null) {
      for (const ride of map.rides) {
        if (ride.id === guest.favouriteRide) {
          favName = ride.name;
          break;
        }
      }
    }
    return {
      name: guest.name,
      happiness: guest.happiness,
      energy: guest.energy,
      hunger: guest.hunger,
      thirst: guest.thirst,
      toilet: guest.toilet,
      nausea: guest.nausea,
      cash: guest.cash,
      isLost: guest.isLost,
      isInPark: guest.isInPark,
      thoughts: thoughtTypes,
      items: guest.items.map((i) => i.type),
      favouriteRide: favName,
      id: guest.id ?? 0
    };
  }
  var win = null;
  function buildWidgets(name, story, guest) {
    const widgets = [
      { type: "label", name: "gname", x: 8, y: 16, width: 300, height: 10, text: name },
      { type: "label", name: "v_mood", x: 8, y: 30, width: 140, height: 10, text: bar(guest.happiness, 0, 255, "mood") },
      { type: "label", name: "v_energy", x: 8, y: 42, width: 140, height: 10, text: bar(guest.energy, 32, 128, "energy") },
      { type: "label", name: "v_hunger", x: 8, y: 54, width: 140, height: 10, text: bar(255 - guest.hunger, 0, 255, "hunger") },
      { type: "label", name: "v_thirst", x: 8, y: 66, width: 140, height: 10, text: bar(255 - guest.thirst, 0, 255, "thirst") },
      { type: "label", name: "v_toilet", x: 8, y: 78, width: 140, height: 10, text: bar(guest.toilet, 0, 255, "bathroom") }
    ];
    if (guest.nausea > 100) {
      widgets.push({ type: "label", name: "v_nausea", x: 152, y: 30, width: 160, height: 10, text: bar(guest.nausea, 0, 255, "nausea") });
    }
    if (guest.cash < 60) {
      widgets.push({
        type: "label",
        name: "v_cash",
        x: 152,
        y: 42,
        width: 160,
        height: 10,
        text: `Carrying ${context.formatString("{CURRENCY2DP}", guest.cash)}`
      });
    }
    const lines = wrapText(story, STORY_LINE_WIDTH).slice(0, STORY_MAX_LINES);
    for (let i = 0; i < lines.length; i++) {
      widgets.push({ type: "label", name: `line${i}`, x: 8, y: 96 + i * 10, width: 304, height: 10, text: lines[i] });
    }
    widgets.push({
      type: "button",
      name: "rewrite",
      x: 8,
      y: 236,
      width: 80,
      height: 22,
      text: "Rewrite",
      onClick: () => rewriteStory(guest)
    });
    widgets.push({
      type: "button",
      name: "close",
      x: 96,
      y: 236,
      width: 60,
      height: 22,
      text: "Close",
      onClick: () => {
        if (win !== null) {
          win.close();
        }
      }
    });
    return widgets;
  }
  function showStory(guest, story) {
    if (typeof ui === "undefined") {
      return;
    }
    ui.closeWindows(WINDOW_CLASS);
    win = ui.openWindow({
      classification: WINDOW_CLASS,
      width: 320,
      height: 268,
      title: "Peep Stories",
      colours: [24, 1, 1],
      widgets: buildWidgets(guest.name, story, guest),
      onClose: () => {
        win = null;
      }
    });
  }
  function rewriteStory(guest) {
    const story = generateStory(toStoryInputs(guest));
    context.getParkStorage().set(STORAGE_KEY_PREFIX + guest.id, story);
    showStory(guest, story);
  }
  function onToolDown(e) {
    if (e.entityId === void 0) {
      return;
    }
    const entity = map.getEntity(e.entityId);
    if (entity === null || entity.type !== "guest") {
      return;
    }
    const guest = entity;
    const storage = context.getParkStorage();
    let story = storage.get(STORAGE_KEY_PREFIX + guest.id);
    if (story === void 0) {
      story = generateStory(toStoryInputs(guest));
      storage.set(STORAGE_KEY_PREFIX + guest.id, story);
    }
    showStory(guest, story);
  }
  function main() {
    if (typeof ui !== "undefined") {
      ui.registerMenuItem("Peep Stories", () => {
        ui.activateTool({
          id: "peep-stories-pick",
          cursor: "hand_point",
          filter: ["entity"],
          onDown: onToolDown
        });
      });
    }
  }
  registerPlugin({
    name: "Peep Stories",
    version: "0.1.0",
    authors: ["sleuthy-sloth"],
    type: "local",
    licence: "MIT",
    targetApiVersion: context.apiVersion,
    main
  });
})();
