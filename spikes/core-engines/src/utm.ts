export interface UtmCampaignInput {
  source: string;
  medium: string;
  campaign: string;
  id?: string;
  term?: string;
  content?: string;
}

export interface ParsedUtmCampaign {
  source?: string;
  medium?: string;
  campaign?: string;
  id?: string;
  term?: string;
  content?: string;
}

const UTM_FIELDS = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
  ["utm_id", "id"],
  ["utm_term", "term"],
  ["utm_content", "content"],
] as const;

export function buildUtmUrl(
  baseUrl: string,
  campaign: UtmCampaignInput,
): string {
  if (
    ![campaign.source, campaign.medium, campaign.campaign].every((value) =>
      value.trim().length > 0
    )
  ) {
    throw new Error("UTM_REQUIRED");
  }

  const url = new URL(baseUrl);
  for (const [queryKey] of UTM_FIELDS) url.searchParams.delete(queryKey);
  for (const [queryKey, field] of UTM_FIELDS) {
    const value = campaign[field];
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(queryKey, value);
    }
  }
  return url.href;
}

export function parseUtmUrl(input: string): ParsedUtmCampaign {
  const params = new URL(input).searchParams;
  const result: ParsedUtmCampaign = {};
  for (const [queryKey, field] of UTM_FIELDS) {
    const value = params.get(queryKey);
    if (value !== null) result[field] = value;
  }
  return result;
}
