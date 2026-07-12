---
"effect": patch
---

Fix union candidate selection and decoding order so that unions now:

- consider matches from every sentinel key instead of dropping valid members after the first match;
- reject ambiguous `oneOf` inputs when members with different sentinel keys both match;
- preserve declared member order when combining discriminated members with non-discriminated fallbacks;
- commit concurrent decoding results in declaration order instead of completion order.
