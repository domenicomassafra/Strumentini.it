import type { CampaignNamingPreset, CampaignNamingValues } from "../../engines/campaign-url";

export interface CampaignNameInput { preset: CampaignNamingPreset; values: CampaignNamingValues }
export interface CampaignNameOutput { name: string; engineVersion: string }
