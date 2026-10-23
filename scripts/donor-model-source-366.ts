/** Model-asset source rules for the #366 audit (see #274).
 *
 * Kept in its own module so the main auditor stays within the repository file
 * budget. A same-origin weight is accepted only when the path prefix, the
 * Hugging Face repository, the immutable revision and the file name all agree.
 */
import { pinnedModelRevision366 } from "./donor-asset-distributions-366";

type ModelAsset = { path: string; version: string; source: string };

export function validModelSource366(asset: ModelAsset): boolean {
  const model = pinnedModelRevision366(asset.path);
  if (!model) return false;
  const relative = asset.path.slice(model.prefix.length);
  if (!relative || relative.startsWith("/") || relative.includes("..")) return false;
  let url: URL;
  try { url = new URL(asset.source); } catch { return false; }
  return asset.version === model.revision &&
    url.protocol === "https:" && url.hostname === "huggingface.co" &&
    !url.username && !url.password && !url.search && !url.hash &&
    url.pathname === `/${model.repo}/resolve/${model.revision}/${relative}`;
}

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u;

export function versionAccepted366(asset: ModelAsset, authored: boolean): boolean {
  if (authored || asset.path.startsWith("public/fonts/")) return true;
  const model = pinnedModelRevision366(asset.path);
  if (model) return asset.version === model.revision;
  return SEMVER.test(asset.version);
}
