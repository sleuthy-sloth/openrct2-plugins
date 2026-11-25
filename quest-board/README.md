# Quest Board

Procedural park quests for OpenRCT2 with cash bounties.

The board rolls three quests when a park starts: guest counts, park rating,
cash earned, ride count, ride excitement, or park value. Progress updates every
in-game day. Finishing a quest pays the bounty (added through the game's
`cheatset` add-money action) and posts the result to the park's news feed.

Each quest can be rerolled individually, and a full new set is offered once all
three are complete. Bounties collected so far are shown at the bottom.

## Install

Copy `dist/quest-board.js` into OpenRCT2's plugin folder:

- Linux: `~/.config/OpenRCT2/plugin`
- Windows: `%USERPROFILE%\Documents\OpenRCT2\plugin`
- macOS: `~/Library/Application Support/OpenRCT2/plugin`

Then restart OpenRCT2. The window opens automatically when a park loads, and
stays available in the map (utilities) dropdown menu.

## Notes

- Quest state is stored in the park file, so each park has its own board and
  quests survive save/load.
- "Earn" quests track cash gained since the quest was issued, not total cash.
- Bounties go through the cheat action system, so a multiplayer server that
  blocks cheats may also block payouts (the quest still completes).
- Ride excitement is the best rating among all rides.

## Untested

Layout and in-game behavior have not been run in the game yet - the plugin has
only been verified by type checking and bundling. Report oddities in visual
layout first.

## Roadmap

- Quest deadlines
- More quest kinds (shop sales, litter, vandalism)
