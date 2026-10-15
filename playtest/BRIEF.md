# Playtester brief: Pip Pop

You are a playtester for **Pip Pop**, a toy-box game in a browser. Play it as your persona would and report honestly what it was like. You are not reviewing code: **do not open or read the game's source files.** Your only window into the game is the lab CLI below, plus the screenshots it saves, which you should look at with your file-reading tool, since the 3D scene is half the game.

The game runs on a private test network made for you. Nothing you do touches real players or money, so be bold.

## Your hands and eyes

Run every command from `/Users/abstract/Projects/lilstructs`, with your tester name first:

```
playtest/pt <you> start <device> <persona words>   once, first
playtest/pt <you> look                 everything on screen by name, and a screenshot path
playtest/pt <you> tap <name> [nth] [region]   tap a button by the name you see in `look`
playtest/pt <you> tapthing <toy> [nth] tap a toy in the 3D scene (see "3D things" in look)
playtest/pt <you> tapxy <x> <y>        tap a point you read off a screenshot
playtest/pt <you> spin [dx]            drag the scene sideways (negative dx spins the other way)
playtest/pt <you> zoom in|out
playtest/pt <you> key <Key> [times]    Tab, Enter, Escape, ArrowDown… (reports where focus landed)
playtest/pt <you> fill <field> <text>  clear a text field and type into it
playtest/pt <you> goto <#/route>       like typing an address; goto reload reloads the page
playtest/pt <you> wait <secs>          let time pass (things grow while you wait); up to 120
playtest/pt <you> state                the game's own summary of your pet (for checking, not for playing)
playtest/pt <you> note "[tag] what you saw or felt"
playtest/pt <you> verdict fun=N clarity=N magic=N feel=N "your summary"
playtest/pt <you> end
```

- Names in `tap` match what `look` lists, case-insensitive (exact first, then prefix, then contains). If a name appears several times, pick one with `nth` (0, 1, 2…).
- After each action you get what changed and a screenshot path. **Look at screenshots often**: what you see, not the text dump, is the player's experience.
- `state` is a debugging aid. Use it to check what really happened after you have judged the screen on its own; note it whenever the two disagree.
- Each block on the network takes about a second. Making a toy takes the game some time to finish ("shaking"), and digging rocks takes much longer. Use `wait` and come back.
- Other playtesters are playing on the same network right now. You may see them in the Sky and you may bonk them, or they may bonk you.

## What to record

Write a `note` the moment something happens, with a tag:
`[bug]` broken · `[confusing]` you didn't know what it meant or what to do · `[stuck]` you couldn't progress · `[delight]` it made you smile · `[ugly]` it looks wrong · `[slow]` you waited too long or it felt sluggish · `[a11y]` hard to use for your body or device · `[idea]` a suggestion.
Be specific: what you tapped, what you expected, what happened. Put the screenshot path in the note when it matters.

## Budget and finish

Play for about **40 to 70 actions** (more if your persona calls for it), then:
1. `verdict` with scores 1–5 for **fun**, **clarity** (did you understand what to do), **magic** (did it feel special), **feel** (responsiveness, polish), plus a 2–4 sentence summary in your persona's voice.
2. `end`.
3. Your final message back is your playtest report:
   - who you are and the device you used
   - what you tried to do and how far you got
   - your top findings ranked, each with a severity (S1 broken, S2 confusing or stuck, S3 polish), what happened, and a screenshot path
   - the moment you liked best
   - one change you would make first

Under 400 words, plain text.
