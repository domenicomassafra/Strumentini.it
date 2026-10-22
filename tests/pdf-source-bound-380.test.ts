// The PR's native PDF change-impact selector includes tests/pdf-*.test.ts.
// Keep the ticket's required direct entry points while running the same cases
// during selected source CI, without replacing the shared CI dispatcher.
import "./str-380-acceptance.test";
import "./str-380-refusals.test";
