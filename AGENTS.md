# AGENTS.md

Conventions for anyone writing code here, AI agents included.

## Comments

A comment explains why the code exists: the responsibility it holds, the
constraint it satisfies, or the failure it prevents. It never restates what the
code does. Reading the code tells you that.

- Write one when the reason can't be seen in the code: a non-obvious decision,
  a workaround, an invariant, a trade-off.
- Rename before you comment. If a better name makes the comment redundant, use
  the name instead.
- Keep it short: one or two lines. A longer comment needs a strong reason.
- No history ("changed from X", "added in step 5"). Git keeps that.
- Exported functions may carry a short contract comment: what the caller can
  rely on (guarantees, errors, side effects), never how it works inside. A
  caller shouldn't need to read the body to use it safely.

```ts
// ✗ Restates the code.
// Hash the file contents with sha256.
const checksum = createHash("sha256").update(bytes).digest("hex");

// ✓ Explains a decision the code can't show.
// Raw bytes: any edit to an applied migration, even whitespace, is a change.
const checksum = createHash("sha256").update(bytes).digest("hex");
```
