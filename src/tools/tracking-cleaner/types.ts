export interface TrackingCleanerInput { url: string }
export interface TrackingCleanerOutput {
  url: string;
  dropped: string[];
  encodingPolicy: string;
  duplicatePolicy: string;
  engineVersion: string;
}
