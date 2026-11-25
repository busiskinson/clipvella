export interface AssetRefs {
  /** projects.source_asset_id of other projects */
  projectSources: string[];
  /** clips.output_asset_id / thumbnail_asset_id of clips that will survive */
  clipOutputs: string[];
  /** media[].assetId on other projects' saved timelines */
  timelineAssets: string[];
}

/** Candidate asset ids that nothing else references and can therefore be deleted. */
export function unreferencedAssets(candidates: string[], refs: AssetRefs): string[] {
  const used = new Set([...refs.projectSources, ...refs.clipOutputs, ...refs.timelineAssets]);
  return candidates.filter((id) => !used.has(id));
}
