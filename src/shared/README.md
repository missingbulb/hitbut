# shared

The contract between the two deployed halves — the types and shapes that
cross the HTTP API boundary. The one folder both sides may reference.

Keep it to the contract. Anything only one side needs belongs to that side.

- `types.ts` — the corpus entities: figures, sources, statements, judgments.
- `api.ts` — the request and response shapes under `/api/v1`, and the one rule about them
  worth stating twice: an unknown date is an *absent* key, never a null and never a
  stand-in date.
- `text.ts` — the Hebrew folding. It is here rather than in the back end because search
  only works if the same rules run in three places: the indexer, the query, and the
  highlighting of what matched.
