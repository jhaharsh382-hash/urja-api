# Reflection

## What assumptions did you make?

I assumed that one logged-in service account was sufficient for this exercise, with no separate authentication required by the API. I treated the signed export as the source of truth for meter inventory because it returned all 403 records in one response and matched the search endpoint for the main tested fields.

For hierarchy gaps, I assumed that the most common value among meters on the same transformer was more reliable than an isolated conflicting value. Where evidence was insufficient, I left the value incomplete instead of guessing.

I assumed codes are unique only within their hierarchy parent and built tree nodes using full code paths. I also assumed a 10-minute cache was suitable for relatively static meter and network data.

## Which part was most difficult, and how did you get unstuck?

The hardest parts were the login and signed export protocols. Login worked in the browser but a direct request returned a SvelteKit cross-site form error. Comparing request headers showed that `Origin` was required, so I added it to the login request.

Finding the export also required reverse-engineering the portal bundles. I searched the bundles for `/portal/` routes, then reproduced the UI's signing function. Getting the timestamp, query string, signing key, and lowercase hexadecimal format in the correct order was necessary before the export worked.

## If you had another day, what would you improve?

I would implement the consumption endpoint and verify the portal's complete energy-history behavior. I would validate `from` and `to`, convert timestamps into ISO values, and decide whether to expose cumulative readings, per-interval usage, or both.

I would add a live portal contract test, persisted snapshots, API authentication, and logging. I would also replace linear meter and spatial searches with appropriate indexes. A small web interface for maps, hierarchy exploration, and data-quality review would make the API easier to demonstrate.

## What mistake did you make while solving this?

I initially expected meter pages and export responses to have only one shape or pagination model. Probes showed two meter-page layouts, and the export's `page` parameter does not actually change the response. I corrected the implementation to handle the investigated layouts and fetch the export once.

I also made mistakes by trusting incomplete evidence for hierarchy and cache behavior. I learned to count actual portal requests, test error paths, and verify that cached snapshots and hierarchy conflicts were preserved instead of trusting a plausible result.
