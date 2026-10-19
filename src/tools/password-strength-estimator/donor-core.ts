import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary } from "@zxcvbn-ts/language-common";
import { ITALIAN_PASSPHRASE_WORDLIST } from "../../reference-data/italian-passphrase-v1";

// The large donor dictionaries are deliberately bounded: the local Italian
// list is owned by the project; the first 5,000 common passwords are ranked
// upstream. This avoids importing the ODC-BY OpenSubtitles Italian dataset.
const estimator = new ZxcvbnFactory({
  graphs: adjacencyGraphs,
  dictionary: {
    "passwords-common": dictionary["passwords-common"].slice(0, 5000),
    "commonWords-it": [...ITALIAN_PASSPHRASE_WORDLIST.words],
  },
  maxLength: 256, // donor bounds work; the public 1,024-code-point limit is separate
});

export interface DonorSummary {
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly patterns: readonly string[];
}

export function estimateDonor(password: string): DonorSummary {
  const checked = estimator.check(password);
  // Do not expose the library's `password`, matched tokens or other secrets.
  return { score: checked.score, patterns: [...new Set(checked.sequence.map(({ pattern }) => pattern))] };
}
