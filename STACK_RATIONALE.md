# Why the stack is shaped this way

This note records *why* Momentum stores data and handles accounts the way it does, so the decisions don't get re-argued every few months.
It is rationale, not instructions - the how-to-deploy steps live in [DEPLOYMENT.md](DEPLOYMENT.md).

The short version: **we own our logic and our auth in code, and we rent exactly one commodity - the database.**
Two things we maintain, one managed dependency.
That is the whole design philosophy.

## Decision 1: Postgres, even though each user's data is one JSON document

It is tempting to reason "the data is a free-form JSON document, so it belongs in a NoSQL/document database, not a relational one like Postgres."
That reasoning is out of date, and here is why it does not apply.

**Postgres stores the document as-is.**
Postgres has a first-class binary JSON type (`JSONB`).
We do not shred a user's snapshot into columns.
We keep one row per user, roughly `users_data(user_id, version, data JSONB)`, and the entire document goes into that one `data` cell untouched - exactly the way a document database would hold it.
So we already get the document-store behavior; the relational engine is just the container.

**We also have genuinely relational data.**
Accounts, password hashes, session tokens, and email-verification records are structured, related data with uniqueness and lookup rules.
That half is textbook relational.
Postgres holds both the opaque document *and* the structured account data cleanly in one place; a pure document store would handle the blob fine but fight us on the accounts.

**Our one hard requirement is an atomic conditional write, which relational nails.**
Saves use optimistic concurrency: "write this only if the version still matches, otherwise reject," so two devices cannot silently overwrite each other.
In Postgres that is one statement inside a transaction (`UPDATE ... WHERE user_id = ? AND version = ?`; zero rows changed means a conflict, which the client resolves by adopting the server doc).
It is strongly consistent and trivial.
Several NoSQL free tiers make this same guarantee weaker (eventual consistency), pricier, or dependent on a special conditional-write API.

Conclusion: a pure document database (MongoDB, Firestore) would *work*, but for our access pattern - fetch one doc by id, write it back with a version check, plus a real accounts table - it buys nothing and costs either vendor lock-in or per-operation pricing surprises.
`JSONB`-in-Postgres is the strictly better fit.

## Decision 2: Neon as the Postgres host (not Supabase)

Neon and Supabase are **both Postgres** underneath, so this is not a relational-vs-non-relational choice.
It is only "which host wraps Postgres in the way we want."

- **Neon** is managed Postgres and little else - a clean database box that auto-resumes from idle in under a second.
- **Supabase** is Postgres plus a platform bolted on: a built-in auth system, file storage, realtime, and an auto-generated API over the tables.

Two reasons Neon wins here:

1. **We already own our auth and our API** (see Decision 3), so Supabase's headline features would be dead weight we carry but never plug in.
2. **Idle behavior.** Supabase's free tier pauses the whole project after about a week of inactivity and needs a manual dashboard restore; Neon's idle-suspend resumes itself on the next request. For a low-traffic personal app that sits quiet for days, that difference is the whole game.

Revisit only if we ever want Supabase's *platform* features (its login system, file uploads, realtime) enough to justify adopting them wholesale.

## Decision 3: Custom auth in our code (not a managed auth platform)

The trade-off here is not "more tools vs fewer tools."
It is "own more code, depend on almost nothing" vs "own less code, take on a deep vendor dependency."
Choosing a managed auth platform does not remove complexity; it relocates it from our repo (where we can see, test, and move it) into a vendor relationship we do not control.

For Momentum, custom auth is the right call for concrete reasons:

- **It is already built and working** - argon2id password hashing, opaque bearer sessions, and the email-verification flow.
  Adopting a managed platform now would *redo* working work (migrating every user's identity and password data, rewriting the login flow, re-testing all of it) - and auth migrations are exactly where accounts get locked out.
- **Portability.** Custom auth on plain Postgres runs on Neon, Render, a raw server, anywhere.
  A managed auth platform ties user identities to that platform, and leaving later is painful.
- **Our needs are simple and stable** - username + password + email verification - which is squarely in the range where hand-rolling is cheap and safe.

**When to reconsider:** if we later need several things that are genuinely painful to build well *at once* - social/Google login, password reset, file uploads - that is the moment to evaluate a managed platform, because then we would be buying features we actually need rather than replacing ones we already have.

## The rule of thumb this all reduces to

Own the parts that are your product or your learning goal, and that you want to keep portable.
Rent the pure commodities that are never worth hand-rolling (the database).
Do not adopt an all-in-one platform to replace something you already own and that already works - that trades control and portability for convenience you have already paid for.
