import { fareFor, MIN_FARE, scoreMatch, trustScore } from "../src/lib/geo";

describe("fareFor", () => {
  it("charges only the travelled distance", () => {
    expect(fareFor(10_000, 3.5)).toBe(35);
    expect(fareFor(18_000, 3.5)).toBe(63);
  });
  it("never goes below the minimum fare", () => {
    expect(fareFor(200, 3.5)).toBe(MIN_FARE);
  });
});

describe("scoreMatch", () => {
  const base = { pickupOffRouteM: 0, dropOffRouteM: 0, minutesApart: 0, windowMinutes: 30, hostAvgRating: 5, maxOffRouteM: 1000 };
  it("is 100 for a perfect match", () => expect(scoreMatch(base)).toBe(100));
  it("drops when the host route is far away", () =>
    expect(scoreMatch({ ...base, pickupOffRouteM: 900, dropOffRouteM: 900 })).toBeLessThan(scoreMatch(base)));
  it("drops when departure is far from the requested time", () =>
    expect(scoreMatch({ ...base, minutesApart: 25 })).toBeLessThan(scoreMatch({ ...base, minutesApart: 5 })));
  it("treats an unrated host as 4.0", () =>
    expect(scoreMatch({ ...base, hostAvgRating: null })).toBe(scoreMatch({ ...base, hostAvgRating: 4 })));
  it("stays within 0..100", () => {
    const worst = scoreMatch({ ...base, pickupOffRouteM: 5000, dropOffRouteM: 5000, minutesApart: 999, hostAvgRating: 0 });
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(100);
  });
});

describe("trustScore", () => {
  it("rewards experience and ratings", () => {
    expect(trustScore(0, null, true)).toBe(55);
    expect(trustScore(10, 5, true)).toBe(100);
    expect(trustScore(10, 5, true)).toBeGreaterThan(trustScore(1, 3, true));
  });
});
