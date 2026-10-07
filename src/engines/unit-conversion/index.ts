export const UNIT_CONVERSION_ENGINE_VERSION = "unit-conversion-v1";

export type UnitDimension =
  | "length"
  | "mass"
  | "temperature"
  | "area"
  | "volume"
  | "speed"
  | "time"
  | "angle"
  | "energy"
  | "pressure"
  | "power"
  | "force"
  | "torque"
  | "frequency"
  | "density"
  | "flow"
  | "illuminance"
  | "digital-storage"
  | "data-rate";

interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface UnitDefinition {
  readonly id: string;
  readonly dimension: UnitDimension;
  readonly symbol: string;
  readonly aliases: readonly string[];
  readonly scale: string;
  readonly offset?: string;
  readonly authority: string;
  readonly irrationalScale?: "pi-over-180" | "pi-over-200" | "two-pi" | "one-over-two-pi";
}

export interface UnitDescriptor {
  readonly id: string;
  readonly dimension: UnitDimension;
  readonly symbol: string;
  readonly aliases: readonly string[];
  readonly authority: string;
}

const MAX_DECIMAL_DIGITS = 80;
const RESULT_DECIMAL_PLACES = 12;
const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:[.,](\d+))?$/u;

function gcd(left: bigint, right: bigint): bigint {
  let first = left < 0n ? -left : left;
  let second = right < 0n ? -right : right;
  while (second !== 0n) [first, second] = [second, first % second];
  return first === 0n ? 1n : first;
}

function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new Error("INVALID_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator * sign / divisor,
    denominator: denominator * sign / divisor,
  };
}

function add(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

function subtract(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Rational, right: Rational, code = "INVALID_DENOMINATOR"): Rational {
  if (right.numerator === 0n) throw new Error(code);
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function compareZero(value: Rational): -1 | 0 | 1 {
  return value.numerator === 0n ? 0 : value.numerator < 0n ? -1 : 1;
}

function parseDecimal(value: string | number, code = "INVALID_DECIMAL"): Rational {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(code);
    return parseDecimal(String(value), code);
  }
  const text = value.trim();
  const match = DECIMAL_PATTERN.exec(text);
  if (match === null) throw new Error(code);
  const whole = match[2] ?? "";
  const fraction = match[3] ?? "";
  if (whole.length + fraction.length > MAX_DECIMAL_DIGITS) throw new Error("VALUE_OUT_OF_RANGE");
  const sign = match[1] === "-" ? -1n : 1n;
  return rational(sign * BigInt(`${whole}${fraction}` || "0"), 10n ** BigInt(fraction.length));
}

function parseScale(value: string): Rational {
  const slash = value.indexOf("/");
  if (slash === -1) return parseDecimal(value, "INVALID_UNIT_SCALE");
  return rational(BigInt(value.slice(0, slash)), BigInt(value.slice(slash + 1)));
}

function formatRounded(value: Rational, decimalPlaces = RESULT_DECIMAL_PLACES): string {
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(decimalPlaces);
  const scaled = numerator * scale;
  let quotient = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  const whole = quotient / scale;
  const fraction = (quotient % scale).toString().padStart(decimalPlaces, "0").replace(/0+$/u, "");
  const sign = negative && quotient !== 0n ? "-" : "";
  return `${sign}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

function rationalToNumber(value: Rational, code = "VALUE_OUT_OF_RANGE"): number {
  const result = Number(value.numerator) / Number(value.denominator);
  if (!Number.isFinite(result)) throw new Error(code);
  return result;
}

function numberToDisplay(value: number, decimalPlaces = RESULT_DECIMAL_PLACES): string {
  if (!Number.isFinite(value)) throw new Error("VALUE_OUT_OF_RANGE");
  return value.toFixed(decimalPlaces).replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
}

const SI_AUTHORITY = "BIPM SI Brochure, 9th edition (2019), revision 4.01 June 2026: SI base/derived units and decimal prefixes.";
const INCH_AUTHORITY = "International yard and pound agreement: 1 inch = 0.0254 metre exactly; 1 pound = 0.45359237 kilogram exactly.";
const NAUTICAL_AUTHORITY = "International nautical mile: 1 nautical mile = 1852 metres exactly.";
const US_GALLON_AUTHORITY = "US liquid gallon = 231 cubic inches exactly; derived here from the exact international inch.";
const IMPERIAL_GALLON_AUTHORITY = "UK Weights and Measures definition: imperial gallon = 4.54609 litres exactly.";
const ATM_AUTHORITY = "Standard atmosphere = 101325 pascals exactly.";
const CALORIE_AUTHORITY = "Thermochemical calorie = 4.184 joules exactly.";
const HORSEPOWER_AUTHORITY = "Mechanical horsepower = 550 foot-pound-force per second; metric horsepower (CV/PS) = 75 kgf·m/s.";
const IEC_AUTHORITY = "IEC 80000-13:2025 binary prefixes: Ki=2^10, Mi=2^20, Gi=2^30, Ti=2^40; SI prefixes remain powers of 1000.";

const units: readonly UnitDefinition[] = [
  { id: "meter", dimension: "length", symbol: "m", aliases: ["metre", "metro", "metri"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilometer", dimension: "length", symbol: "km", aliases: ["kilometre", "chilometro", "chilometri"], scale: "1000", authority: SI_AUTHORITY },
  { id: "centimeter", dimension: "length", symbol: "cm", aliases: ["centimetre", "centimetro", "centimetri"], scale: "1/100", authority: SI_AUTHORITY },
  { id: "millimeter", dimension: "length", symbol: "mm", aliases: ["millimetre", "millimetro", "millimetri"], scale: "1/1000", authority: SI_AUTHORITY },
  { id: "micrometer", dimension: "length", symbol: "µm", aliases: ["um", "micrometre", "micrometro"], scale: "1/1000000", authority: SI_AUTHORITY },
  { id: "inch", dimension: "length", symbol: "in", aliases: ["pollice", "pollici"], scale: "127/5000", authority: INCH_AUTHORITY },
  { id: "foot", dimension: "length", symbol: "ft", aliases: ["feet", "piede", "piedi"], scale: "381/1250", authority: INCH_AUTHORITY },
  { id: "yard", dimension: "length", symbol: "yd", aliases: ["iarda", "iarde"], scale: "1143/1250", authority: INCH_AUTHORITY },
  { id: "mile", dimension: "length", symbol: "mi", aliases: ["statute-mile", "miglio", "miglia"], scale: "201168/125", authority: INCH_AUTHORITY },
  { id: "nautical-mile", dimension: "length", symbol: "nmi", aliases: ["NM", "miglio-nautico"], scale: "1852", authority: NAUTICAL_AUTHORITY },

  { id: "kilogram", dimension: "mass", symbol: "kg", aliases: ["chilogrammo", "chilogrammi"], scale: "1", authority: SI_AUTHORITY },
  { id: "gram", dimension: "mass", symbol: "g", aliases: ["grammo", "grammi"], scale: "1/1000", authority: SI_AUTHORITY },
  { id: "milligram", dimension: "mass", symbol: "mg", aliases: ["milligrammo", "milligrammi"], scale: "1/1000000", authority: SI_AUTHORITY },
  { id: "metric-tonne", dimension: "mass", symbol: "t", aliases: ["tonne", "tonnellata", "tonnellate"], scale: "1000", authority: SI_AUTHORITY },
  { id: "pound", dimension: "mass", symbol: "lb", aliases: ["lbs", "libbra", "libbre"], scale: "45359237/100000000", authority: INCH_AUTHORITY },
  { id: "ounce", dimension: "mass", symbol: "oz", aliases: ["oncia", "once"], scale: "45359237/1600000000", authority: INCH_AUTHORITY },
  { id: "stone", dimension: "mass", symbol: "st", aliases: ["stones"], scale: "317514659/50000000", authority: INCH_AUTHORITY },

  { id: "kelvin", dimension: "temperature", symbol: "K", aliases: ["kelvin"], scale: "1", offset: "0", authority: SI_AUTHORITY },
  { id: "celsius", dimension: "temperature", symbol: "°C", aliases: ["C", "celsius", "centigrade"], scale: "1", offset: "273.15", authority: SI_AUTHORITY },
  { id: "fahrenheit", dimension: "temperature", symbol: "°F", aliases: ["F", "fahrenheit"], scale: "5/9", offset: "45967/180", authority: "Exact affine relation: K = (°F + 459.67) × 5/9." },
  { id: "rankine", dimension: "temperature", symbol: "°R", aliases: ["R", "rankine"], scale: "5/9", offset: "0", authority: "Rankine degree has Fahrenheit-sized intervals with absolute zero at 0 °R." },

  { id: "square-meter", dimension: "area", symbol: "m²", aliases: ["m2", "metro-quadro"], scale: "1", authority: SI_AUTHORITY },
  { id: "square-kilometer", dimension: "area", symbol: "km²", aliases: ["km2"], scale: "1000000", authority: SI_AUTHORITY },
  { id: "square-centimeter", dimension: "area", symbol: "cm²", aliases: ["cm2"], scale: "1/10000", authority: SI_AUTHORITY },
  { id: "square-millimeter", dimension: "area", symbol: "mm²", aliases: ["mm2"], scale: "1/1000000", authority: SI_AUTHORITY },
  { id: "hectare", dimension: "area", symbol: "ha", aliases: ["ettaro", "ettari"], scale: "10000", authority: SI_AUTHORITY },
  { id: "acre", dimension: "area", symbol: "ac", aliases: ["acri"], scale: "316160658/78125", authority: INCH_AUTHORITY },
  { id: "square-foot", dimension: "area", symbol: "ft²", aliases: ["ft2"], scale: "145161/1562500", authority: INCH_AUTHORITY },
  { id: "square-inch", dimension: "area", symbol: "in²", aliases: ["in2"], scale: "16129/25000000", authority: INCH_AUTHORITY },

  { id: "cubic-meter", dimension: "volume", symbol: "m³", aliases: ["m3", "metro-cubo"], scale: "1", authority: SI_AUTHORITY },
  { id: "liter", dimension: "volume", symbol: "L", aliases: ["l", "litre", "litro", "litri"], scale: "1/1000", authority: SI_AUTHORITY },
  { id: "milliliter", dimension: "volume", symbol: "mL", aliases: ["ml", "millilitre", "millilitro"], scale: "1/1000000", authority: SI_AUTHORITY },
  { id: "cubic-centimeter", dimension: "volume", symbol: "cm³", aliases: ["cm3", "cc"], scale: "1/1000000", authority: SI_AUTHORITY },
  { id: "cubic-foot", dimension: "volume", symbol: "ft³", aliases: ["ft3"], scale: "55306341/1953125000", authority: INCH_AUTHORITY },
  { id: "cubic-inch", dimension: "volume", symbol: "in³", aliases: ["in3"], scale: "2048383/125000000000", authority: INCH_AUTHORITY },
  { id: "us-gallon", dimension: "volume", symbol: "US gal", aliases: ["gallon-us", "gal"], scale: "473176473/125000000000", authority: US_GALLON_AUTHORITY },
  { id: "imperial-gallon", dimension: "volume", symbol: "imp gal", aliases: ["gallon-imperial", "gal"], scale: "454609/100000000", authority: IMPERIAL_GALLON_AUTHORITY },

  { id: "meter-per-second", dimension: "speed", symbol: "m/s", aliases: ["mps"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilometer-per-hour", dimension: "speed", symbol: "km/h", aliases: ["kph", "kmh"], scale: "5/18", authority: SI_AUTHORITY },
  { id: "mile-per-hour", dimension: "speed", symbol: "mph", aliases: ["mi/h"], scale: "1397/3125", authority: INCH_AUTHORITY },
  { id: "knot", dimension: "speed", symbol: "kn", aliases: ["kt", "kts", "nodo", "nodi"], scale: "463/900", authority: NAUTICAL_AUTHORITY },
  { id: "foot-per-second", dimension: "speed", symbol: "ft/s", aliases: ["fps"], scale: "381/1250", authority: INCH_AUTHORITY },

  { id: "second", dimension: "time", symbol: "s", aliases: ["sec", "secondo", "secondi"], scale: "1", authority: SI_AUTHORITY },
  { id: "millisecond", dimension: "time", symbol: "ms", aliases: ["millisecondo"], scale: "1/1000", authority: SI_AUTHORITY },
  { id: "minute", dimension: "time", symbol: "min", aliases: ["minuto", "minuti"], scale: "60", authority: "Accepted non-SI unit for use with SI: minute = 60 seconds." },
  { id: "hour", dimension: "time", symbol: "h", aliases: ["hr", "ora", "ore"], scale: "3600", authority: "Accepted non-SI unit for use with SI: hour = 3600 seconds." },
  { id: "day", dimension: "time", symbol: "d", aliases: ["giorno", "giorni"], scale: "86400", authority: "Day = 86400 seconds for duration conversion; calendar-day semantics are separate." },
  { id: "week", dimension: "time", symbol: "wk", aliases: ["settimana", "settimane"], scale: "604800", authority: "Duration week defined as 7 × 86400 seconds." },

  { id: "turn", dimension: "angle", symbol: "turn", aliases: ["revolution", "giro"], scale: "1", authority: "Full turn is the angle reference used internally." },
  { id: "degree", dimension: "angle", symbol: "°", aliases: ["deg", "grado", "gradi"], scale: "1/360", authority: "1 degree = 1/360 of a full turn." },
  { id: "gradian", dimension: "angle", symbol: "gon", aliases: ["grad", "gradian"], scale: "1/400", authority: "1 gon = 1/400 of a full turn." },
  { id: "radian", dimension: "angle", symbol: "rad", aliases: ["radianti"], scale: "1", irrationalScale: "one-over-two-pi", authority: "1 full turn = 2π radians; conversion uses the runtime Math.PI constant." },

  { id: "joule", dimension: "energy", symbol: "J", aliases: ["joule"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilojoule", dimension: "energy", symbol: "kJ", aliases: ["kilojoule"], scale: "1000", authority: SI_AUTHORITY },
  { id: "watt-hour", dimension: "energy", symbol: "Wh", aliases: ["watt hour"], scale: "3600", authority: SI_AUTHORITY },
  { id: "kilowatt-hour", dimension: "energy", symbol: "kWh", aliases: ["kilowatt hour"], scale: "3600000", authority: SI_AUTHORITY },
  { id: "calorie", dimension: "energy", symbol: "cal", aliases: ["thermochemical-calorie"], scale: "4.184", authority: CALORIE_AUTHORITY },
  { id: "kilocalorie", dimension: "energy", symbol: "kcal", aliases: ["Cal", "food-calorie"], scale: "4184", authority: CALORIE_AUTHORITY },
  { id: "btu-it", dimension: "energy", symbol: "BTU", aliases: ["btu"], scale: "1055.05585262", authority: "International Table BTU = 1055.05585262 joules." },

  { id: "pascal", dimension: "pressure", symbol: "Pa", aliases: ["pascal"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilopascal", dimension: "pressure", symbol: "kPa", aliases: ["kilopascal"], scale: "1000", authority: SI_AUTHORITY },
  { id: "bar", dimension: "pressure", symbol: "bar", aliases: ["bar"], scale: "100000", authority: "Bar = 100000 pascals exactly." },
  { id: "standard-atmosphere", dimension: "pressure", symbol: "atm", aliases: ["atmosphere"], scale: "101325", authority: ATM_AUTHORITY },
  { id: "psi", dimension: "pressure", symbol: "psi", aliases: ["lbf/in2"], scale: "8896443230521/1290320000", authority: "Derived exactly from pound-force and square inch definitions used in this registry." },
  { id: "torr", dimension: "pressure", symbol: "Torr", aliases: ["mmhg-conventional"], scale: "101325/760", authority: "Torr defined here as 1/760 standard atmosphere." },

  { id: "watt", dimension: "power", symbol: "W", aliases: ["watt"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilowatt", dimension: "power", symbol: "kW", aliases: ["kilowatt"], scale: "1000", authority: SI_AUTHORITY },
  { id: "megawatt", dimension: "power", symbol: "MW", aliases: ["megawatt"], scale: "1000000", authority: SI_AUTHORITY },
  { id: "mechanical-horsepower", dimension: "power", symbol: "hp", aliases: ["horsepower", "hp-mechanical"], scale: "74569987158227022/100000000000000", authority: HORSEPOWER_AUTHORITY },
  { id: "metric-horsepower", dimension: "power", symbol: "CV", aliases: ["PS", "cv", "cavallo-vapore"], scale: "735.49875", authority: HORSEPOWER_AUTHORITY },

  { id: "newton", dimension: "force", symbol: "N", aliases: ["newton"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilonewton", dimension: "force", symbol: "kN", aliases: ["kilonewton"], scale: "1000", authority: SI_AUTHORITY },
  { id: "pound-force", dimension: "force", symbol: "lbf", aliases: ["pound force"], scale: "44482216152605/10000000000000", authority: "Pound-force uses standard gravity 9.80665 m/s² and the exact international pound." },
  { id: "kilogram-force", dimension: "force", symbol: "kgf", aliases: ["kilopond"], scale: "9.80665", authority: "Kilogram-force = 9.80665 newtons using standard gravity." },

  { id: "newton-meter", dimension: "torque", symbol: "N·m", aliases: ["Nm", "newton-meter"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilonewton-meter", dimension: "torque", symbol: "kN·m", aliases: ["kNm"], scale: "1000", authority: SI_AUTHORITY },
  { id: "pound-foot", dimension: "torque", symbol: "lbf·ft", aliases: ["lb-ft", "ft-lb"], scale: "13558179483314004/10000000000000000", authority: "Derived from registry pound-force and exact international foot." },
  { id: "kilogram-force-meter", dimension: "torque", symbol: "kgf·m", aliases: ["kgfm"], scale: "9.80665", authority: "Derived from kilogram-force × metre." },

  { id: "hertz", dimension: "frequency", symbol: "Hz", aliases: ["hertz"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilohertz", dimension: "frequency", symbol: "kHz", aliases: ["kilohertz"], scale: "1000", authority: SI_AUTHORITY },
  { id: "megahertz", dimension: "frequency", symbol: "MHz", aliases: ["megahertz"], scale: "1000000", authority: SI_AUTHORITY },
  { id: "gigahertz", dimension: "frequency", symbol: "GHz", aliases: ["gigahertz"], scale: "1000000000", authority: SI_AUTHORITY },
  { id: "revolution-per-minute", dimension: "frequency", symbol: "rpm", aliases: ["rev/min"], scale: "1/60", authority: "One revolution per minute = 1/60 hertz for cycle frequency." },

  { id: "kilogram-per-cubic-meter", dimension: "density", symbol: "kg/m³", aliases: ["kg/m3"], scale: "1", authority: SI_AUTHORITY },
  { id: "gram-per-cubic-centimeter", dimension: "density", symbol: "g/cm³", aliases: ["g/cm3"], scale: "1000", authority: SI_AUTHORITY },
  { id: "kilogram-per-liter", dimension: "density", symbol: "kg/L", aliases: ["kg/l"], scale: "1000", authority: SI_AUTHORITY },
  { id: "pound-per-cubic-foot", dimension: "density", symbol: "lb/ft³", aliases: ["lb/ft3"], scale: "160184633739741/10000000000000", authority: "Derived from the exact international pound and foot." },

  { id: "cubic-meter-per-second", dimension: "flow", symbol: "m³/s", aliases: ["m3/s"], scale: "1", authority: SI_AUTHORITY },
  { id: "liter-per-second", dimension: "flow", symbol: "L/s", aliases: ["l/s"], scale: "1/1000", authority: SI_AUTHORITY },
  { id: "liter-per-minute", dimension: "flow", symbol: "L/min", aliases: ["l/min", "lpm"], scale: "1/60000", authority: SI_AUTHORITY },
  { id: "cubic-meter-per-hour", dimension: "flow", symbol: "m³/h", aliases: ["m3/h"], scale: "1/3600", authority: SI_AUTHORITY },
  { id: "cubic-foot-per-minute", dimension: "flow", symbol: "ft³/min", aliases: ["cfm"], scale: "55306341/117187500000", authority: INCH_AUTHORITY },
  { id: "us-gallon-per-minute", dimension: "flow", symbol: "US gal/min", aliases: ["gpm-us"], scale: "473176473/7500000000000", authority: US_GALLON_AUTHORITY },

  { id: "lux", dimension: "illuminance", symbol: "lx", aliases: ["lux"], scale: "1", authority: SI_AUTHORITY },
  { id: "kilolux", dimension: "illuminance", symbol: "klx", aliases: ["kilolux"], scale: "1000", authority: SI_AUTHORITY },
  { id: "foot-candle", dimension: "illuminance", symbol: "fc", aliases: ["footcandle"], scale: "1562500/145161", authority: "1 foot-candle = 1 lumen per square foot; derived from the exact international foot." },

  { id: "bit", dimension: "digital-storage", symbol: "b", aliases: ["bit", "bits"], scale: "1", authority: IEC_AUTHORITY },
  { id: "byte", dimension: "digital-storage", symbol: "B", aliases: ["byte", "bytes"], scale: "8", authority: IEC_AUTHORITY },
  { id: "kilobit", dimension: "digital-storage", symbol: "kbit", aliases: ["kilobit"], scale: "1000", authority: IEC_AUTHORITY },
  { id: "kilobyte", dimension: "digital-storage", symbol: "kB", aliases: ["kilobyte"], scale: "8000", authority: IEC_AUTHORITY },
  { id: "megabit", dimension: "digital-storage", symbol: "Mbit", aliases: ["megabit"], scale: "1000000", authority: IEC_AUTHORITY },
  { id: "megabyte", dimension: "digital-storage", symbol: "MB", aliases: ["megabyte"], scale: "8000000", authority: IEC_AUTHORITY },
  { id: "gigabit", dimension: "digital-storage", symbol: "Gbit", aliases: ["gigabit"], scale: "1000000000", authority: IEC_AUTHORITY },
  { id: "gigabyte", dimension: "digital-storage", symbol: "GB", aliases: ["gigabyte"], scale: "8000000000", authority: IEC_AUTHORITY },
  { id: "terabyte", dimension: "digital-storage", symbol: "TB", aliases: ["terabyte"], scale: "8000000000000", authority: IEC_AUTHORITY },
  { id: "kibibyte", dimension: "digital-storage", symbol: "KiB", aliases: ["kibibyte"], scale: "8192", authority: IEC_AUTHORITY },
  { id: "mebibyte", dimension: "digital-storage", symbol: "MiB", aliases: ["mebibyte"], scale: "8388608", authority: IEC_AUTHORITY },
  { id: "gibibyte", dimension: "digital-storage", symbol: "GiB", aliases: ["gibibyte"], scale: "8589934592", authority: IEC_AUTHORITY },
  { id: "tebibyte", dimension: "digital-storage", symbol: "TiB", aliases: ["tebibyte"], scale: "8796093022208", authority: IEC_AUTHORITY },

  { id: "bit-per-second", dimension: "data-rate", symbol: "bit/s", aliases: ["bps"], scale: "1", authority: IEC_AUTHORITY },
  { id: "byte-per-second", dimension: "data-rate", symbol: "B/s", aliases: ["byte/s"], scale: "8", authority: IEC_AUTHORITY },
  { id: "kilobit-per-second", dimension: "data-rate", symbol: "kbit/s", aliases: ["kbps"], scale: "1000", authority: IEC_AUTHORITY },
  { id: "megabit-per-second", dimension: "data-rate", symbol: "Mbit/s", aliases: ["Mbps"], scale: "1000000", authority: IEC_AUTHORITY },
  { id: "gigabit-per-second", dimension: "data-rate", symbol: "Gbit/s", aliases: ["Gbps"], scale: "1000000000", authority: IEC_AUTHORITY },
  { id: "kilobyte-per-second", dimension: "data-rate", symbol: "kB/s", aliases: ["kBps"], scale: "8000", authority: IEC_AUTHORITY },
  { id: "megabyte-per-second", dimension: "data-rate", symbol: "MB/s", aliases: ["MBps"], scale: "8000000", authority: IEC_AUTHORITY },
  { id: "mebibyte-per-second", dimension: "data-rate", symbol: "MiB/s", aliases: ["MiBps"], scale: "8388608", authority: IEC_AUTHORITY },
];

const byId = new Map(units.map((unit) => [unit.id, unit] as const));
const bySymbol = new Map<string, UnitDefinition[]>();
const byAlias = new Map<string, UnitDefinition[]>();

function pushLookup(map: Map<string, UnitDefinition[]>, key: string, unit: UnitDefinition): void {
  const current = map.get(key) ?? [];
  current.push(unit);
  map.set(key, current);
}

for (const unit of units) {
  pushLookup(bySymbol, unit.symbol, unit);
  for (const alias of unit.aliases) pushLookup(byAlias, alias.trim().toLocaleLowerCase("it-IT"), unit);
}

export const UNIT_REGISTRY: readonly UnitDescriptor[] = units.map(({ id, dimension, symbol, aliases, authority }) => ({
  id,
  dimension,
  symbol,
  aliases,
  authority,
}));

function resolveUnit(token: string): UnitDefinition {
  const trimmed = token.trim();
  const direct = byId.get(trimmed);
  if (direct !== undefined) return direct;
  const symbolMatches = bySymbol.get(trimmed) ?? [];
  if (symbolMatches.length === 1) return symbolMatches[0]!;
  if (symbolMatches.length > 1) throw new Error("AMBIGUOUS_UNIT_ALIAS");
  const aliasMatches = byAlias.get(trimmed.toLocaleLowerCase("it-IT")) ?? [];
  if (aliasMatches.length === 1) return aliasMatches[0]!;
  if (aliasMatches.length > 1) throw new Error("AMBIGUOUS_UNIT_ALIAS");
  throw new Error("UNKNOWN_UNIT");
}

function irrationalFactor(unit: UnitDefinition): number | null {
  if (unit.irrationalScale === undefined) return null;
  if (unit.irrationalScale === "pi-over-180") return Math.PI / 180;
  if (unit.irrationalScale === "pi-over-200") return Math.PI / 200;
  if (unit.irrationalScale === "two-pi") return Math.PI * 2;
  return 1 / (Math.PI * 2);
}

function unitScaleNumber(unit: UnitDefinition): number {
  const irrational = irrationalFactor(unit);
  return irrational ?? rationalToNumber(parseScale(unit.scale));
}

function convertRational(value: Rational, from: UnitDefinition, to: UnitDefinition): Rational | number {
  if (from.dimension !== to.dimension) throw new Error("CROSS_DIMENSION_CONVERSION");
  const fromIrrational = irrationalFactor(from);
  const toIrrational = irrationalFactor(to);
  if (fromIrrational !== null || toIrrational !== null) {
    const numeric = rationalToNumber(value) * unitScaleNumber(from) + rationalToNumber(parseScale(from.offset ?? "0"));
    const result = (numeric - rationalToNumber(parseScale(to.offset ?? "0"))) / unitScaleNumber(to);
    if (!Number.isFinite(result)) throw new Error("VALUE_OUT_OF_RANGE");
    return result;
  }
  const base = add(multiply(value, parseScale(from.scale)), parseScale(from.offset ?? "0"));
  return divide(subtract(base, parseScale(to.offset ?? "0")), parseScale(to.scale), "INVALID_UNIT_SCALE");
}

export interface UnitConversionInput {
  readonly value: string | number;
  readonly from: string;
  readonly to: string;
}

export interface UnitConversionResult {
  readonly result: string;
  readonly dimension: UnitDimension;
  readonly from: string;
  readonly to: string;
  readonly input: string;
  readonly assumptions: {
    readonly precision: string;
    readonly decimalInput: string;
    readonly sourceFrom: string;
    readonly sourceTo: string;
  };
  readonly formulas: { readonly conversion: string };
}

export function convertUnit(input: UnitConversionInput): UnitConversionResult {
  const from = resolveUnit(input.from);
  const to = resolveUnit(input.to);
  if (from.dimension !== to.dimension) throw new Error("CROSS_DIMENSION_CONVERSION");
  const value = parseDecimal(input.value, "INVALID_VALUE");
  const converted = convertRational(value, from, to);
  const result = typeof converted === "number" ? numberToDisplay(converted) : formatRounded(converted);
  return {
    result,
    dimension: from.dimension,
    from: `${from.id} (${from.symbol})`,
    to: `${to.id} (${to.symbol})`,
    input: typeof input.value === "number" ? String(input.value) : input.value.trim(),
    assumptions: {
      precision: `exact rational arithmetic where definitions are rational; otherwise finite Number math; display rounds half-up/equivalent to at most ${RESULT_DECIMAL_PLACES} decimals`,
      decimalInput: "comma or point is accepted as the decimal separator; grouping separators are not accepted",
      sourceFrom: from.authority,
      sourceTo: to.authority,
    },
    formulas: { conversion: "base = value × source scale + source offset; target = (base − target offset) ÷ target scale" },
  };
}

export function unitsForDimension(dimension: UnitDimension): readonly UnitDescriptor[] {
  return UNIT_REGISTRY.filter((unit) => unit.dimension === dimension);
}

export function resolveUnitDescriptor(token: string): UnitDescriptor {
  const { id, dimension, symbol, aliases, authority } = resolveUnit(token);
  return { id, dimension, symbol, aliases, authority };
}

function positive(value: string | number, code: string): Rational {
  const parsed = parseDecimal(value, code);
  if (compareZero(parsed) <= 0) throw new Error(code);
  return parsed;
}

function nonNegative(value: string | number, code: string): Rational {
  const parsed = parseDecimal(value, code);
  if (compareZero(parsed) < 0) throw new Error(code);
  return parsed;
}

function baseValue(value: string | number, unitToken: string, dimension: UnitDimension): Rational {
  const unit = resolveUnit(unitToken);
  if (unit.dimension !== dimension || irrationalFactor(unit) !== null) throw new Error("INVALID_UNIT");
  return multiply(parseDecimal(value, "INVALID_VALUE"), parseScale(unit.scale));
}

export type StorageDownloadMode = "storage" | "download-time";

export interface StorageDownloadInput {
  readonly mode: StorageDownloadMode;
  readonly value?: string;
  readonly from?: string;
  readonly to?: string;
  readonly size?: string;
  readonly sizeUnit?: string;
  readonly throughput?: string;
  readonly throughputUnit?: string;
  readonly overheadPercent?: string;
}

function humanSeconds(seconds: Rational): string {
  const numeric = rationalToNumber(seconds);
  if (numeric < 60) return `${numberToDisplay(numeric, 3)} s`;
  if (numeric < 3600) return `${Math.floor(numeric / 60)} min ${numberToDisplay(numeric % 60, 2)} s`;
  const hours = Math.floor(numeric / 3600);
  const minutes = Math.floor((numeric % 3600) / 60);
  const remainder = numeric % 60;
  return `${hours} h ${minutes} min ${numberToDisplay(remainder, 1)} s`;
}

export function calculateStorageDownload(input: StorageDownloadInput): Record<string, unknown> {
  if (input.mode === "storage") {
    if (input.value === undefined || input.from === undefined || input.to === undefined) throw new Error("INVALID_INPUT");
    const result = convertUnit({ value: input.value, from: input.from, to: input.to });
    if (result.dimension !== "digital-storage") throw new Error("INVALID_STORAGE_UNIT");
    return {
      result: result.result,
      from: result.from,
      to: result.to,
      assumptions: {
        ...result.assumptions,
        basePolicy: "SI k/M/G/T use powers of 1000; IEC Ki/Mi/Gi/Ti use powers of 1024; bit b and byte B are distinct symbols",
      },
      formulas: result.formulas,
    };
  }
  if (input.mode !== "download-time") throw new Error("INVALID_MODE");
  if (input.size === undefined || input.sizeUnit === undefined || input.throughput === undefined || input.throughputUnit === undefined) throw new Error("INVALID_INPUT");
  const bits = baseValue(input.size, input.sizeUnit, "digital-storage");
  const bitsPerSecond = baseValue(input.throughput, input.throughputUnit, "data-rate");
  if (compareZero(bits) < 0 || compareZero(bitsPerSecond) <= 0) throw new Error("INVALID_DOWNLOAD_INPUT");
  const overhead = nonNegative(input.overheadPercent ?? "0", "INVALID_OVERHEAD");
  if (overhead.numerator >= overhead.denominator * 100n) throw new Error("INVALID_OVERHEAD");
  const efficiency = divide(subtract(rational(100n, 1n), overhead), rational(100n, 1n));
  const effectiveRate = multiply(bitsPerSecond, efficiency);
  const seconds = divide(bits, effectiveRate, "INVALID_DOWNLOAD_INPUT");
  return {
    result: humanSeconds(seconds),
    seconds: formatRounded(seconds),
    fileBits: formatRounded(bits),
    enteredBitsPerSecond: formatRounded(bitsPerSecond),
    effectiveBitsPerSecond: formatRounded(effectiveRate),
    assumptions: {
      throughput: "user-entered only; no speed-test or network request is performed",
      overhead: `${formatRounded(overhead)}% is removed from entered throughput before estimating time`,
      bitByte: "lowercase b means bit; uppercase B means byte; ambiguous aliases are rejected",
      storageBases: "SI prefixes are decimal powers of 1000; IEC prefixes are binary powers of 1024",
    },
    formulas: { downloadTime: "file bits ÷ (entered bits/s × (1 − overhead%/100))" },
  };
}

export type BatteryVehiclePowerMode = "battery" | "fuel" | "power";
export type BatteryDirection = "mah-to-wh" | "wh-to-mah";
export type FuelUnit = "l-per-100km" | "km-per-liter" | "mpg-us" | "mpg-imperial";

export interface BatteryVehiclePowerInput {
  readonly mode: BatteryVehiclePowerMode;
  readonly direction?: BatteryDirection;
  readonly value: string;
  readonly voltage?: string;
  readonly from?: string;
  readonly to?: string;
}

const KM_PER_MILE = rational(25146n, 15625n); // 1.609344 exactly
const LITERS_PER_US_GALLON = parseScale("3.785411784");
const LITERS_PER_IMPERIAL_GALLON = parseScale("4.54609");

function fuelToKmPerLiter(value: Rational, unit: FuelUnit): Rational {
  if (compareZero(value) <= 0) throw new Error("INVALID_FUEL_VALUE");
  if (unit === "km-per-liter") return value;
  if (unit === "l-per-100km") return divide(rational(100n, 1n), value, "INVALID_FUEL_VALUE");
  const liters = unit === "mpg-us" ? LITERS_PER_US_GALLON : LITERS_PER_IMPERIAL_GALLON;
  return divide(multiply(value, KM_PER_MILE), liters, "INVALID_FUEL_VALUE");
}

function kmPerLiterToFuel(value: Rational, unit: FuelUnit): Rational {
  if (unit === "km-per-liter") return value;
  if (unit === "l-per-100km") return divide(rational(100n, 1n), value, "INVALID_FUEL_VALUE");
  const liters = unit === "mpg-us" ? LITERS_PER_US_GALLON : LITERS_PER_IMPERIAL_GALLON;
  return divide(multiply(value, liters), KM_PER_MILE, "INVALID_FUEL_VALUE");
}

function isFuelUnit(value: string): value is FuelUnit {
  return value === "l-per-100km" || value === "km-per-liter" || value === "mpg-us" || value === "mpg-imperial";
}

export function calculateBatteryVehiclePower(input: BatteryVehiclePowerInput): Record<string, unknown> {
  if (input.mode === "battery") {
    const direction = input.direction;
    if (direction !== "mah-to-wh" && direction !== "wh-to-mah") throw new Error("INVALID_DIRECTION");
    if (input.voltage === undefined) throw new Error("VOLTAGE_REQUIRED");
    const voltage = positive(input.voltage, "INVALID_VOLTAGE");
    const value = nonNegative(input.value, "INVALID_VALUE");
    const thousand = rational(1000n, 1n);
    const output = direction === "mah-to-wh"
      ? multiply(divide(value, thousand), voltage)
      : divide(multiply(value, thousand), voltage, "INVALID_VOLTAGE");
    return {
      result: formatRounded(output),
      voltage: formatRounded(voltage),
      direction,
      assumptions: { voltage: "required and strictly positive; battery voltage is treated as the declared nominal/operating voltage" },
      formulas: { conversion: direction === "mah-to-wh" ? "Wh = mAh × V ÷ 1000" : "mAh = Wh × 1000 ÷ V" },
    };
  }
  if (input.mode === "fuel") {
    if (input.from === undefined || input.to === undefined || !isFuelUnit(input.from) || !isFuelUnit(input.to)) throw new Error("INVALID_FUEL_UNIT");
    const value = positive(input.value, "INVALID_FUEL_VALUE");
    const canonical = fuelToKmPerLiter(value, input.from);
    const output = kmPerLiterToFuel(canonical, input.to);
    return {
      result: formatRounded(output),
      from: input.from,
      to: input.to,
      assumptions: {
        gallonSystem: "mpg-us uses the exact US liquid gallon; mpg-imperial uses the exact imperial gallon; they are never treated as the same unit",
        distance: "international mile = 1.609344 km exactly",
      },
      formulas: { conversion: "convert through km/L using the declared gallon system" },
    };
  }
  if (input.mode === "power") {
    if (input.from === undefined || input.to === undefined) throw new Error("INVALID_INPUT");
    const result = convertUnit({ value: input.value, from: input.from, to: input.to });
    if (result.dimension !== "power") throw new Error("INVALID_POWER_UNIT");
    return {
      result: result.result,
      from: result.from,
      to: result.to,
      assumptions: { ...result.assumptions, constants: HORSEPOWER_AUTHORITY },
      formulas: result.formulas,
    };
  }
  throw new Error("INVALID_MODE");
}

export type ReferenceSizeMode = "paper" | "model-scale" | "tv-diagonal-to-dimensions" | "tv-dimensions-to-diagonal";

export interface ReferenceSizeInput {
  readonly mode: ReferenceSizeMode | string;
  readonly paper?: string;
  readonly outputUnit?: string;
  readonly value?: string;
  readonly inputUnit?: string;
  readonly scale?: string;
  readonly direction?: "real-to-model" | "model-to-real";
  readonly diagonal?: string;
  readonly width?: string;
  readonly height?: string;
  readonly aspectWidth?: string;
  readonly aspectHeight?: string;
}

const PAPER_MM: Readonly<Record<string, readonly [number, number]>> = {
  A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148], A7: [74, 105], A8: [52, 74], A9: [37, 52], A10: [26, 37],
  B0: [1000, 1414], B1: [707, 1000], B2: [500, 707], B3: [353, 500], B4: [250, 353], B5: [176, 250], B6: [125, 176], B7: [88, 125], B8: [62, 88], B9: [44, 62], B10: [31, 44],
};

function convertLengthRational(value: Rational, from: string, to: string): Rational {
  const source = resolveUnit(from);
  const target = resolveUnit(to);
  if (source.dimension !== "length" || target.dimension !== "length") throw new Error("INVALID_LENGTH_UNIT");
  const converted = convertRational(value, source, target);
  if (typeof converted === "number") throw new Error("INVALID_LENGTH_UNIT");
  return converted;
}

export function calculateReferenceSize(input: ReferenceSizeInput): Record<string, unknown> {
  if (input.mode === "paper") {
    const paper = (input.paper ?? "A4").trim().toUpperCase();
    const dimensions = PAPER_MM[paper];
    if (dimensions === undefined) throw new Error("UNKNOWN_PAPER_SIZE");
    const outputUnit = input.outputUnit ?? "millimeter";
    const width = convertLengthRational(rational(BigInt(dimensions[0]), 1n), "millimeter", outputUnit);
    const height = convertLengthRational(rational(BigInt(dimensions[1]), 1n), "millimeter", outputUnit);
    const descriptor = resolveUnit(outputUnit);
    return {
      result: `${formatRounded(width)} × ${formatRounded(height)} ${descriptor.symbol}`,
      paper,
      width: formatRounded(width),
      height: formatRounded(height),
      unit: descriptor.symbol,
      assumptions: { standard: "ISO 216:2007 nominal A/B series dimensions in millimetres; no printer margins or bleed are implied" },
      formulas: { conversion: "nominal millimetre dimensions converted through the shared length registry" },
    };
  }
  if (input.mode === "model-scale") {
    if (input.value === undefined || input.inputUnit === undefined || input.outputUnit === undefined || input.scale === undefined) throw new Error("INVALID_INPUT");
    const direction = input.direction;
    if (direction !== "real-to-model" && direction !== "model-to-real") throw new Error("INVALID_DIRECTION");
    const scale = positive(input.scale, "INVALID_SCALE");
    const inputValue = parseDecimal(input.value, "INVALID_VALUE");
    const converted = convertLengthRational(inputValue, input.inputUnit, input.outputUnit);
    const output = direction === "real-to-model" ? divide(converted, scale) : multiply(converted, scale);
    const descriptor = resolveUnit(input.outputUnit);
    return {
      result: `${formatRounded(output)} ${descriptor.symbol}`,
      scale: `1:${formatRounded(scale)}`,
      direction,
      assumptions: { scale: "positive linear model scale; area/volume scaling is intentionally outside this helper" },
      formulas: { conversion: direction === "real-to-model" ? "model length = converted real length ÷ scale denominator" : "real length = converted model length × scale denominator" },
    };
  }
  if (input.mode === "tv-diagonal-to-dimensions") {
    if (input.diagonal === undefined || input.inputUnit === undefined || input.outputUnit === undefined || input.aspectWidth === undefined || input.aspectHeight === undefined) throw new Error("INVALID_INPUT");
    const diagonal = positive(input.diagonal, "INVALID_DIAGONAL");
    const aw = positive(input.aspectWidth, "INVALID_ASPECT");
    const ah = positive(input.aspectHeight, "INVALID_ASPECT");
    const convertedDiagonal = convertLengthRational(diagonal, input.inputUnit, input.outputUnit);
    const d = rationalToNumber(convertedDiagonal);
    const widthRatio = rationalToNumber(aw);
    const heightRatio = rationalToNumber(ah);
    const norm = Math.sqrt(widthRatio * widthRatio + heightRatio * heightRatio);
    const width = d * widthRatio / norm;
    const height = d * heightRatio / norm;
    const descriptor = resolveUnit(input.outputUnit);
    return {
      result: `${numberToDisplay(width, 6)} × ${numberToDisplay(height, 6)} ${descriptor.symbol}`,
      width: numberToDisplay(width, 6),
      height: numberToDisplay(height, 6),
      diagonal: numberToDisplay(d, 6),
      aspect: `${formatRounded(aw)}:${formatRounded(ah)}`,
      assumptions: { geometry: "rectangular visible area; bezels, overscan and manufacturer rounding are excluded" },
      formulas: { dimensions: "width = diagonal × a/√(a²+b²); height = diagonal × b/√(a²+b²)" },
    };
  }
  if (input.mode === "tv-dimensions-to-diagonal") {
    if (input.width === undefined || input.height === undefined || input.inputUnit === undefined || input.outputUnit === undefined) throw new Error("INVALID_INPUT");
    const width = positive(input.width, "INVALID_WIDTH");
    const height = positive(input.height, "INVALID_HEIGHT");
    const convertedWidth = convertLengthRational(width, input.inputUnit, input.outputUnit);
    const convertedHeight = convertLengthRational(height, input.inputUnit, input.outputUnit);
    const w = rationalToNumber(convertedWidth);
    const h = rationalToNumber(convertedHeight);
    const diagonal = Math.sqrt(w * w + h * h);
    const descriptor = resolveUnit(input.outputUnit);
    return {
      result: `${numberToDisplay(diagonal, 6)} ${descriptor.symbol}`,
      diagonal: numberToDisplay(diagonal, 6),
      width: numberToDisplay(w, 6),
      height: numberToDisplay(h, 6),
      assumptions: { geometry: "Pythagorean diagonal of the entered rectangular dimensions" },
      formulas: { diagonal: "√(width² + height²)" },
    };
  }
  throw new Error("UNSOURCED_REFERENCE_FIT");
}

export type UnitOperation =
  | "basic-unit-conversion"
  | "engineering-unit-conversion"
  | "storage-download-calculator"
  | "battery-vehicle-power-helper"
  | "reference-size-converter";

export interface CssRelativeUnitInput {
  readonly mode: "rem" | "em";
  readonly direction: "px-to-relative" | "relative-to-px";
  readonly value: string | number;
  readonly rootFontSize?: string | number;
  readonly currentFontSize?: string | number;
}

export function convertCssRelativeUnit(input: CssRelativeUnitInput): Record<string, unknown> {
  const value = parseDecimal(input.value, "INVALID_VALUE");
  const context = input.mode === "rem"
    ? input.rootFontSize === undefined ? null : parseDecimal(input.rootFontSize, "INVALID_ROOT_FONT_SIZE")
    : input.currentFontSize === undefined ? null : parseDecimal(input.currentFontSize, "INVALID_CURRENT_FONT_SIZE");
  if (context === null) throw new Error(input.mode === "rem" ? "ROOT_FONT_SIZE_REQUIRED" : "CURRENT_FONT_SIZE_REQUIRED");
  if (compareZero(context) <= 0) throw new Error(input.mode === "rem" ? "INVALID_ROOT_FONT_SIZE" : "INVALID_CURRENT_FONT_SIZE");
  const converted = input.direction === "px-to-relative" ? divide(value, context) : multiply(value, context);
  const inputUnit = input.direction === "px-to-relative" ? "px" : input.mode;
  const outputUnit = input.direction === "px-to-relative" ? input.mode : "px";
  return {
    result: formatRounded(converted),
    input: formatRounded(value),
    inputUnit,
    outputUnit,
    contextFontSizePx: formatRounded(context),
    contextKind: input.mode === "rem" ? "root-font-size" : "current-font-size",
    precisionPolicy: `exact rational arithmetic; display rounded to at most ${RESULT_DECIMAL_PLACES} decimal places`,
    formula: input.direction === "px-to-relative"
      ? `${input.mode} = px / ${input.mode === "rem" ? "root font-size" : "current font-size"}`
      : `px = ${input.mode} × ${input.mode === "rem" ? "root font-size" : "current font-size"}`,
  };
}

const BASIC_DIMENSIONS = new Set<UnitDimension>(["length", "mass", "temperature", "area", "volume"]);
const ENGINEERING_DIMENSIONS = new Set<UnitDimension>(["speed", "time", "angle", "energy", "pressure", "power", "force", "torque", "frequency", "density", "flow", "illuminance"]);

export function runUnitOperation(operation: UnitOperation, input: Record<string, unknown>): Record<string, unknown> {
  if (operation === "basic-unit-conversion" || operation === "engineering-unit-conversion") {
    if (operation === "basic-unit-conversion" && input.cssMode !== undefined && input.cssMode !== "standard") {
      const cssMode = input.cssMode;
      const direction = input.cssDirection;
      if ((cssMode !== "rem" && cssMode !== "em") || (direction !== "px-to-relative" && direction !== "relative-to-px")) throw new Error("INVALID_CSS_UNIT_MODE");
      const value = input.value;
      if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_INPUT");
      return convertCssRelativeUnit({
        mode: cssMode,
        direction,
        value,
        ...(input.rootFontSize === undefined ? {} : { rootFontSize: input.rootFontSize as string | number }),
        ...(input.currentFontSize === undefined ? {} : { currentFontSize: input.currentFontSize as string | number }),
      });
    }
    const value = input.value;
    const from = input.from;
    const to = input.to;
    if ((typeof value !== "string" && typeof value !== "number") || typeof from !== "string" || typeof to !== "string") throw new Error("INVALID_INPUT");
    const result = convertUnit({ value, from, to });
    const allowed = operation === "basic-unit-conversion" ? BASIC_DIMENSIONS : ENGINEERING_DIMENSIONS;
    if (!allowed.has(result.dimension)) throw new Error(operation === "basic-unit-conversion" ? "UNSUPPORTED_BASIC_DIMENSION" : "UNSUPPORTED_ENGINEERING_DIMENSION");
    return result as unknown as Record<string, unknown>;
  }
  if (operation === "storage-download-calculator") return calculateStorageDownload(input as unknown as StorageDownloadInput);
  if (operation === "battery-vehicle-power-helper") return calculateBatteryVehiclePower(input as unknown as BatteryVehiclePowerInput);
  return calculateReferenceSize(input as unknown as ReferenceSizeInput);
}
