/**
 * usePostActions — shared like / repost / follow state mutations.
 * Returns helpers that optimistically update local post state.
 */
import { useState, useCallback } from 'react';
import { BskyAgent } from '@atproto/api';

export interface ViewerState {
  like?: string;      // URI of the like record, if liked
  repost?: string;    // URI of the repost record, if reposted
  replyDisabled?: boolean;
}

export interface PostLike {
  uri: string;
  cid: string;
  likeCount: number;
  repostCount: number;
  viewer?: ViewerState;
}

/**
 * Used by PostCard: pass the initial post object and get toggle handlers back.
 * The returned `post` is local state that reflects optimistic updates.
 */
export function usePostActions(agent: BskyAgent | null, initialPost: any) {
  const [post, setPost] = useState<any>(initialPost);

  const toggleLike = useCallback(async () => {
    if (!agent) return;
    const liked = !!post.viewer?.like;
    // Optimistic update
    setPost((p: any) => ({
      ...p,
      likeCount: (p.likeCount ?? 0) + (liked ? -1 : 1),
      viewer: { ...p.viewer, like: liked ? undefined : 'pending' },
    }));
    try {
      if (liked) {
        await agent.deleteLike(post.viewer!.like!);
        setPost((p: any) => ({ ...p, viewer: { ...p.viewer, like: undefined } }));
      } else {
        const res = await agent.like(post.uri, post.cid);
        setPost((p: any) => ({ ...p, viewer: { ...p.viewer, like: res.uri } }));
      }
    } catch {
      // Revert
      setPost((p: any) => ({
        ...p,
        likeCount: (p.likeCount ?? 0) + (liked ? 1 : -1),
        viewer: { ...p.viewer, like: liked ? post.viewer?.like : undefined },
      }));
    }
  }, [agent, post]);

  const toggleRepost = useCallback(async () => {
    if (!agent) return;
    const reposted = !!post.viewer?.repost;
    setPost((p: any) => ({
      ...p,
      repostCount: (p.repostCount ?? 0) + (reposted ? -1 : 1),
      viewer: { ...p.viewer, repost: reposted ? undefined : 'pending' },
    }));
    try {
      if (reposted) {
        await agent.deleteRepost(post.viewer!.repost!);
        setPost((p: any) => ({ ...p, viewer: { ...p.viewer, repost: undefined } }));
      } else {
        const res = await agent.repost(post.uri, post.cid);
        setPost((p: any) => ({ ...p, viewer: { ...p.viewer, repost: res.uri } }));
      }
    } catch {
      setPost((p: any) => ({
        ...p,
        repostCount: (p.repostCount ?? 0) + (reposted ? 1 : -1),
        viewer: { ...p.viewer, repost: reposted ? post.viewer?.repost : undefined },
      }));
    }
  }, [agent, post]);

  return { post, toggleLike, toggleRepost };
}
