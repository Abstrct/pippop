# The Pip Pop playtest lab

Automated QA asks "does it work?". This lab asks the questions a studio puts to playtesters: is it fun, is it clear, where do people get stuck, what delights them. Playtesters (people, or AI agents with personas) play the real game on the **private devnet** through a small CLI that works the way a player does: look at the screen, tap things by the name they see, spin the mat, type. Every step is recorded.

```
playtest/
  lab.mjs        the lab: one headless Chrome, an isolated browser context per tester, HTTP on :7810
  pt / pt.mjs    the tester's hands and eyes (CLI)
  report.mjs     a run's logs → report.md + report.json
  lib/cdp.mjs    Chrome DevTools driver (borrowed from Wyrmhold's proving ground, plus isolated contexts)
  lib/probe.mjs  what the lab reads in the page: controls by name, counters, signs, bubbles, cards,
                 3D toys projected to the screen, game state, frame rate, long tasks, errors
  runs/<run>/<tester>/   log.jsonl and a screenshot for every step
```

## Run a session

```bash
bash devnet/setup.sh status                     # the private chain must be up (see the main README)
LAB_GPU=1 STRUCTSD=/path/to/structsd LAB_RUN=my-run node playtest/lab.mjs
playtest/pt mia start desktop "first-time parent"
playtest/pt mia look
playtest/pt mia tap New
playtest/pt mia tapthing Bear
playtest/pt mia note "[confusing] what does the wind number mean?"
playtest/pt mia verdict fun=4 clarity=2 magic=5 feel=4 "summary"
playtest/pt mia end
node playtest/report.mjs my-run
```

- Each tester gets its own storage, so its own key and its own kid. Testers on the same run share the devnet, so they can roll to and bonk each other.
- Devices: `desktop` 1280×800, `wide` 1440×900, `tablet` 834×1112 (touch), `phone` 390×844 (touch). Touch devices get real touch events.
- `LAB_GPU=1` renders on the machine's GPU (Metal on a Mac), so frame rates are a player's. Without it Chrome uses software WebGL, which is steadier on CI but runs at single-digit fps.
- Hashing is limited to 2 CPU threads per tester, so ten testers can share a machine.
- `faucet` gives up to 10 stars from the devnet's test account. It is a test cheat and the report says so.
- Nothing here signs up or acts on a public network.
