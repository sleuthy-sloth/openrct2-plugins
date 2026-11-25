# Park Dashboard

One dense at-a-glance status window for OpenRCT2: finances, guest mood, and
ride status in a single panel instead of window sprawl.

- Finances: cash, company value, park rating with a weekly trend, and a
  sparkline of the last 30 days of cash (drawn live with a custom widget).
- Guests: count, average happiness, and the most common guest thoughts
  (sampled, capped at ~400 guests for performance).
- Rides: open/closed/broken/testing/simulating counts plus the three longest
  queue waits in minutes.

The window opens when a park loads and lives in the map (utilities) dropdown
menu. Data updates every in-game day, or on demand with the Refresh button.
Cash and rating history is stored in the park file, so each park keeps its own
history across saves.

## Install

Copy `dist/park-dashboard.js` into OpenRCT2's plugin folder:

- Linux: `~/.config/OpenRCT2/plugin`
- Windows: `%USERPROFILE%\Documents\OpenRCT2\plugin`
- macOS: `~/Library/Application Support/OpenRCT2/plugin`

Then restart OpenRCT2.

## Notes

- The sparkline needs a couple of in-game days before it has anything to draw.
- "Broken" counts rides with an active breakdown; a ride stuck simulating shows
  under Testing/Sim.
- Guest thoughts are counted over a sample on large parks, so numbers are
  approximate.

## Untested

Verified by type checking and bundling only; it has not been run in the game
yet. Visual layout quirks (window width, sparkline colours) are the first
things to check in-game.
