# Peep Stories

Click a park guest, get a short generated life story grounded in what is
actually happening to them. Hungry guests are hunting churros. Lost guests are
walking past the same kettle corn stand for the third time. Broke guests watch
rides from the fence line. The story is generated once per guest and saved in
the park file, so they stay the same person when you come back.

## Install

Copy `dist/peep-stories.js` into OpenRCT2's plugin folder:

- Linux: `~/.config/OpenRCT2/plugin`
- Windows: `%USERPROFILE%\Documents\OpenRCT2\plugin`
- macOS: `~/Library/Application Support/OpenRCT2/plugin`

Then restart OpenRCT2.

## Use

Map (utilities) menu, "Peep Stories". The cursor changes to a pointing hand;
click any guest. The window shows their vitals (mood, energy, hunger, thirst,
bathroom) as bars and their story underneath. Rewrite regenerates the story,
Close closes it.

## Notes

- Stories persist per park. Deleting the park deletes their stories.
- Stories react to state at the moment of the first click, not live.
- In multiplayer, run it on the client you click from; it reads state and
  writes only to your park storage.

## Untested

Verified by type checking and bundling only; it has not been run in the game
yet. First things to check in-game: guest picking with the hand cursor, story
text wrapping at the window width, and whether the Rewrite button behaves.
