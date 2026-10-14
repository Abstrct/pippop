# Fixes from playtest pt-01

Each finding from `runs/pt-01/FINDINGS.md`, and what changed. Checked through the lab in run `verify-02`.

| Finding | Change |
|---|---|
| Making shows no progress for minutes | `pow.eta()` gives time left and progress from the moment a toy is started (waiting for the proof to get cheap counts, not just hashing). A pill with a bar and time floats over every toy being made, dug or popped; the card has a progress bar; tray chips show the time. |
| Digger never digs / no sense of when | Same progress pill and card bar for digging and popping, with "Empty" when there is nothing left. Mining is slow on the real chain by design; the wait is now visible. |
| Wind reads as a price | Costs read `≥ N` everywhere (it is a minimum; every action resets wind). The counter no longer caps at 99. |
| Shelf says "Oops" | Block codes (`nap`, `juice`, `bear`, `away`, `rocks`) map to their words. Juice shows have/need; Nap links back to the Bear. |
| Napping toys offer actions the chain refuses | A napping toy's card offers only Wake. |
| Bear vanished silently / who did it | A felled Bear shouts "Uh oh!" with the attacker's name and a Bonk-back button; other bonks name the attacker; the attacked kid is re-read at once so no screen shows a gone toy. |
| Raids say "Yay!" for 0 rocks | Raid results show `+N` rocks or "Empty"; being grabbed shows `-N` and who. |
| Busy pill and toy strip cover buttons | The tray sits beside the dock (desktop) or under the counters (phone). The Toys strip steps aside on phones while a card is open. Bubbles moved above the dock. |
| Book carousel buried | The Book starts lower; the carousel shows above it. |
| Keyboard: Toys room drops focus | The strip rebuilds only when it changes, keeping focus. Picking a toy moves focus into its card. |
| Keyboard: no way to Mat toys | A toy box on the Mat lists every toy as a button (with state badges and the fort). Escape closes cards and focus returns to the toy. |
| Dialogs don't trap focus | Tab stays inside the top dialog. |
| Destructive actions one tap from a child | Stop, Toss and Bye are hold-to-fill buttons (a grown-up gate); a tap does nothing. |
| Words hidden | A red dot on the kid chip until the words are kept; Me explains them in pictures. |
| Bad deep links spin forever | Bad ids redirect (`#/bonk/abc` → `#/bonk`, `#/mat/x` → `#/`, unknown rooms → `#/`); a missing kid shows `?` with a way to the Sky. |
| Home pressed twice sends two moves | A move already on its way is reused. |
| Spaces in names vanish | A space turns into `_` as you type. Enter submits the name. |
| Me shows the wrong club | The club name waits for the directory. |
| Book: Bear has 3 hearts | It shows the real 6. Picture recipes have spoken names. |
| Odds strip unreadable | Stable faces (Yes/Ok/Eek/No); damage shows the toy that takes it, theirs and yours. |
| Sky mobile turns under your finger | Hoops slow down and hold still while you aim at or open a mat; sleepy kids' mats are grey. Rock filter is named. |
| Toys tiny, hidden, unreactive | The camera glides in on a chosen toy and follows it. The wagon, rings, mounds and moon wobble when tapped. Every room frames itself to fit the screen width. |
| Fill and Feed don't say what you get | Both preview the juice. |
| Fort never shown | The toy box shows your fort; the Bonk steps show theirs. |
| Lid frozen in mid-air; dull colours | The lid lands beside the box. Bolder primaries on the shelf, rug and fridge. |
| Lab: `key Space` errors | Fixed (Space, Backspace, Home, End). |

## Not changed
- Juice max falls as the club grows (each kid's share of the club's juice shrinks). Not yet explained on screen.
- The Sky shows rocks and sleepy, but not hearts or away, on every mat (that needs a read per kid).
- Targeting another kid's mat toys in the arena was not re-checked.
- Counters still use numbers; a pre-reader still sees them.
