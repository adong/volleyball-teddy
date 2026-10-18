/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "VolleyBaTTle",
  cols: ["Player 1", "Player 2"],
  keys: [
    ["run", "A D", "← →"],
    ["jump", "W", "↑"],
    ["spike (in the air) · dive (on the sand)", "F", "L"],
    ["hold while spiking: smash down", "S", "↓"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work.",
  touch: "In 1 player: ◀ ▶, ⬆ JUMP and 💥. Tap your brother's face to call him.",
});
