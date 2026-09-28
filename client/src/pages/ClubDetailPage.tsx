import { samePerson, managerIds } from '../firebase/identity';
import { parseMoyoungDate, scheduleTimes } from '../../../functions/src/dateTime.js';
import { accountCache, cacheForAccount } from '../firebase/accountCache';
import React, { useState, useEffect, useRef } from 'react';
import { User, ClubDetailData, ClubPostItem, ClubPollItem, ClubScheduleItem } from '../types';
import { 
  ArrowLeft, Edit3, Image as ImageIcon, X, Trash2,
  Send, CornerDownRight, Heart, Handshake,
  Pin, PinOff, MoreVertical, MessageCircle, Calendar, Vote,
  Clock, MapPin, DollarSign, Plus, Check, Eye, BarChart3, Loader2, RefreshCw
} from 'lucide-react';
import { ClubAnalyticsModal } from '../components/ClubAnalyticsModal';

interface ClubDetailPageProps {
  clubId: number;
  user: User;
  initialTab?: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos';
  onBackToLobby: () => void;
}

export const ClubDetailPage: React.FC<ClubDetailPageProps> = ({
  clubId,
  user,
  onBackToLobby,
}) => {
  const accountCache = cacheForAccount(user.username);
  const [data, setData] = useState<ClubDetailData | null>(() => {
    try {
      const cached = accountCache.getItem(`dfmc_club_cache_${clubId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = accountCache.getItem(`dfmc_club_cache_${clubId}`);
      return !cached;
    } catch {
      return true;
    }
  });
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // Edit Club Info Modal (Head Admin)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Create Poll Modal
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['참석', '불참']);
  const [pollEndDate, setPollEndDate] = useState('');
  const [selectedVoteOption, setSelectedVoteOption] = useState<Record<number, string>>({});
  const [isSubmittingVote, setIsSubmittingVote] = useState<number | null>(null);

  // Create Schedule Modal
  const [showSchedModal, setShowSchedModal] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedStartTime, setSchedStartTime] = useState('22:00');
  const [schedEndTime, setSchedEndTime] = useState('23:59');
  const [schedLocation, setSchedLocation] = useState('');
  const [schedFee, setSchedFee] = useState('10,000원');
  const [attendingScheduleId, setAttendingScheduleId] = useState<number | null>(null);

  // Feed Post Creation & Explorer File Upload
  const [postContent, setPostContent] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feed Post Editing & Explorer File Upload
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingImageUrl, setEditingImageUrl] = useState('');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // UI state
  // Removed artificial pinned banner state - actual pinned posts are rendered at top
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Comments & Replies
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [openScheduleComments, setOpenScheduleComments] = useState<Record<number, boolean>>({});
  const [scheduleCommentInputs, setScheduleCommentInputs] = useState<Record<number, string>>({});
  const [openPollComments, setOpenPollComments] = useState<Record<number, boolean>>({});
  const [pollCommentInputs, setPollCommentInputs] = useState<Record<number, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [replyingToId, setReplyingToId] = useState<number | null>(null);

  // Kebab Menu State
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverActionType, setHandoverActionType] = useState<'appoint' | 'dismiss'>('appoint');
  const [handoverTargetUserId, setHandoverTargetUserId] = useState<number | null>(null);
  const [handoverSearch, setHandoverSearch] = useState('');

  // Photo Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Feed Stream 10-item Pagination / Infinite Scroll
  const [visibleFeedCount, setVisibleFeedCount] = useState<number>(10);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const token = accountCache.getItem('dfmc_token');

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const flash = (msg: string) => {
    setActionMessage(msg);
    setActionError('');
    setTimeout(() => setActionMessage(''), 4000);
  };

  const flashErr = (err: string) => {
    setActionError(err);
    setTimeout(() => setActionError(''), 4000);
  };

  useEffect(() => {
    if(!showHandoverModal) return;
    let active=true;
    fetch('/api/clubs/'+clubId+'/members',{headers:{Authorization:'Bearer '+token}})
      .then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);return result;})
      .then(result=>{if(active)setData(prev=>prev?{...prev,churchMembers:result.members}:prev);})
      .catch(error=>{if(active)flashErr(error.message);});
    return ()=>{active=false;};
  },[showHandoverModal,clubId,token]);

  useEffect(() => {
    if (!data || isSubmittingVote !== null || attendingScheduleId !== null) return;
    try { cacheForAccount(user.username).setItem(`dfmc_club_cache_${clubId}`, JSON.stringify(data)); } catch {}
  }, [data, clubId, user.username, isSubmittingVote, attendingScheduleId]);

  const loadClubData = async () => {
    const cacheKey = `dfmc_club_cache_${clubId}`;
    const cached = accountCache.getItem(cacheKey);
    if (cached && !data) {
      try {
        const d = JSON.parse(cached);
        setData(d);
        setEditName(d.club.name);
        setEditDesc(d.club.description);
        setEditIcon(d.club.icon);
      } catch(e) {}
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('모영 정보를 불러오지 못했습니다.');
      const d: ClubDetailData = await res.json();
      accountCache.setItem(cacheKey, JSON.stringify(d));
      setData(d);
      setEditName(d.club.name);
      setEditDesc(d.club.description);
      setEditIcon(d.club.icon);
    } catch (err: any) {
      flashErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Track feed view count once per browser session (regardless of entry route: polls, schedules, or club cards)
  const trackFeedVisit = async () => {
    const sessionKey = `dfmc_visited_club_${clubId}`;
    if (!sessionStorage.getItem(sessionKey)) {
      try {
        sessionStorage.setItem(sessionKey, '1');
        const res = await fetch(`/api/clubs/${clubId}/visit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const vData = await res.json();
          if (vData.view_count !== undefined) {
            setData(prev => prev ? {
              ...prev,
              club: {
                ...prev.club,
                view_count: vData.view_count
              }
            } : prev);
          }
        }
      } catch (err) {
        console.warn('방문 조회수 집계 안내:', err);
      }
    }
  };

  useEffect(() => {
    loadClubData();
    trackFeedVisit();
  }, [clubId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Update Club Name / Icon (Head Admin only)
  const handleSaveClubInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clubs/${clubId}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, description: editDesc, icon: editIcon }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setShowEditModal(false);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // 2. Toggle Pin Post
  const handleTogglePinPost = async (postId: number) => {
    // Optimistic toggle
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, posts: prev.posts.map(p => p.id === postId ? { ...p, is_pinned: p.is_pinned ? 0 : 1 } : p) };
    });
    try {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}/pin`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
    } catch (err: any) {
      flashErr(err.message);
      loadClubData();
    }
  };

  // 3. File Explorer Select & Remove for Create Post


  // 4. File Explorer Select & Remove for Edit Post
  const handleStartEditPost = (post: ClubPostItem) => {
    setEditingPostId(post.id);
    setEditingContent(post.content || '');
    setEditingImageUrl(post.image_url || '');

  };


  const handleRemoveEditImage = () => {


    setEditingImageUrl('');

  };

  // 5. Create Post (Text is optional if image exists! "중요 공지" checkbox removed)
  const handleCreatePost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hasText = Boolean(postContent.trim());
    const hasImage = false;
    if (!hasText && !hasImage) {
      flashErr('글 내용을 입력해주세요.');
      return;
    }

    setIsSubmittingPost(true);
    try {
      const finalImageUrl = null;


      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: postContent.trim(), image_url: finalImageUrl }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setPostContent('');

      await loadClubData();
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err: any) {
      flashErr(err.message);
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // 6. Update Post (Text is optional if image exists!)
  const handleUpdatePost = async (postId: number) => {
    const hasText = Boolean(editingContent.trim());
    const hasImage = Boolean(editingImageUrl.trim());
    if (!hasText && !hasImage) {
      flashErr('글 내용을 입력해주세요.');
      return;
    }

    setIsUpdatingPost(true);
    try {
      let finalImageUrl = editingImageUrl.trim() || null;


      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: editingContent.trim(),
          image_url: finalImageUrl,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setEditingPostId(null);
      setEditingContent('');
      setEditingImageUrl('');

      await loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    } finally {
      setIsUpdatingPost(false);
    }
  };

  // 7. Delete Post (Media Admin & Head/Server Admin ONLY)
  const handleDeletePost = async (postId: number) => {
    if (!confirm('이 글을 삭제하시겠습니까?')) return;
    // Optimistic remove
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, posts: prev.posts.filter(p => p.id !== postId) };
    });
    flash('게시글이 삭제되었습니다.');
    try {
      fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      flashErr(err.message);
      loadClubData();
    }
  };

  // 8. Reactions Handler (Target: 'post', 'comment', or 'schedule', emoji includes 'smile')
  const handleToggleReaction = async (targetType: 'post' | 'comment' | 'schedule', targetId: number, emoji: string) => {
    // Optimistic UI Update
    if (data) {
      const newData = { ...data };
      const toggleEmoji = (item: any) => {
        if (!item.reactions) item.reactions = {};
        if (!item.my_reactions) item.my_reactions = [];
        
        const hasReacted = item.my_reactions.includes(emoji);
        if (hasReacted) {
          item.my_reactions = item.my_reactions.filter((e: string) => e !== emoji);
          item.reactions[emoji] = Math.max(0, (item.reactions[emoji] || 0) - 1);
        } else {
          item.my_reactions.push(emoji);
          item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
        }
      };

      if (targetType === 'post') {
        const post = newData.posts?.find(p => p.id === targetId);
        if (post) toggleEmoji(post);
      } else if (targetType === 'comment') {
        let found = false;
        newData.posts?.forEach(p => {
          if (found) return;
          const comm = p.comments?.find(c => c.id === targetId);
          if (comm) { toggleEmoji(comm); found = true; }
        });
        if (!found) {
          newData.schedules?.forEach(s => {
            if (found) return;
            const comm = s.comments?.find(c => c.id === targetId);
            if (comm) { toggleEmoji(comm); found = true; }
          });
        }
      } else if (targetType === 'schedule') {
        const sched = newData.schedules?.find(s => s.id === targetId);
        if (sched) toggleEmoji(sched);
      }
      setData(newData);
    }

    try {
      // Fire and forget
      fetch(`/api/clubs/${clubId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType, targetId, emoji }),
      });
    } catch (err: any) {
      // Ignore background errors
    }
  };

  // 9. Comment Handlers
  const handleAddComment = async (postId: number, parentCommentId: number | null = null) => {
    const text = parentCommentId ? (replyInputs[parentCommentId] || '') : (commentInputs[postId] || '');
    if (!text.trim()) return;

    const tempId = Date.now();
    // Optimistic Update
    if (data) {
      const newData = { ...data };
      const newComment = {
        id: tempId,
        post_id: postId,
        user_id: user.id,
        user_name: user.name,
        user_cell: user.cell_name || '',
        content: text.trim(),
        parent_comment_id: parentCommentId,
        created_at: new Date().toISOString(),
        reactions: {},
        my_reactions: []
      };
      const post = newData.posts?.find(p => p.id === postId);
      if (post) {
        if (!post.comments) post.comments = [];
        post.comments.push(newComment);
      }
      setData(newData);
    }

    if (parentCommentId) {
      setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
      setReplyingToId(null);
    } else {
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    }
    setOpenComments(prev => ({ ...prev, [postId]: true }));

    try {
      fetch(`/api/clubs/${clubId}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim(), parent_comment_id: parentCommentId }),
      }).then(res => res.json()).then(resData => {
        if (resData.comment) {
          setData(prev => {
            if (!prev) return prev;
            const newData = { ...prev };
            const post = newData.posts?.find(p => p.id === postId);
            if (post && post.comments) {
              const idx = post.comments.findIndex(c => c.id === tempId);
              if (idx !== -1) post.comments[idx] = resData.comment;
            }
            return newData;
          });
        }
      });
    } catch (err: any) {
      // Ignore background errors
    }
  };

  const handleAddScheduleComment = async (scheduleId: number, parentCommentId: number | null = null) => {
    const text = parentCommentId ? (replyInputs[parentCommentId] || '') : (scheduleCommentInputs[scheduleId] || '');
    if (!text.trim()) return;

    const tempId = Date.now();
    // Optimistic Update
    if (data) {
      const newData = { ...data };
      const newComment = {
        id: tempId,
        schedule_id: scheduleId,
        user_id: user.id,
        user_name: user.name,
        user_cell: user.cell_name || '',
        content: text.trim(),
        parent_comment_id: parentCommentId,
        created_at: new Date().toISOString(),
        reactions: {},
        my_reactions: []
      };
      const sched = newData.schedules?.find(s => s.id === scheduleId);
      if (sched) {
        if (!sched.comments) sched.comments = [];
        sched.comments.push(newComment);
      }
      setData(newData);
    }

    if (parentCommentId) {
      setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
      setReplyingToId(null);
    } else {
      setScheduleCommentInputs(prev => ({ ...prev, [scheduleId]: '' }));
    }
    setOpenScheduleComments(prev => ({ ...prev, [scheduleId]: true }));

    try {
      fetch(`/api/clubs/${clubId}/schedules/${scheduleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim(), parent_comment_id: parentCommentId }),
      }).then(res => res.json()).then(resData => {
        if (resData.comment) {
          setData(prev => {
            if (!prev) return prev;
            const newData = { ...prev };
            const sched = newData.schedules?.find(s => s.id === scheduleId);
            if (sched && sched.comments) {
              const idx = sched.comments.findIndex(c => c.id === tempId);
              if (idx !== -1) sched.comments[idx] = resData.comment;
            }
            return newData;
          });
        }
      });
    } catch (err: any) {
      // Ignore background errors
    }
  };

  const handleAddPollComment = async (pollId: number, parentCommentId: number | null = null) => {
    const text = parentCommentId ? (replyInputs[parentCommentId] || '') : (pollCommentInputs[pollId] || '');
    if (!text.trim()) return;

    const tempId = Date.now();
    // Optimistic Update
    if (data) {
      const newData = { ...data };
      const newComment = {
        id: tempId,
        poll_id: pollId,
        user_id: user.id,
        user_name: user.name,
        user_cell: user.cell_name || '',
        content: text.trim(),
        parent_comment_id: parentCommentId,
        created_at: new Date().toISOString()
      };
      const poll = newData.polls?.find(p => p.id === pollId);
      if (poll) {
        if (!poll.comments) poll.comments = [];
        poll.comments.push(newComment);
      }
      setData(newData);
    }

    if (parentCommentId) {
      setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
      setReplyingToId(null);
    } else {
      setPollCommentInputs(prev => ({ ...prev, [pollId]: '' }));
    }
    setOpenPollComments(prev => ({ ...prev, [pollId]: true }));

    try {
      fetch(`/api/clubs/${clubId}/polls/${pollId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim(), parent_comment_id: parentCommentId }),
      }).then(res => res.json()).then(resData => {
        if (resData.comment) {
          setData(prev => {
            if (!prev) return prev;
            const newData = { ...prev };
            const poll = newData.polls?.find(p => p.id === pollId);
            if (poll && poll.comments) {
              const idx = poll.comments.findIndex(c => c.id === tempId);
              if (idx !== -1) poll.comments[idx] = resData.comment;
            }
            return newData;
          });
        }
      });
    } catch (err: any) {
      // Ignore background errors
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    // Optimistic remove from posts, schedules, and polls
    setData(prev => {
      if (!prev) return prev;
      const newData = { ...prev };
      newData.posts = newData.posts.map(p => ({
        ...p,
        comments: (p.comments || []).filter(c => c.id !== commentId)
      }));
      if (newData.schedules) {
        newData.schedules = newData.schedules.map(s => ({
          ...s,
          comments: (s.comments || []).filter(c => c.id !== commentId)
        }));
      }
      if (newData.polls) {
        newData.polls = newData.polls.map(p => ({
          ...p,
          comments: (p.comments || []).filter(c => c.id !== commentId)
        }));
      }
      return newData;
    });
    flash('댓글이 삭제되었습니다.');
    try {
      const res = await fetch(`/api/clubs/${clubId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '댓글을 삭제하지 못했습니다.');
    } catch (err: any) {
      flashErr(err.message);
      loadClubData();
    }
  };

  // 10. Handover Handlers
  const handleProposeHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverTargetUserId) {
      flashErr('대상 성도를 선택해주세요.');
      return;
    }
    try {
      const res = await fetch(`/api/clubs/${clubId}/handover/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: handoverTargetUserId, actionType: handoverActionType }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setShowHandoverModal(false);
      setHandoverTargetUserId(null);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleAgreeHandover = async (voteId: number) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/handover/${voteId}/agree`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // 11. Create Poll Handler (Popup Modal)
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollTitle.trim()) {
      flashErr('투표 제목을 입력해주세요.');
      return;
    }
    const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      flashErr('선택지는 최소 2개 이상 입력해주세요.');
      return;
    }
    if (!pollEndDate) {
      flashErr('투표 마감 일시를 설정해주세요.');
      return;
    }
    try {
      const res = await fetch(`/api/clubs/${clubId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: pollTitle.trim(),
          description: pollDesc.trim(),
          options: cleanOptions,
          end_date: pollEndDate
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setShowPollModal(false);
      setPollTitle('');
      setPollDesc('');
      setPollOptions(['참석', '불참']);
      setPollEndDate('');
      // Optimistic add poll
      if (resData.poll) {
        setData(prev => {
          if (!prev) return prev;
          return { ...prev, polls: [resData.poll, ...prev.polls] };
        });
      } else {
        loadClubData();
      }
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // 12. Vote in Poll Handler (With Confirmation Button)
  const handleVoteSubmit = async (pollId: number) => {
    const option = selectedVoteOption[pollId];
    if (!option) {
      flashErr('투표할 항목을 먼저 선택해주세요.');
      return;
    }
    if (isSubmittingVote !== null) return;
    const before = data?.polls.find(p=>p.id===pollId);
    if(!before) return;
    setIsSubmittingVote(pollId);
      // Optimistic vote update
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, polls: prev.polls.map(p => {
          if (p.id !== pollId) return p;
          const newCounts = { ...p.option_counts };
          if (p.my_vote && newCounts[p.my_vote] !== undefined) newCounts[p.my_vote] = Math.max(0, newCounts[p.my_vote] - 1);
          newCounts[option] = (newCounts[option] || 0) + 1;
          return { ...p, my_vote: option, option_counts: newCounts, total_votes: (p.total_votes || 0) + (p.my_vote ? 0 : 1) };
        })};
      });

    try {
      const res = await fetch(`/api/clubs/${clubId}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selected_option: option, selectedOption: option }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
    } catch (err: any) {
      setData(prev=>prev?{...prev,polls:prev.polls.map(p=>p.id===pollId?before:p)}:prev);
      flashErr(err.message);
    } finally {
      setIsSubmittingVote(null);
    }
  };

  // Close Poll Handler
  const handleClosePoll = async (pollId: number) => {
    if (!confirm('이 투표를 마감하시겠습니까? 마감 시 상단 고정에서 제거되고 결과가 지난 피드에 보존됩니다.')) return;
    // Optimistic close
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, polls: prev.polls.map(p => p.id === pollId ? { ...p, is_closed: 1 } : p) };
    });
    flash('투표가 마감되었습니다.');
    try {
      fetch(`/api/clubs/${clubId}/polls/${pollId}/close`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      flashErr(err.message);
      loadClubData();
    }
  };

  // Delete Poll Handler
  const handleDeletePoll = async (pollId: number) => {
    if (!confirm('이 투표를 삭제하시겠습니까?')) return;
    // Optimistic remove
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, polls: prev.polls.filter(p => p.id !== pollId) };
    });
    flash('투표가 삭제되었습니다.');
    try {
      fetch(`/api/clubs/${clubId}/polls/${pollId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      flashErr(err.message);
      loadClubData();
    }
  };

  // 13. Create Schedule Handler (Popup Modal)
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim() || !schedDate || !schedStartTime || !schedEndTime || !schedLocation.trim()) {
      flashErr('모임명, 날짜, 시간, 장소를 모두 입력해주세요.');
      return;
    }
    try {
      const combinedDate = `${schedDate} ${schedStartTime} ~ ${schedEndTime}`;
      const res = await fetch(`/api/clubs/${clubId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: schedTitle.trim(),
          event_date: combinedDate,
          location: schedLocation.trim(),
          fee_info: schedFee.trim() || '10,000원'
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setShowSchedModal(false);
      setSchedTitle('');
      setSchedDate('');
      setSchedStartTime('22:00');
      setSchedEndTime('23:59');
      setSchedLocation('');
      setSchedFee('10,000원');
      // Optimistic add schedule
      if (resData.schedule) {
        setData(prev => {
          if (!prev) return prev;
          return { ...prev, schedules: [...prev.schedules, resData.schedule] };
        });
      } else {
        loadClubData();
      }
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // 14. Toggle Schedule Attendance Handler
  const handleToggleAttendance = async (scheduleId: number) => {
    if (attendingScheduleId !== null) return;
    const before = data?.schedules.find(s => s.id === scheduleId);
    if (!before) return;
    const attending = !(before.attendees || []).some((a: any) => samePerson(a, user));
    setAttendingScheduleId(scheduleId);
    const next = (before.attendees || []).filter((a: any) => !samePerson(a, user));
    if (attending) next.push({userId:user.id, userName:user.name, cellName:user.cell_name});
    setData(prev => prev ? {...prev, schedules:prev.schedules.map(s => s.id === scheduleId ? {...s, attendees:next, is_attending:attending} : s)} : prev);
    try {
      const res = await fetch('/api/clubs/' + clubId + '/schedules/' + scheduleId + '/attend', {method:'POST', headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'}, body:JSON.stringify({attending})});
      const result = await res.json(); if(!res.ok) throw new Error(result.error);
      setData(prev => prev ? {...prev,schedules:prev.schedules.map(s=>s.id===scheduleId?{...s,attendees:result.attendees,is_attending:result.is_attending}:s)} : prev);
    } catch(error:any) { setData(prev=>prev?{...prev,schedules:prev.schedules.map(s=>s.id===scheduleId?before:s)}:prev);flashErr(error.message); }
    finally { setAttendingScheduleId(null); }
  };

  // Delete Schedule Handler
  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    // Optimistic remove
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, schedules: prev.schedules.filter(s => s.id !== scheduleId) };
    });
    flash('일정이 삭제되었습니다.');
    try {
      fetch(`/api/clubs/${clubId}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      flashErr(err.message);
      loadClubData();
    }
  };

  const club = data?.club || { id: clubId, name: '', description: '', icon: '🌟', manager_names: '', member_count: 0 };
  const isManager = Boolean(data?.isManager);
  const posts = data?.posts || [];
  const polls = data?.polls || [];
  const schedules = data?.schedules || [];
  const managers = (club.manager_names || '').split(',').map(s => s.trim()).filter(Boolean);
  const isHost = isManager || user.role === 'head_admin' || user.role === 'server_admin';
  const canModerateComments = isHost || user.role === 'media_admin';

  const isPollClosed = (p: ClubPollItem) => Boolean(p.is_closed || p.is_expired || (p.end_date && (parseMoyoungDate(p.end_date, true) ?? 0) <= Date.now()));

  const getScheduleTimestamp = (s: ClubScheduleItem) => scheduleTimes(s).startsAtMs ?? NaN;
  const isSchedulePast = (s: ClubScheduleItem) => (scheduleTimes(s).endsAtMs ?? 0) <= Date.now();

  // 1. Pinned Notices / Posts (Always at the very top of the feed)
  const pinnedPosts: ClubPostItem[] = (posts || [])
    .filter(p => p.is_pinned === 1)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 2. Ongoing/Active Polls (Sorted by imminent deadline)
  const activePolls: ClubPollItem[] = (polls || [])
    .filter(p => !isPollClosed(p))
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
  // Closed or expired polls (Integrated into main feed stream)
  const closedPolls: ClubPollItem[] = (polls || []).filter(p => isPollClosed(p));

  // 3. Ongoing/Upcoming Schedules (Sorted by imminent date)
  const activeSchedules: ClubScheduleItem[] = (schedules || [])
    .filter(s => !isSchedulePast(s))
    .sort((a, b) => getScheduleTimestamp(a) - getScheduleTimestamp(b));
  // Past schedules (Integrated into main feed stream)
  const pastSchedules: ClubScheduleItem[] = (schedules || []).filter(s => isSchedulePast(s));

  // 4. Combined Top Active Items (진행 중인 모임과 투표가 상단으로 가되, 마감/일정 임박한 것들이 위에 있게 정렬)
  type TopActiveItem =
    | { itemType: 'active_poll'; poll: ClubPollItem; targetTime: number }
    | { itemType: 'active_schedule'; schedule: ClubScheduleItem; targetTime: number };

  const topActiveItems: TopActiveItem[] = [
    ...activePolls.map(poll => ({
      itemType: 'active_poll' as const,
      poll,
      targetTime: new Date(poll.end_date).getTime() || (Date.now() + 7 * 24 * 60 * 60 * 1000)
    })),
    ...activeSchedules.map(schedule => ({
      itemType: 'active_schedule' as const,
      schedule,
      targetTime: getScheduleTimestamp(schedule) || (Date.now() + 7 * 24 * 60 * 60 * 1000)
    }))
  ].sort((a, b) => (a.itemType === 'active_schedule' ? 0 : 1) - (b.itemType === 'active_schedule' ? 0 : 1) || a.targetTime - b.targetTime);

  // 4. Regular (Unpinned) Posts (Chronological, newest first)
  const regularPosts: ClubPostItem[] = (posts || [])
    .filter(p => !p.is_pinned)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Unified Feed Timeline: Regular posts + Closed Polls + Past Schedules
  type FeedTimelineItem =
    | { itemType: 'post'; post: ClubPostItem; time: number }
    | { itemType: 'closed_poll'; poll: ClubPollItem; time: number }
    | { itemType: 'past_schedule'; schedule: ClubScheduleItem; time: number };

  const feedTimeline: FeedTimelineItem[] = [
    ...regularPosts.map(p => ({
      itemType: 'post' as const,
      post: p,
      time: new Date(p.created_at).getTime() || 0
    })),
    ...closedPolls.map(poll => ({
      itemType: 'closed_poll' as const,
      poll,
      time: new Date(poll.created_at || poll.end_date).getTime() || 0
    })),
    ...pastSchedules.map(sched => ({
      itemType: 'past_schedule' as const,
      schedule: sched,
      time: getScheduleTimestamp(sched) || new Date(sched.created_at).getTime() || 0
    }))
  ].sort((a, b) => b.time - a.time);

  // 10-item Pagination / Infinite Scroll for Feed Stream
  const visibleTimeline = data?.paginated ? feedTimeline : feedTimeline.slice(0, visibleFeedCount);
  const hasMoreFeed = data?.paginated ? !!data.nextCursor : visibleFeedCount < feedTimeline.length;

  const handleLoadMoreFeed = async () => {
    if (isLoadingMore || !hasMoreFeed) return;
    setIsLoadingMore(true);
    if (data?.paginated) {
      try {
        const res=await fetch('/api/clubs/'+clubId+'?cursor='+encodeURIComponent(data.nextCursor || ''),{headers:{Authorization:'Bearer '+token}});
        if(!res.ok) throw new Error('다음 글을 불러오지 못했습니다.');
        const page:ClubDetailData=await res.json();
        const merge=<T extends {id:number}>(a:T[],b:T[])=>[...new Map([...a,...b].map(item=>[item.id,item])).values()];
        setData(prev=>prev?{...prev,nextCursor:page.nextCursor,posts:merge(prev.posts,page.posts),polls:merge(prev.polls,page.polls),schedules:merge(prev.schedules,page.schedules)}:prev);
      } catch(err:any){flashErr(err.message);} finally{setIsLoadingMore(false);}
      return;
    }
    setTimeout(() => {
      setVisibleFeedCount(prev => prev + 10);
      setIsLoadingMore(false);
    }, 250);
  };

  useEffect(() => {
    if (!hasMoreFeed || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMoreFeed();
        }
      },
      { threshold: 0.1 }
    );

    const currentElem = loadMoreRef.current;
    if (currentElem) observer.observe(currentElem);

    return () => {
      if (currentElem) observer.unobserve(currentElem);
    };
  }, [hasMoreFeed, isLoadingMore, visibleFeedCount, feedTimeline.length]);

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '12px' }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <div style={{ color: 'var(--color-primary)', fontWeight: '700', fontSize: '14px' }}>
          모영 정보를 빠르게 불러오는 중...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatThreadsTime = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const renderPostItem = (item: ClubPostItem, isLast: boolean) => {
    const isAuthor = item.user_id === user.id;
    const canEdit = isAuthor || user.role === 'head_admin' || user.role === 'server_admin';
    const canDelete = user.role === 'media_admin' || user.role === 'head_admin' || user.role === 'server_admin';
    const canPin = isHost;

              return (
                <article
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '14px 16px 12px',
                    borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    position: 'relative',
                    background: item.is_pinned ? '#f0f7ff' : '#ffffff',
                    borderLeft: item.is_pinned ? '4.5px solid #2563eb' : '4.5px solid transparent',
                    boxShadow: item.is_pinned ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {/* Left Column: Avatar */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: '800',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {item.user_name.slice(0, 1)}
                      </div>
                    </div>

                    {/* Right Column: Author, Post content, Kebab Menu */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                            {item.user_name}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {item.user_cell || '둔산제일교회'}
                          </span>
                          <span style={{ color: '#cbd5e1', fontSize: '11px' }}>·</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatThreadsTime(new Date(item.created_at).getTime())}
                          </span>
                          {item.is_pinned === 1 && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                              color: '#ffffff',
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)'
                            }}>
                              <Pin size={10} />
                              <span>고정됨</span>
                            </span>
                          )}
                        </div>

                        {/* Kebab Action Menu */}
                        {(canPin || canEdit || canDelete) && (
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === item.id ? null : item.id);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                padding: '4px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="더보기"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeMenuId === item.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '24px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  padding: '4px',
                                  zIndex: 30,
                                  minWidth: '130px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}
                              >
                                {canPin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleTogglePinPost(item.id);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      color: item.is_pinned ? '#475569' : '#2563eb',
                                      background: 'none',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      width: '100%'
                                    }}
                                  >
                                    {item.is_pinned ? (
                                      <>
                                        <PinOff size={13} color="#64748b" />
                                        <span>상단 고정 해제</span>
                                      </>
                                    ) : (
                                      <>
                                        <Pin size={13} color="#2563eb" />
                                        <span>피드 상단 고정</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      if (editingPostId === item.id) {
                                        setEditingPostId(null);
                                      } else {
                                        handleStartEditPost(item);
                                      }
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: '#334155',
                                      background: 'none',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      width: '100%'
                                    }}
                                  >
                                    <Edit3 size={13} color="#64748b" />
                                    <span>글 수정하기</span>
                                  </button>
                                )}

                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleDeletePost(item.id);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: '#ef4444',
                                      background: 'none',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      width: '100%'
                                    }}
                                  >
                                    <Trash2 size={13} color="#ef4444" />
                                    <span>삭제하기</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content: Edit Mode or View Mode */}
                      {editingPostId === item.id ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '6px',
                          background: '#f8fafc',
                          border: '1.5px solid var(--color-primary)',
                          borderRadius: '10px',
                          padding: '10px 12px'
                        }}>
                          <textarea
                            className="form-input"
                            placeholder="글 내용 입력"
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            rows={3}
                            style={{
                              fontSize: '13.5px',
                              padding: '8px',
                              resize: 'vertical',
                              background: '#ffffff',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1'
                            }}
                          />

                          {/* Edit Mode Image Preview & Replace */}
                          {(editingImageUrl) && (
                            <div style={{
                              position: 'relative',
                              display: 'inline-block',
                              maxWidth: '220px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              background: '#0f172a'
                            }}>
                              <img
                                src={editingImageUrl}
                                alt="수정 첨부 이미지"
                                style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }}
                              />
                              <button
                                type="button"
                                onClick={handleRemoveEditImage}
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  right: '4px',
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: 'rgba(0,0,0,0.7)',
                                  color: '#fff',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="사진 삭제"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>



                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPostId(null);
                                  setEditingContent('');
                                  setEditingImageUrl('');


                                }}
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px' }}
                                disabled={isUpdatingPost}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdatePost(item.id)}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '11.5px', padding: '4px 12px', borderRadius: '6px', fontWeight: '700' }}
                                disabled={isUpdatingPost || (!editingContent.trim() && !editingImageUrl.trim())}
                              >
                                {isUpdatingPost ? '저장 중...' : '수정 완료'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Post Text: Only render when non-empty */}
                          {item.content && item.content.trim() && (
                            <div style={{
                              fontSize: '14px',
                              color: '#1e293b',
                              lineHeight: '1.55',
                              whiteSpace: 'pre-line',
                              marginTop: '2px'
                            }}>
                              {item.content.startsWith('[공지]') && (
                                <span style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontWeight: '800',
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginRight: '6px'
                                }}>
                                  공지
                                </span>
                              )}
                              {item.content.replace(/^[공지]\s*/, '')}
                            </div>
                          )}

                          {/* Image Attachment (clickable for lightbox) */}
                          {item.image_url && (
                            <div style={{ marginTop: item.content && item.content.trim() ? '8px' : '2px', maxWidth: '440px' }}>
                              <img
                                src={item.image_url}
                                alt="스레드 첨부 사진"
                                onClick={() => setLightboxPhoto(item.image_url!)}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '320px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: 'var(--shadow-sm)'
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {/* Reactions & Comments Action Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '10px'
                      }}>
                        {/* Heart */}
                        <button
                          type="button"
                          onClick={() => handleToggleReaction('post', item.id, 'heart')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: item.my_reactions?.includes('heart') ? '#ef4444' : '#64748b',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          <Heart
                            size={16}
                            color={item.my_reactions?.includes('heart') ? '#ef4444' : '#64748b'}
                            fill={item.my_reactions?.includes('heart') ? '#ef4444' : 'none'}
                          />
                          <span>{item.reactions?.heart || 0}</span>
                        </button>

                        {/* Comment Toggle */}
                        <button
                          type="button"
                          onClick={() => setOpenComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: openComments[item.id] ? 'var(--color-primary)' : '#64748b',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginLeft: '4px'
                          }}
                        >
                          <MessageCircle size={16} />
                          <span>댓글 {(item.comments || []).length}</span>
                        </button>
                      </div>

                      {/* Comments & Replies Thread Section */}
                      {openComments[item.id] && (
                        <div style={{
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          {/* Comments List */}
                          {(item.comments || [])
                            .filter(c => !c.parent_comment_id)
                            .map((parentComm) => {
                              const replies = (item.comments || []).filter(r => r.parent_comment_id === parentComm.id);
                              return (
                                <div key={parentComm.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {/* Parent Comment */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    background: '#f8fafc',
                                    padding: '8px 10px',
                                    borderRadius: '8px'
                                  }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                                          {parentComm.user_name}
                                        </span>
                                        <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                                          {parentComm.user_cell}
                                        </span>
                                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                          {formatThreadsTime(new Date(parentComm.created_at).getTime())}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '3px' }}>
                                        {parentComm.content}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <button
                                        type="button"
                                        onClick={() => setReplyingToId(replyingToId === parentComm.id ? null : parentComm.id)}
                                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}
                                      >
                                        답글
                                      </button>
                                      {(parentComm.user_id === user.id || canModerateComments) && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteComment(parentComm.id)}
                                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Child Replies */}
                                  {replies.map((r) => (
                                    <div
                                      key={r.id}
                                      style={{
                                        marginLeft: '20px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '6px',
                                        background: '#f1f5f9',
                                        padding: '6px 10px',
                                        borderRadius: '8px'
                                      }}
                                    >
                                      <CornerDownRight size={12} color="#94a3b8" style={{ marginTop: '3px', flexShrink: 0 }} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b' }}>
                                            {r.user_name}
                                          </span>
                                          <span style={{ fontSize: '10px', color: '#64748b' }}>{r.user_cell}</span>
                                          <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                                            {formatThreadsTime(new Date(r.created_at).getTime())}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '2px' }}>
                                          {r.content}
                                        </div>
                                      </div>
                                      {(r.user_id === user.id || canModerateComments) && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteComment(r.id)}
                                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      )}
                                    </div>
                                  ))}

                                  {/* Reply Input Box */}
                                  {replyingToId === parentComm.id && (
                                    <div style={{ marginLeft: '20px', display: 'flex', gap: '6px', marginTop: '2px' }}>
                                      <input
                                        type="text"
                                        className="form-input"
                                        placeholder={`${parentComm.user_name}님에게 답글 작성...`}
                                        value={replyInputs[parentComm.id] || ''}
                                        onChange={(e) => setReplyInputs(prev => ({ ...prev, [parentComm.id]: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(item.id, parentComm.id); }}
                                        style={{ fontSize: '12px', padding: '5px 8px' }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddComment(item.id, parentComm.id)}
                                        className="btn btn-sm btn-primary"
                                        style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}
                                      >
                                        등록
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                          {/* New Top-Level Comment Input */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="댓글을 입력하세요..."
                              value={commentInputs[item.id] || ''}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(item.id); }}
                              style={{ fontSize: '12.5px', padding: '6px 10px', borderRadius: '8px' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleAddComment(item.id)}
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', fontWeight: '700' }}
                            >
                              <Send size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
  };

  // Render Poll Comments & Threaded Replies
  const renderPollCommentsSection = (poll: ClubPollItem) => {
    const comments = poll.comments || [];
    const isOpen = openPollComments[poll.id] ?? false;

    return (
      <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
        {/* Actions bar: Comment Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setOpenPollComments(prev => ({ ...prev, [poll.id]: !isOpen }))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: isOpen ? '#6366f1' : '#64748b',
              fontSize: '12px',
              fontWeight: '700'
            }}
          >
            <MessageCircle size={14} />
            <span>댓글 {comments.length}개</span>
          </button>
        </div>

        {/* Comment Thread Content */}
        {isOpen && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {comments
              .filter(c => !c.parent_comment_id)
              .map((parentComm) => {
                const replies = comments.filter(r => r.parent_comment_id === parentComm.id);
                return (
                  <div key={parentComm.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      background: '#f8fafc',
                      padding: '8px 10px',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                            {parentComm.user_name}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {parentComm.user_cell}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {formatThreadsTime(new Date(parentComm.created_at).getTime())}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#334155', marginTop: '3px' }}>
                          {parentComm.content}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setReplyingToId(replyingToId === parentComm.id ? null : parentComm.id)}
                          style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}
                        >
                          답글
                        </button>
                        {(parentComm.user_id === user.id || canModerateComments) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(parentComm.id)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {replies.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          marginLeft: '20px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          background: '#f1f5f9',
                          padding: '6px 10px',
                          borderRadius: '8px'
                        }}
                      >
                        <CornerDownRight size={12} color="#94a3b8" style={{ marginTop: '3px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b' }}>
                              {r.user_name}
                            </span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{r.user_cell}</span>
                            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                              {formatThreadsTime(new Date(r.created_at).getTime())}
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '2px' }}>
                            {r.content}
                          </div>
                        </div>
                        {(r.user_id === user.id || canModerateComments) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(r.id)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}

                    {replyingToId === parentComm.id && (
                      <div style={{ marginLeft: '20px', display: 'flex', gap: '6px', marginTop: '2px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={`${parentComm.user_name}님에게 답글 작성...`}
                          value={replyInputs[parentComm.id] || ''}
                          onChange={(e) => setReplyInputs(prev => ({ ...prev, [parentComm.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddPollComment(poll.id, parentComm.id); }}
                          style={{ fontSize: '12px', padding: '5px 8px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddPollComment(poll.id, parentComm.id)}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}
                        >
                          등록
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="투표에 댓글 남기기..."
                value={pollCommentInputs[poll.id] || ''}
                onChange={(e) => setPollCommentInputs(prev => ({ ...prev, [poll.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPollComment(poll.id); }}
                style={{ fontSize: '12.5px', padding: '6px 10px', borderRadius: '8px' }}
              />
              <button
                type="button"
                onClick={() => handleAddPollComment(poll.id)}
                className="btn btn-sm btn-primary"
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', fontWeight: '700' }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Closed Poll in Feed Stream
  const renderClosedPollCard = (poll: ClubPollItem, isLast: boolean) => {
    const totalVotes = poll.total_votes || 0;
    const canDelete = isHost;

    return (
      <article
        key={`poll-${poll.id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
          background: '#fafafa',
          position: 'relative',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Left Column: Poll Icon Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Vote size={18} />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  {poll.creator_name}
                </span>
                <span style={{
                  background: '#e2e8f0',
                  color: '#475569',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Vote size={10} />
                  <span>마감된 투표</span>
                </span>
                <span style={{ color: '#cbd5e1', fontSize: '11px' }}>·</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {formatThreadsTime(new Date(poll.created_at || poll.end_date).getTime())}
                </span>
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDeletePoll(poll.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="투표 삭제 (총무/관리자)"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            {/* Poll Title & Description */}
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '4px 0 2px' }}>
              {poll.title}
            </h3>
            {poll.description && (
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px', lineHeight: 1.45 }}>
                {poll.description}
              </p>
            )}

            {/* Results Container */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px',
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '6px',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '11.5px',
                color: '#64748b',
                fontWeight: '700'
              }}>
                <span>📊 최종 투표 결과</span>
                <span>총 참여 성도: {totalVotes}명</span>
              </div>

              {poll.options.map((opt) => {
                const count = poll.option_counts?.[opt] || 0;
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isMyConfirmedVote = poll.my_vote === opt;

                return (
                  <div
                    key={opt}
                    style={{
                      position: 'relative',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isMyConfirmedVote ? '1.5px solid #818cf8' : '1px solid #e2e8f0',
                      background: isMyConfirmedVote ? '#f5f3ff' : '#f8fafc',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Percentage Fill Bar */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${percent}%`,
                      background: isMyConfirmedVote ? 'rgba(99, 102, 241, 0.18)' : 'rgba(203, 213, 225, 0.5)',
                      zIndex: 1,
                      transition: 'width 0.3s ease'
                    }} />

                    {/* Text row */}
                    <div style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: isMyConfirmedVote ? '800' : '600', color: '#1e293b' }}>
                          {opt}
                        </span>
                        {isMyConfirmedVote && (
                          <span style={{
                            fontSize: '10px',
                            background: '#6366f1',
                            color: '#ffffff',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: '800'
                          }}>
                            ✓ 내 투표
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                        {percent}% ({count}명)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Poll Comments Section */}
            {renderPollCommentsSection(poll)}
          </div>
        </div>
      </article>
    );
  };

  // Render Past Schedule in Feed Stream
  const renderPastScheduleCard = (sched: ClubScheduleItem, isLast: boolean) => {
    let attendees: any[] = [];
    try {
      attendees = Array.isArray(sched.attendees) ? sched.attendees : JSON.parse(sched.attendees || '[]');
    } catch {
      attendees = [];
    }
    const isAttending = attendees.some((a: any) => samePerson(a, user));
    const canDelete = isHost;

    return (
      <article
        key={`sched-${sched.id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
          background: '#fafafa',
          position: 'relative',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Left Column: Schedule Icon Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Calendar size={18} />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  {sched.creator_name || '모영'}
                </span>
                <span style={{
                  background: '#e2e8f0',
                  color: '#475569',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Calendar size={10} />
                  <span>지난 모임 일정</span>
                </span>
                <span style={{ color: '#cbd5e1', fontSize: '11px' }}>·</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {sched.event_date}
                </span>
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDeleteSchedule(sched.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="일정 삭제 (총무/관리자)"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            {/* Schedule Title */}
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '4px 0 8px' }}>
              {sched.title}
            </h3>

            {/* Past Schedule Details Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Event details grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                fontSize: '12px',
                color: '#334155'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} color="#64748b" />
                  <span style={{ fontWeight: '600' }}>{sched.event_date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} color="#64748b" />
                  <span>{sched.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={13} color="#64748b" />
                  <span>{sched.fee_info || '무료'}</span>
                </div>
              </div>

              {/* Attendees */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                    참석자 ({attendees.length}명):
                  </span>
                  {isAttending && (
                    <span style={{
                      fontSize: '10.5px',
                      background: '#ecfdf5',
                      color: '#065f46',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: '800',
                      border: '1px solid #a7f3d0'
                    }}>
                      ✓ 참석함
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {attendees.length > 0 ? (
                    attendees.map((a: any, idx: number) => (
                      <span
                        key={a.userId || idx}
                        style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          fontSize: '11px',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontWeight: '600',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        {a.user_name || a.userName} {(a.user_cell || a.cellName) ? `(${a.user_cell || a.cellName})` : ''}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                      참석 인원이 기록되지 않았습니다.
                    </span>
                  )}
                </div>
              </div>

              {/* Schedule Comments Section */}
              {renderScheduleCommentsSection(sched)}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderScheduleCommentsSection = (sched: ClubScheduleItem) => {
    const comments = sched.comments || [];
    const isOpen = openScheduleComments[sched.id] ?? false;

    return (
      <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
        {/* Actions bar: Reactions + Comment Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleToggleReaction('schedule', sched.id, 'heart')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: sched.my_reactions?.includes('heart') ? '#ef4444' : '#64748b',
                fontSize: '11.5px',
                fontWeight: '600'
              }}
            >
              <Heart
                size={14}
                color={sched.my_reactions?.includes('heart') ? '#ef4444' : '#64748b'}
                fill={sched.my_reactions?.includes('heart') ? '#ef4444' : 'none'}
              />
              <span>{sched.reactions?.heart || 0}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOpenScheduleComments(prev => ({ ...prev, [sched.id]: !isOpen }))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: isOpen ? '#2563eb' : '#64748b',
              fontSize: '12px',
              fontWeight: '700'
            }}
          >
            <MessageCircle size={14} />
            <span>댓글 {comments.length}개</span>
          </button>
        </div>

        {/* Comment Thread Content */}
        {isOpen && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {comments
              .filter(c => !c.parent_comment_id)
              .map((parentComm) => {
                const replies = comments.filter(r => r.parent_comment_id === parentComm.id);
                return (
                  <div key={parentComm.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      background: '#f8fafc',
                      padding: '8px 10px',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                            {parentComm.user_name}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {parentComm.user_cell}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {formatThreadsTime(new Date(parentComm.created_at).getTime())}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#334155', marginTop: '3px' }}>
                          {parentComm.content}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setReplyingToId(replyingToId === parentComm.id ? null : parentComm.id)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}
                        >
                          답글
                        </button>
                        {(parentComm.user_id === user.id || canModerateComments) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(parentComm.id)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {replies.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          marginLeft: '20px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          background: '#f1f5f9',
                          padding: '6px 10px',
                          borderRadius: '8px'
                        }}
                      >
                        <CornerDownRight size={12} color="#94a3b8" style={{ marginTop: '3px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1e293b' }}>
                              {r.user_name}
                            </span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{r.user_cell}</span>
                            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                              {formatThreadsTime(new Date(r.created_at).getTime())}
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '2px' }}>
                            {r.content}
                          </div>
                        </div>
                        {(r.user_id === user.id || canModerateComments) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(r.id)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}

                    {replyingToId === parentComm.id && (
                      <div style={{ marginLeft: '20px', display: 'flex', gap: '6px', marginTop: '2px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={`${parentComm.user_name}님에게 답글 작성...`}
                          value={replyInputs[parentComm.id] || ''}
                          onChange={(e) => setReplyInputs(prev => ({ ...prev, [parentComm.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddScheduleComment(sched.id, parentComm.id); }}
                          style={{ fontSize: '12px', padding: '5px 8px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddScheduleComment(sched.id, parentComm.id)}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}
                        >
                          등록
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="모임에 댓글 남기기..."
                value={scheduleCommentInputs[sched.id] || ''}
                onChange={(e) => setScheduleCommentInputs(prev => ({ ...prev, [sched.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddScheduleComment(sched.id); }}
                style={{ fontSize: '12.5px', padding: '6px 10px', borderRadius: '8px' }}
              />
              <button
                type="button"
                onClick={() => handleAddScheduleComment(sched.id)}
                className="btn btn-sm btn-primary"
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', fontWeight: '700' }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%', background: '#ffffff' }}>
      {/* Full-screen loading overlay for posting, deleting, voting, attending */}
      {(isSubmittingPost || isDeleting) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          backdropFilter: 'blur(3px)'
        }}>
          <Loader2 className="animate-spin" size={40} style={{ marginBottom: '16px' }} />
          <div style={{ fontSize: '16px', fontWeight: '800' }}>
            {isSubmittingPost ? '게시 중입니다...' :
             isDeleting ? '삭제 중입니다...' :
             isSubmittingVote !== null ? '투표 반영 중입니다...' :
             attendingScheduleId !== null ? '참석 처리 중입니다...' : '처리 중입니다...'}
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {actionMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0f172a',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '30px',
          fontSize: '13px',
          fontWeight: '700',
          zIndex: 9999,
          boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✨</span>
          <span>{actionMessage}</span>
        </div>
      )}

      {actionError && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ef4444',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '30px',
          fontSize: '13px',
          fontWeight: '700',
          zIndex: 9999,
          boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>{actionError}</span>
        </div>
      )}

      {/* Top Header: Clean Threads-style bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #f1f5f9',
        background: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onBackToLobby}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#0f172a',
              borderRadius: '8px',
              transition: 'background-color 0.15s'
            }}
            title="뒤로가기 (로비로 이동)"
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 2px 5px rgba(37, 99, 235, 0.2)',
            flexShrink: 0,
            cursor: 'default',
            userSelect: 'none'
          }}>
            {club.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.3px', cursor: 'default' }}>
                {club.name}
              </h1>
              {user.role === 'head_admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditName(club.name);
                    setShowEditModal(true);
                  }}
                  className="btn btn-sm"
                  style={{
                    padding: '2px 7px',
                    fontSize: '11px',
                    color: '#2563eb',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    fontWeight: '700'
                  }}
                  title="모영 이름 수정 (전체 관리자)"
                >
                  <Edit3 size={11} />
                  수정
                </button>
              )}
              {/* 전체 관리자 및 서버 관리자 전용 누적 조회수 (일반 성도, 총무, 미디어 관리자에게는 일체 노출되지 않음) */}
              {(user.role === 'head_admin' || user.role === 'server_admin') && (
                <button
                  type="button"
                  onClick={() => setShowAnalyticsModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dcfce7';
                    e.currentTarget.style.borderColor = '#86efac';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f0fdf4';
                    e.currentTarget.style.borderColor = '#bbf7d0';
                  }}
                  title="[관리자 전용] 클릭하여 일별/주별/월별 상세 접속 통계를 확인합니다."
                >
                  <Eye size={12} color="#16a34a" />
                  <span>누적 조회수</span>
                  <strong style={{ color: '#166534', fontWeight: '800' }}>
                    {(club.view_count || 0).toLocaleString()}회
                  </strong>
                  <span style={{ fontSize: '9.5px', background: '#bbf7d0', color: '#14532d', padding: '1px 4px', borderRadius: '4px', marginLeft: '2px' }}>
                    통계분석 📊
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Handover Vote button (only if manager & pending votes exist) */}
        {isManager && (
          <button
            type="button"
            onClick={() => setShowHandoverModal(true)}
            className="btn btn-sm"
            style={{
              background: '#fef08a',
              color: '#854d0e',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '8px',
              fontWeight: '700'
            }}
          >
            총무 안건{data?.handoverVotes?.length ? ` (${data.handoverVotes.length})` : ''}
          </button>
        )}
      </div>

      {/* Threads Stream Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', background: '#ffffff' }}>

        {/* 1. New Post Composer (Always at the very top of feed) */}
        {isHost && (
          <div style={{
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '800',
                flexShrink: 0,
                boxShadow: '0 2px 5px rgba(37, 99, 235, 0.2)'
              }}>
                {user.name.slice(0, 1)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>{user.name}</span>
                  <span style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    letterSpacing: '0.2px'
                  }}>
                    {isManager ? '총무' : user.role === 'server_admin' ? '서버 관리자' : '전체 관리자'}
                  </span>
                </div>

                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="새로운 스레드 시작하기... (공지, 모임 나눔)"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  style={{
                    resize: 'none',
                    fontSize: '13.5px',
                    border: 'none',
                    padding: '2px 0',
                    boxShadow: 'none',
                    background: 'transparent',
                    width: '100%'
                  }}
                />
              </div>
            </div>



            {/* Composer Controls: Photo + Modal popup triggers for Poll & Schedule */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '10px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Photo upload from Explorer */}


                {/* Create Poll Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setShowPollModal(true)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '11.5px',
                    padding: '5px 11px',
                    background: '#f5f3ff',
                    color: '#6366f1',
                    border: '1px solid #c7d2fe',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Vote size={13} />
                  <span>투표</span>
                </button>

                {/* Create Schedule Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setShowSchedModal(true)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '11.5px',
                    padding: '5px 11px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Calendar size={13} />
                  <span>일정</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCreatePost}
                disabled={isSubmittingPost || (!postContent.trim())}
                className="btn btn-sm btn-primary"
                style={{
                  padding: '5px 20px',
                  borderRadius: '20px',
                  fontWeight: '800',
                  fontSize: '12.5px'
                }}
              >
                {isSubmittingPost ? '게시 중...' : '게시'}
              </button>
            </div>
          </div>
        )}

        {/* 2. Pinned Notices & Posts */}
        {pinnedPosts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {pinnedPosts.map((item, index) => renderPostItem(item, index === pinnedPosts.length - 1 && topActiveItems.length === 0))}
          </div>
        )}

        {/* 3. Combined Ongoing/Active Items (진행 중인 모임과 투표가 상단으로 가되, 마감/일정 임박한 것들이 위에 있게 정렬) */}
        {topActiveItems.length > 0 && (
          <div style={{ padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topActiveItems.map((item) => {
              if (item.itemType === 'active_poll') {
                const poll = item.poll;
                const totalVotes = poll.total_votes || 0;
                const hasVoted = Boolean(poll.my_vote);
                const currentChoice = selectedVoteOption[poll.id] !== undefined ? selectedVoteOption[poll.id] : (poll.my_vote || '');

                return (
                  <div
                    key={`active-poll-${poll.id}`}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #e0e7ff',
                      borderLeft: '5px solid #6366f1',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      boxShadow: '0 3px 10px rgba(99, 102, 241, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {/* Poll Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Vote size={12} />
                            <span>진행 중인 투표</span>
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            마감: {poll.end_date.replace('T', ' ')}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0' }}>
                          {poll.title}
                        </h3>
                        {poll.description && (
                          <p style={{ fontSize: '12.5px', color: '#475569', margin: '4px 0 0' }}>
                            {poll.description}
                          </p>
                        )}
                      </div>

                      {isHost && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleClosePoll(poll.id)}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', flexShrink: 0 }}
                          >
                            마감하기
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePoll(poll.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                            title="투표 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Poll Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {poll.options.map((opt) => {
                        const count = poll.option_counts?.[opt] || 0;
                        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const isSelected = currentChoice === opt;
                        const isMyConfirmedVote = poll.my_vote === opt;

                        return (
                          <div
                            key={opt}
                            onClick={() => setSelectedVoteOption(prev => ({ ...prev, [poll.id]: opt }))}
                            style={{
                              position: 'relative',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: isSelected ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                              background: isSelected ? '#f5f3ff' : '#f8fafc',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Live Percentage Bar */}
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${percent}%`,
                              background: isMyConfirmedVote ? 'rgba(99, 102, 241, 0.22)' : 'rgba(226, 232, 240, 0.7)',
                              zIndex: 1,
                              transition: 'width 0.3s ease'
                            }} />

                            {/* Content Row */}
                            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  border: isSelected ? '5px solid #6366f1' : '2px solid #cbd5e1',
                                  background: '#ffffff',
                                  boxSizing: 'border-box'
                                }} />
                                <span style={{ fontSize: '13px', fontWeight: isSelected ? '800' : '600', color: '#1e293b' }}>
                                  {opt}
                                </span>
                                {isMyConfirmedVote && (
                                  <span style={{ fontSize: '10px', background: '#6366f1', color: '#ffffff', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                    내 투표
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                                {percent}% ({count}명)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vote Confirmation Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        총 참여 성도: <strong>{totalVotes}명</strong> · {poll.creator_name} 개설
                      </span>
                      <button
                        type="button"
                        onClick={() => handleVoteSubmit(poll.id)}
                        disabled={isSubmittingVote === poll.id || !currentChoice || (hasVoted && currentChoice === poll.my_vote)}
                        className="btn btn-sm btn-primary"
                        style={{
                          padding: '5px 16px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '800',
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                        }}
                      >
                        {isSubmittingVote === poll.id ? '투표 중...' : hasVoted ? (currentChoice !== poll.my_vote ? '투표 변경 확인' : '투표 완료') : '투표 확인'}
                      </button>
                    </div>

                    {/* Poll Comments Section */}
                    {renderPollCommentsSection(poll)}
                  </div>
                );
              } else {
                const sched = item.schedule;
                let attendees: any[] = [];
                try {
                  attendees = Array.isArray(sched.attendees) ? sched.attendees : JSON.parse(sched.attendees || '[]');
                } catch {
                  attendees = [];
                }
                const isAttending = attendees.some((a: any) => 
                  samePerson(a, user)
                );

                return (
                  <div
                    key={`active-sched-${sched.id}`}
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #d1fae5',
                      borderLeft: '5px solid #10b981',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      boxShadow: '0 3px 10px rgba(16, 185, 129, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {/* Schedule Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <span style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginBottom: '4px'
                        }}>
                          <Calendar size={12} />
                          <span>다가오는 모임 일정</span>
                        </span>
                        <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: '#064e3b', margin: '2px 0 0' }}>
                          {sched.title}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleAttendance(sched.id)}
                          className={isAttending ? 'btn btn-sm btn-outline-danger' : 'btn btn-sm btn-primary'}
                          style={{
                            fontSize: '11.5px',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: isAttending ? '#fef2f2' : '#10b981',
                            color: isAttending ? '#dc2626' : '#ffffff',
                            border: isAttending ? '1.5px solid #f87171' : 'none',
                            cursor: 'pointer',
                            boxShadow: isAttending ? '0 1px 3px rgba(220, 38, 38, 0.1)' : '0 1px 3px rgba(16, 185, 129, 0.2)'
                          }}
                          disabled={attendingScheduleId === sched.id}
                        >
                          {attendingScheduleId === sched.id ? (
                            <>
                              <Loader2 size={14} className="spin animate-spin" />
                              <span>{isAttending ? '취소 중...' : '신청 중...'}</span>
                            </>
                          ) : isAttending ? (
                            '❌ 참석 취소'
                          ) : (
                            '🙋‍♂️ 참석 신청'
                          )}
                        </button>

                        {isHost && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(sched.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            title="일정 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Schedule Info Details */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '6px',
                      background: '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#334155'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} color="#10b981" />
                        <span style={{ fontWeight: '700' }}>{sched.event_date}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} color="#ef4444" />
                        <span>{sched.location}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DollarSign size={13} color="#f59e0b" />
                        <span>{sched.fee_info || '무료'}</span>
                      </div>
                    </div>

                    {/* Attendees List */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        참석자 ({attendees.length}명):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {attendees.length > 0 ? (
                          attendees.map((a: any, idx: number) => (
                            <span
                              key={a.userId || idx}
                              style={{
                                background: '#ecfdf5',
                                color: '#065f46',
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: '10px',
                                fontWeight: '700',
                                border: '1px solid #a7f3d0'
                              }}
                            >
                              {a.user_name || a.userName} {(a.user_cell || a.cellName) ? `(${a.user_cell || a.cellName})` : ''}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            아직 참석자가 없습니다. 첫 번째로 참석을 신청해보세요!
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Schedule Comments Section */}
                    {renderScheduleCommentsSection(sched)}
                  </div>
                );
              }
            })}
          </div>
        )}



        {/* 5. Threads Stream: List of Posts */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          background: '#ffffff'
        }}>
          {pinnedPosts.length === 0 && feedTimeline.length === 0 ? (
            <div style={{
              margin: 'auto',
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--color-text-muted)',
              fontSize: '13px'
            }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧵</div>
              <div style={{ fontWeight: '800', color: 'var(--color-text-main)', fontSize: '15.5px' }}>
                #{club.name} 스레드 피드에 오신 것을 환영합니다!
              </div>
              <div style={{ marginTop: '4px', fontSize: '12.5px' }}>
                {isHost ? '상단의 새 스레드 작성창에서 첫 나눔을 공유해보세요.' : '아직 등록된 스레드가 없습니다.'}
              </div>
            </div>
          ) : (
            visibleTimeline.map((item, index) => {
              const isLast = index === visibleTimeline.length - 1;
              if (item.itemType === 'post') {
                return renderPostItem(item.post, isLast);
              } else if (item.itemType === 'closed_poll') {
                return renderClosedPollCard(item.poll, isLast);
              } else if (item.itemType === 'past_schedule') {
                return renderPastScheduleCard(item.schedule, isLast);
              }
              return null;
            })
          )}

          {/* 10-Item Pagination: Load More Button & Infinite Scroll Sentinel */}
          {hasMoreFeed && (
            <div
              ref={loadMoreRef}
              style={{
                padding: '24px 16px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                borderTop: '1px solid #f1f5f9',
                background: '#fafafa'
              }}
            >
              <button
                type="button"
                onClick={handleLoadMoreFeed}
                disabled={isLoadingMore}
                className="btn btn-secondary"
                style={{
                  padding: '9px 24px',
                  borderRadius: '30px',
                  fontSize: '13px',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155'
                }}
              >
                {isLoadingMore ? (
                  <span>⏳ 이전 글 10개 불러오는 중...</span>
                ) : (
                  <>
                    <span>⬇</span>
                    <span>이전 글 10개 더보기</span>
                  </>
                )}
              </button>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                스크롤을 내리면 자동으로 10개씩 이어집니다
              </span>
            </div>
          )}

          {/* Feed Completion Marker */}
          {!hasMoreFeed && feedTimeline.length > 0 && (
            <div style={{
              padding: '36px 16px 48px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              <div style={{ width: '36px', height: '1.5px', background: '#e2e8f0', marginBottom: '8px' }} />
              <span>둔산제일교회 {club.name} 스레드</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>모든 새로운 스레드를 확인했습니다</span>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: CREATE POLL MODAL (Popup Modal) */}
      {showPollModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Vote size={18} color="#6366f1" />
                📊 신규 투표 개설
              </h3>
              <button onClick={() => setShowPollModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">투표 제목</label>
                <input
                  type="text"
                  className="form-input"
                  value={pollTitle}
                  onChange={(e) => setPollTitle(e.target.value)}
                  placeholder="예: 이번 주 정기 모임 참석 여부 조사"
                  required
                />
              </div>

              <div>
                <label className="form-label">투표 설명 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  value={pollDesc}
                  onChange={(e) => setPollDesc(e.target.value)}
                  placeholder="예: 모임 장소 예약을 위한 사전 투표입니다"
                />
              </div>

              <div>
                <label className="form-label">선택지 목록 (최소 2개)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[idx] = e.target.value;
                          setPollOptions(updated);
                        }}
                        placeholder={`선택지 ${idx + 1}`}
                        required
                        style={{ fontSize: '13px' }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="btn btn-sm btn-secondary"
                    style={{ alignSelf: 'flex-start', fontSize: '11.5px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} />
                    선택지 추가
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">투표 마감 일시</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={pollEndDate}
                  onChange={(e) => setPollEndDate(e.target.value)}
                  required
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPollModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#6366f1' }}>
                  투표 개설하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE SCHEDULE MODAL (Popup Modal) */}
      {showSchedModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={18} color="#10b981" />
                📅 새 모임 일정 등록
              </h3>
              <button onClick={() => setShowSchedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">모임명</label>
                <input
                  type="text"
                  className="form-input"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="예: 9월 정기 풋살 친선 경기"
                  required
                />
              </div>

              <div>
                <label className="form-label">모임 날짜</label>
                <input
                  type="date"
                  className="form-input"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">모임 시간</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="time"
                    className="form-input"
                    value={schedStartTime}
                    onChange={(e) => setSchedStartTime(e.target.value)}
                    required
                  />
                  <span style={{ fontWeight: '600', color: 'var(--color-text-light)' }}>~</span>
                  <input
                    type="time"
                    className="form-input"
                    value={schedEndTime}
                    onChange={(e) => setSchedEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">모임 장소</label>
                <input
                  type="text"
                  className="form-input"
                  value={schedLocation}
                  onChange={(e) => setSchedLocation(e.target.value)}
                  placeholder="예: 둔산 풋살파크 2구장"
                  required
                />
              </div>

              <div>
                <label className="form-label">회비 / 참가비</label>
                <input
                  type="text"
                  className="form-input"
                  value={schedFee}
                  onChange={(e) => setSchedFee(e.target.value)}
                  placeholder="예: 10,000원 (구장 대여비)"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSchedModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }}>
                  일정 등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT CLUB INFO (Head Admin only) */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                ✏️ 모영 이름 및 아이콘 수정 (전체 관리자)
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClubInfo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label">아이콘</label>
                  <select
                    className="form-select"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    style={{ fontSize: '18px', textAlign: 'center' }}
                  >
                    {['⚽', '🏸', '🎳', '📚', '🎸', '☕', '🏕️', '📸', '🏊', '🎾', '🏃', '🎨'].map(em => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">모영 이름</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="예: 풋살 모영"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  이름 수정 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      {lightboxPhoto && (
        <div
          className="modal-overlay"
          onClick={() => setLightboxPhoto(null)}
          style={{ cursor: 'zoom-out' }}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            <img
              src={lightboxPhoto}
              alt="사진 확대"
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 'var(--radius-md)', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {/* MODAL 5: MANAGER HANDOVER & AGREEMENT MODAL (총무 자율 협의) */}
      {showHandoverModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '480px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Handshake size={18} color="var(--color-primary)" />
                  모영 총무 자율 위임 및 협의
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                  모영 총무는 1~3명까지 유지 가능하며, 현직 총무 2명(1명이면 본인)의 찬성으로 반영됩니다.
                </p>
              </div>
              <button onClick={() => setShowHandoverModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Current Managers List */}
            <div style={{ background: 'var(--color-bg)', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)' }}>
                현재 총무 ({managers.length}/3명):
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {managers.map(m => (
                  <span
                    key={m}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontWeight: '700',
                      border: '1px solid #bfdbfe'
                    }}
                  >
                    👑 {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Active Handover Proposals */}
            {data?.handoverVotes && data.handoverVotes.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#b45309', marginBottom: '8px' }}>
                  ⚡ 현재 진행 중인 총무 안건
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.handoverVotes.map(vote => (
                    <div
                      key={vote.id}
                      style={{
                        background: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                          {vote.action_type === 'appoint' ? '✨ 신임 총무 추가' : '👋 총무 해임'} : <strong>{vote.target_user_name}</strong>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px' }}>
                          발의: {vote.proposer_name} · 찬성 ({vote.agreed_user_ids.length}/{Math.min(2, managers.length)}명)
                        </div>
                      </div>

                      {isManager && (
                        <button
                          type="button"
                          onClick={() => handleAgreeHandover(vote.id)}
                          disabled={vote.has_agreed}
                          className={vote.has_agreed ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-primary'}
                          style={{ fontSize: '11.5px', padding: '5px 12px' }}
                        >
                          {vote.has_agreed ? '찬성 완료' : '동의 (찬성)'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Propose New Action */}
            <form onSubmit={handleProposeHandover} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-text-main)', margin: '4px 0 0 0' }}>
                ➕ 새로운 총무 안건 발의
              </h4>

              {/* Action Type Select */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setHandoverActionType('appoint');
                    setHandoverTargetUserId(null);
                  }}
                  className={handoverActionType === 'appoint' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary'}
                  style={{ flex: 1, padding: '7px' }}
                  disabled={managers.length >= 3}
                >
                  신임 총무 추가 (최대 3인)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHandoverActionType('dismiss');
                    setHandoverTargetUserId(null);
                  }}
                  className={handoverActionType === 'dismiss' ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-secondary'}
                  style={{ flex: 1, padding: '7px' }}
                  disabled={managers.length <= 1}
                >
                  총무 사임/해임 (최소 1인)
                </button>
              </div>

              {/* Target Selection */}
              {handoverActionType === 'appoint' ? (
                <div>
                  <label className="form-label">교회 성도 검색 및 선택</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="성도 이름 또는 셀 검색..."
                    value={handoverSearch}
                    onChange={(e) => setHandoverSearch(e.target.value)}
                    style={{ marginBottom: '6px' }}
                  />
                  <div style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '4px'
                  }}>
                    {(data?.churchMembers || [])
                      .filter(m => !managerIds(club).includes(String(m.id)))
                      .filter(m => !handoverSearch || m.name.includes(handoverSearch) || m.cell_name.includes(handoverSearch))
                      .map(m => (
                        <div
                          key={m.id}
                          onClick={() => setHandoverTargetUserId(m.id)}
                          style={{
                            padding: '6px 10px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: handoverTargetUserId === m.id ? '#eff6ff' : 'transparent',
                            color: handoverTargetUserId === m.id ? '#1d4ed8' : 'var(--color-text-main)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12.5px'
                          }}
                        >
                          <span style={{ fontWeight: '700' }}>{m.name}</span>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>{m.cell_name}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="form-label">해임할 현직 총무 선택</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(data?.churchMembers || [])
                      .filter(m => managerIds(club).includes(String(m.id)))
                      .map(m => (
                        <div
                          key={m.id}
                          onClick={() => setHandoverTargetUserId(m.id)}
                          style={{
                            padding: '8px 10px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: handoverTargetUserId === m.id ? '#fef2f2' : 'transparent',
                            color: handoverTargetUserId === m.id ? '#dc2626' : 'var(--color-text-main)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12.5px'
                          }}
                        >
                          <span style={{ fontWeight: '700' }}>👑 {m.name}</span>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>{m.cell_name}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowHandoverModal(false)}>
                  닫기
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!handoverTargetUserId || (handoverActionType === 'appoint' && managers.length >= 3) || (handoverActionType === 'dismiss' && managers.length <= 1)}
                >
                  안건 발의하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Club View Analytics Modal (Head Admin & Server Admin Only) */}
      {showAnalyticsModal && (
        <ClubAnalyticsModal
          initialClubId={clubId}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}
    </div>
  );
};
