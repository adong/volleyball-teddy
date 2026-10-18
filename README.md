# VolleyBaTTle (working title)

[![VolleyBaTTle title screen](docs/screenshot.jpg)](https://adong.github.io/volleyball-teddy/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap **中文 / EN** under it to switch between English and 中文 (the dashboard and every game remember the choice).

A beach volleyball game for Teddy and Tommy, played like the classic 1997 two-player volleyball game: one player on each side of the net, a big bouncy ball, jump to hit it, spike it at the top of your jump, and dive to save the low ones. Whoever lets the ball touch the sand on their side loses the point.

It's built with Claude Code from plain JavaScript and Three.js, on the shared Claude Games kit. There are no image, model or audio files: the players are the kit's blocky characters, every texture is painted on a canvas, and every sound is synthesised.

Either player can call the other brother in as a companion. He runs onto your side for 10 seconds, sets the ball up for your spike, hands you a treat and saves one ball from the sand.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/volleyball-teddy.html` is the whole game inlined, about 790 KB. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name volleyball-teddy`

On the title screen:

- **1 PLAYER** is you against the computer. **2 PLAYERS** is two kids on one keyboard.
- Pick each side's player with the ◀ ▶ arrows. Teddy and Tommy are the default, and anyone from the kit roster can play. The card shows who your companion will be.
- **CPU** sets the computer's level:
  - **🐣 EASY**, for little players like Tommy (5). It's slow to react, often a step out of place, has slower legs and hardly ever spikes.
  - **🔥 NORMAL**, for big kids like Teddy (8). It reads the ball well, spikes about half its chances, dives for far balls and calls its own companion when it's 3 points behind.
- **FIRST TO** sets the points to win: 15 (the classic) or 7 (a quick game). There's no "win by two".
- **SPEED** sets the game speed: 🐇 CLASSIC is the original pace, and 🐢 CHILL runs everything at 78%.
- **REPLAY** turns the slow-motion replay of the winning point on or off.

The settings are remembered on that device.

## Controls

| | Player 1 | Player 2 | Touch (1 player) |
|---|---|---|---|
| run | A D | ← → | ◀ ▶ |
| jump | W | ↑ | ⬆ JUMP |
| spike (in the air) / dive (on the sand) | F | L (or numpad 0) | 💥 |
| aim the spike down (hold while spiking) | S | ↓ | automatic near the net |
| call your brother | T | Enter | tap his face |

- In 1-player mode both key sets control you, so arrows + L + Enter work too.
- **P** or Esc pauses, and **M** turns the sound on or off. The ❚❚ and 🔊 buttons at the top right do the same.
- **Menus:** on the title screen, Enter or 1 starts 1 player and 2 starts 2 players. A D change player 1, and ← → change player 2. On the results screen, Enter plays again, R shows the replay and Esc goes back to the menu.
- The touch buttons show in 1-player mode on phones and tablets. Two players need a keyboard.

## How it plays

The rules are the classic game's:

- **Everything bounces.** The ball bounces off heads, the side walls (the striped posts with nets), the ceiling and the top of the net. There are no outs, so a ball can only be lost on the sand.
- **The scorer serves.** The serve floats above the server for a moment and then drops. Standing still bounces it over the net, and a good jump spikes it.
- **Hits:** the ball bounces off you upward, and sideways by how far off-centre it hit you. Get just behind the ball to send it over.
- **Spike:** press the hit button in the air. A swing lasts 0.3 s and you get one per jump, so time it for the top of your jump.
  - Hold left or right while spiking to hit harder.
  - Hold down to smash it into the sand, or up to lob it.
  - With no direction held, it's a flat line drive.
  - Every spike makes a comic **POW!** (or WHAM!, KAPOW!, SMASH!, BOOM!) with flying stars, a ghost trail behind the ball and a little camera shake.
- **Dive:** press the hit button on the sand. You dive the way you're holding, or toward the ball if you're not holding anything. Your stretched-out body scoops up low balls ("DIG!"), and then you take a moment to get up.
- **Signature moves:**
  - **Teddy** spikes with his basketball jump shot pose.
  - When he wins a point he shadow-boxes Tyson-style, and when he wins the match he keeps boxing under the confetti.
  - **Tommy** celebrates with his Y pose (比耶), both arms up with peace fingers, hopping.
  - Everyone else waves.

### The end of a match

1. "GAME!" when the last point lands.
2. The slow-motion **🎬 REPLAY** of the winning point, if it's switched on. It zooms in, letterboxes, and slows right down around the winning spike. Tap or press any key to skip it.
3. The winner's signature celebration with confetti and "TEDDY WINS!".
4. The results card: points, spikes, diving saves, brother saves and the longest rally. From here you can watch the replay again.

Losing to the computer says "So close! Call your brother in and try again!"

## Call your brother (companion mode)

Your companion is the other brother: **Tommy** comes for everyone, and **Teddy** comes when Tommy is playing (that's `Kit.roster.buddyFor`).

- **Calling him:** press T (player 1), Enter (player 2), tap his face button (touch), or click his face in the scoreboard.
- **Arriving:** he runs onto your side behind you, wearing a name tag in your colour. He says hi with his signature move: Teddy's Tyson-style jab and straight, or Tommy's Y pose.
- **The treat:** he tosses you a treat (🍦 💧 🧃 🍪 🍉 🍌), which flies into your hand, with a toast like "🍦 ICE CREAM FROM TOMMY!".
- **He's your setter.** Whenever the ball comes down on your side, he runs under it and bumps it ("SET!") so it peaks just in front of you at the top of your jump.
  - Jump into his set and you spike it automatically, even without the button. Near the net it's smashed down.
  - If you don't jump, it bounces off your head and over the net.
- **He protects you.** The first ball that's about to hit your sand while he's there gets saved: he dives under it and pops it back up for you ("TEDDY SAVED IT!"). That's one save per visit.
- **Tap again while he's there** for another treat and another hello.
- **His bar:** the little bar with his face in the scoreboard shows how long he's staying. It glows while he's there.
- **Leaving:** after 10 s he says bye with his goodbye move (Teddy's 🏀 jump shot or Tommy's Y) and runs off.
- **Resting:**
  - In 1-player mode you can call him again straight away, as often as you like.
  - In 2-player mode each side's companion rests for 5 s after leaving. His face is grey while the bar refills, and pressing then just makes it wiggle.
  - The computer's companion also rests for 5 s.

## How it works, and how it's tested

- **The engine (`js/engine.js`)** has no Three.js and no DOM. A match is plain state stepped at a fixed 60 ticks a second (2 physics substeps each), so the browser game, the CPU's predictions and the headless runner all use the same code.
  - Units are metres and seconds: a 14 m court, a 2.6 m net, a 0.62 m ball radius and 19.5 m/s² gravity. The numbers are scaled from the 1997 game.
  - The ball collides with the net as a circle against a box, so the corners of the tape deflect it naturally.
  - A ball can't balance on the tape (it always rolls off), and a hit is never perfectly straight up, so nothing juggles forever.
- **The CPU (`js/cpu.js`)** thinks every 0.2 s (Normal) or 0.4 s (Easy).
  - It predicts the ball's flight with the engine's own physics. Then it either times a jump so a spike meets the ball at the top, stands just behind where the ball will come down, or dives.
  - Its mistakes come from standing a little off (more for fast balls), a short "surprise" after your spike, and getting sloppier in very long rallies.
- **The renderer (`js/game.js`)** only reads match state and turns the engine's events into effects, sounds, banners and toasts.
  - Every tick is also recorded (the last 10 s), and the replay plays those frames back.
  - Behind the title screen, two CPUs play a quiet demo match.
- **Headless match runner** (no browser):

```bash
node tools/soak.js 300
```

```bash
node tools/soak.js 5 --maxRally 0.5
```

```bash
node tools/soak.js 60 --versus kid,easy
```

- The first plays 300 full CPU-vs-CPU matches (random Easy and Normal pairings, first to 15 or 7, with companions called now and then).
  - It checks that every match finishes, the ball is never stuck (it moves less than 0.3 m in 4 s) or outside the court, and players stay on their own side.
  - It exits with status 1 on any problem.
- The second proves that check can fail: every rally longer than 0.5 s is reported.
- The third gives win counts for a test bot against a CPU level.
- **Results at the last check:**
  - 300 of 300 matches finished with no problems. Matches lasted about 3.7 minutes, a rally about 11 s, and the longest rally was 44 s.
  - At the 🐢 CHILL speed, 60 of 60 finished.
  - A dropped ball balanced dead-centre on the net tape rolls off and lands within 1.6 s.
  - With gravity switched off, the stuck check reports the frozen ball.
  - Two test bots stand in for kids. The "little kid" bot (reacts in 0.45 s, often 1 m out of place) beat Easy in 72 of 120 matches. The "big kid" bot beat Normal in 47 of 120.
  - With the companion called whenever he's free, the little kid beat Easy 59 of 60, and the big kid beat Normal 54 of 60.
- **Console hooks** (`window.game`):

```js
game.start({ p0: 'teddy', p1: 'tommy', level: 'easy', target: 7 })  // straight into a match (twoP: true for 2 players)
game.step(2)          // advance 2 s and draw (the hidden Browser pane throttles requestAnimationFrame)
game.ff(30, (m) => m.ball.power > 1)  // fast-forward without drawing, until a spike
game.freeze()         // stop the real-time loop, for screenshots of an exact moment
game.buddy(0)         // call player 1's companion (1 for player 2)
game.soak(100)        // the headless runner, in the browser
game.versus('kid', 'easy', 50)
game.state()          // score, ball, players, companions
```

## Files

```
index.html        page, HUD, menus, touch buttons (CSS inline)
js/title.js       the game's name, in one constant (VB_TITLE), plus the logo
js/engine.js      the rules: court, ball physics, players, spikes, dives, companions, scoring
js/cpu.js         CPU levels, kid-like test bots, headless sim / soak / versus
js/input.js       keyboard for two players, touch buttons
js/poses.js       volleyball poses on top of Kit.people.pose
js/stage.js       the beach: sea, sand, net, bouncy side walls, palms, umbrellas, sandcastle, boat
js/fx.js          POW bursts, stars, sand puffs, rings, floating words, confetti
js/sfx.js         volleyball sounds on top of Kit.sound
js/game.js        scene, camera, screens, HUD, companions and treats, replay, main loop, window.game hooks
tools/soak.js     headless CPU-vs-CPU match runner (node)
kit/              copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .), never edited here
dist/volleyball-teddy.html   the single-page build
```

## Kit candidates

These live in this game's own JS for now. They could move into `~/claude-games/kit` if another game wants them:

- **Poses** (`js/poses.js`): `ready` (knees bent, arms low), `spike` (arm cocks back and whips over), `dive` and `lie` (body flat, arms forward), `bump` (arms together), `cheer` and `aww`. They also tip and lower the whole rig, which `Kit.people.pose` doesn't touch.
- **Effects** (`js/fx.js`): the comic starburst with a word in it, floating outlined words, and confetti.
- **Sounds** (`js/sfx.js`): a rubbery ball `hit`, `spike`, sand `floor` thud, net twang and a referee's `whistle`.

## Not verified

- **Sound:** the synth code runs without errors, but nobody listened to it.
- **Real touch devices:** the touch buttons were tested with synthetic pointer events in phone emulation (740×360 and 812×375) and headless Chrome, not on a real phone or iPad. Two thumbs at once (run and jump together) is untested.
- **Double-click from Finder:** both `index.html` and `dist/volleyball-teddy.html` were opened from `file://` in headless Chrome and played. Nobody has actually double-clicked them in Finder, or tried them in Safari. The page only uses classic `<script src>` tags and makes no network requests other than the optional Google font.
- **How it feels:** the physics constants are scaled from the original and the balance was tuned with bots. A real kid hasn't played it yet, so the speed, jump height and CPU levels may want a tweak after the first try.
