# Astronomy/location-dependent date feasibility — ticket 311

Checked: 2026-10-06  
Decision: **REFUSE production routes for this tranche**. This is a feasibility decision, not a claim that the jobs are impossible.

## Primary evidence checked

- U.S. Naval Observatory Astronomical Applications Department, Data Services / API documentation: `https://aa.usno.navy.mil/data/` and `https://aa.usno.navy.mil/data/api.html`. The official service exposes primary moon phases and location/date-dependent Sun/Moon rise, set and transit data. Its one-day service requires a date plus coordinates and timezone; the moon-phase service is remote/API data rather than a vendored local algorithm.
- NOAA Global Monitoring Laboratory Solar Calculator details: `https://gml.noaa.gov/grad/solcalc/calcdetails.html`. NOAA states that this calculator is no longer actively supported or maintained. It identifies Jean Meeus-derived equations and gives theoretical sunrise/sunset accuracy of roughly one minute inside ±72° latitude and roughly ten minutes outside, while warning that atmospheric conditions can change observed times.

## Candidate decisions

| Candidate | Required inputs | Maintainable authority/algorithm needed | Accuracy boundary | Decision |
|---|---|---|---|---|
| Seasons/equinox/solstice | year, output timezone for presentation | versioned ephemeris/algorithm with supported year interval and independent vectors | event instant depends on ephemeris/time-scale model | REFUSE until a local versioned source/algorithm is vendored |
| Sunrise/sunset/twilight | date, latitude, longitude, timezone; atmospheric convention | maintained solar-position algorithm + refraction/solar-disc convention + polar-day/night handling | calculated times vary with atmospheric conditions; NOAA publishes latitude-dependent theoretical accuracy limits | REFUSE; NOAA reference implementation is explicitly unmaintained and USNO alternative is remote |
| Moon phase / illumination | date/time; location only for rise/set, not primary phase instant | versioned lunar ephemeris/phase algorithm and supported year range | primary phase instant and illumination depend on ephemeris/model | REFUSE; authoritative USNO path found is a remote data service, not a vendored local algorithm |

## Privacy boundary

Latitude/longitude can identify a home, workplace or routine when combined with dates. A future implementation should keep coordinates local by default, avoid saving them in URLs/history/telemetry, and must require a separately disclosed opt-in action before any remote authority request. Coarse city names must not be silently upgraded to precise coordinates.

## Reopen criteria

Reopen only when the repository contains a reviewable, versioned local algorithm/source pack for the desired job, independent known-answer vectors over ordinary and polar/boundary cases, an explicit supported date range/time-scale policy, and documented error/accuracy bounds. A remote-reference mode would be a separate product decision and would need the shared network/provenance contract plus explicit consent.

