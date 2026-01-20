# Mobile Products Listing (Vue 3 + Tailwind + TypeScript + Vue Query v5)

## Run
```bash
npm install
npm run dev
```

## Notes
- Category filter is loaded from DummyJSON categories.
- Products are fetched from DummyJSON (all or by category), then sorted and sliced to top 10.
- Filters sync with route query params:
  - category -> `?category=...` (omitted for "all products")
  - sort -> `?sort=...` (omitted for default "title-asc")
- Invalid/unknown params are ignored and removed.
