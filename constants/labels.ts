export const COMMUNITY_LABELS = [
  { val: 'tamilnadu', display: 'Tamil Nadu', color: '#E05A2B', bg: '#FFF0EB' },
  { val: 'eelam',     display: 'Eelam',      color: '#1A7A4A', bg: '#E8F7EF' },
  { val: 'science',   display: 'Science',    color: '#6366F1', bg: '#EEF2FF' },
] as const;

export type CommunityLabelVal = typeof COMMUNITY_LABELS[number]['val'];

export const ALL_FILTER = 'all' as const;
export type FeedFilter = typeof ALL_FILTER | CommunityLabelVal;

/** Find a label config by its val string */
export function getLabelByVal(val: string) {
  return COMMUNITY_LABELS.find(l => l.val === val) ?? null;
}

/** Extract community label vals from a post's labels array */
export function getCommunityLabels(postLabels: any[]): CommunityLabelVal[] {
  if (!Array.isArray(postLabels)) return [];
  return postLabels
    .map((l: any) => l?.val as string)
    .filter((v): v is CommunityLabelVal =>
      COMMUNITY_LABELS.some(cl => cl.val === v)
    );
}
