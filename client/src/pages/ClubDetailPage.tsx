import React, { useState, useEffect, useRef } from 'react';
import { User, Club, ClubDetailData, ClubPollItem, ClubPostItem, ClubScheduleItem, ClubPhotoItem, ClubCommentItem, ManagerHandoverVoteItem, MemberItem } from '../types';
import { 
  ArrowLeft, Edit3, Vote, MessageSquare, Calendar, Image as ImageIcon, 
  Plus, Check, X, Trash2, MapPin, DollarSign, Clock, Users,
  Send, Sparkles, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  CornerDownRight, ThumbsUp, Flame, Heart, Smile, UserCheck, UserMinus, Settings, Handshake,
  Pin, Megaphone, Lock
} from 'lucide-react';

interface ClubDetailPageProps {
  clubId: number;
  user: User;
  initialTab?: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos';
  onBackToLobby: () => void;
}

export const ClubDetailPage: React.FC<ClubDetailPageProps> = ({
  clubId,
  user,
  initialTab = 'talk',
  onBackToLobby,
}) => {
  const [data, setData] = useState<ClubDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<'talk' | 'polls' | 'posts' | 'schedules' | 'photos'>(
    initialTab === 'posts' ? 'talk' : initialTab
  );
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Edit Club Info Modal
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

  // Feed Post, Comments & Reactions
  const [postContent, setPostContent] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [isNoticePost, setIsNoticePost] = useState(false);
  const [showAttachImage, setShowAttachImage] = useState(false);
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [replyingToId, setReplyingToId] = useState<number | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 180);
  };

  // Handover Modal
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverActionType, setHandoverActionType] = useState<'appoint' | 'dismiss'>('appoint');
  const [handoverTargetUserId, setHandoverTargetUserId] = useState<number | null>(null);
  const [handoverSearch, setHandoverSearch] = useState('');


  // Schedule Modal
  const [showSchedModal, setShowSchedModal] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedLocation, setSchedLocation] = useState('');
  const [schedFee, setSchedFee] = useState('무료');

  // Photo Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const token = localStorage.getItem('dfmc_token');

  const flash = (msg: string) => {
    setActionMessage(msg);
    setActionError('');
    setTimeout(() => setActionMessage(''), 4000);
  };

  const flashErr = (err: string) => {
    setActionError(err);
    setTimeout(() => setActionError(''), 4000);
  };

  const loadClubData = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('모영 정보를 불러오지 못했습니다.');
      const d: ClubDetailData = await res.json();
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

  useEffect(() => {
    loadClubData();
  }, [clubId]);

  useEffect(() => {
    if (activeTab === 'talk' || activeTab === 'posts') {
      const timer = setTimeout(() => {
        scrollToBottom('auto');
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, data]);

  // 1. Update Club Info (Managers only)
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

  // 2. Poll Handlers
  const handleVote = async (pollId: number, option: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selected_option: option }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOpts = pollOptions.map(o => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      alert('선택지를 2개 이상 작성해주세요.');
      return;
    }
    try {
      const res = await fetch(`/api/clubs/${clubId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: pollTitle,
          description: pollDesc,
          options: cleanOpts,
          end_date: pollEndDate,
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
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleClosePoll = async (pollId: number) => {
    if (!confirm('이 투표를 마감하시겠습니까? 더 이상 참여나 변경이 불가능해집니다.')) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/polls/${pollId}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleDeletePoll = async (pollId: number) => {
    if (!confirm('정말 이 투표를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/polls/${pollId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // 3. Post (Feed) Handlers
  const handleCreatePost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!postContent.trim()) return;
    const finalContent = isNoticePost ? `[공지] ${postContent.trim()}` : postContent.trim();
    try {
      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: finalContent, image_url: postImageUrl }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setPostContent('');
      setPostImageUrl('');
      setIsNoticePost(false);
      setShowAttachImage(false);
      await loadClubData();
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('이 글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // Reactions Handler
  const handleToggleReaction = async (targetType: 'post' | 'comment', targetId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType, targetId, emoji }),
      });
      if (!res.ok) throw new Error('반응 처리에 실패했습니다.');
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // Comment Handlers
  const handleAddComment = async (postId: number, parentCommentId: number | null = null) => {
    const text = parentCommentId ? (replyInputs[parentCommentId] || '') : (commentInputs[postId] || '');
    if (!text.trim()) return;

    try {
      const res = await fetch(`/api/clubs/${clubId}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim(), parent_comment_id: parentCommentId }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);

      if (parentCommentId) {
        setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
        setReplyingToId(null);
      } else {
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      }
      setOpenComments(prev => ({ ...prev, [postId]: true }));
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  // Handover Handlers
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

  // 4. Schedule Handlers
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clubs/${clubId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: schedTitle,
          event_date: schedDate,
          location: schedLocation,
          fee_info: schedFee,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setShowSchedModal(false);
      setSchedTitle('');
      setSchedDate('');
      setSchedLocation('');
      setSchedFee('무료');
      await loadClubData();
      setTimeout(() => scrollToBottom('smooth'), 100);
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleToggleAttendance = async (schedId: number) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/schedules/${schedId}/attend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleDeleteSchedule = async (schedId: number) => {
    if (!confirm('모임 일정을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/schedules/${schedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      flash(resData.message);
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };



  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
        모영 정보 로딩 중...
      </div>
    );
  }

  if (!data) return null;

  const { club, isManager, polls, posts, schedules, photos } = data;
  const managers = (club.manager_names || '').split(',').map(s => s.trim()).filter(Boolean);
  const activePolls = polls.filter(p => !p.is_closed && !p.is_expired);
  const closedPolls = polls.filter(p => p.is_closed || p.is_expired);
  const isHost = isManager || user.role === 'head_admin' || user.role === 'server_admin';

  const timelineItems: Array<
    | { type: 'post'; id: number; timestamp: number; data: ClubPostItem }
    | { type: 'schedule'; id: number; timestamp: number; data: ClubScheduleItem }
  > = [
    ...posts.map((p) => ({
      type: 'post' as const,
      id: p.id,
      timestamp: new Date(p.created_at).getTime(),
      data: p,
    })),
    ...schedules.map((s) => ({
      type: 'schedule' as const,
      id: s.id,
      timestamp: s.created_at ? new Date(s.created_at).getTime() : new Date(s.event_date).getTime(),
      data: s,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const upcomingSchedule = schedules.find(s => new Date(s.event_date).getTime() >= Date.now()) || schedules[schedules.length - 1];
  const latestNotice = posts.find(p => p.content.startsWith('[공지]') || managers.includes(p.user_name));

  const formatDateDivider = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const formatMessageTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onBackToLobby}
          className="btn btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700' }}
        >
          <ArrowLeft size={16} />
          로비로 돌아가기
        </button>

        {isManager && (
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}
          >
            <Edit3 size={14} />
            모영 정보 수정 (총무)
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--color-success-light)',
          color: 'var(--color-success)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          {actionError}
        </div>
      )}

      {/* Hero Club Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
        color: 'white',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', position: 'relative', zIndex: 2 }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
            flexShrink: 0,
            border: '1.5px solid rgba(255, 255, 255, 0.35)'
          }}>
            {club.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px' }}>
                {club.name}
              </h1>
              {isManager && (
                <span className="badge" style={{ background: '#fde047', color: '#854d0e', fontSize: '11px', fontWeight: '800', padding: '2px 8px' }}>
                  총무 권한
                </span>
              )}
            </div>

            <p style={{ fontSize: '13.5px', opacity: 0.9, margin: '6px 0 10px 0', lineHeight: 1.5 }}>
              {club.description || '성도 간의 은혜로운 교제와 즐거운 활동을 함께하는 모임입니다.'}
            </p>

            {/* Manager list */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '12px', opacity: 0.95 }}>
              <span style={{ fontWeight: '600' }}>모영 총무:</span>
              {managers.length > 0 ? (
                managers.map(mName => (
                  <span
                    key={mName}
                    style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: '700',
                      fontSize: '11.5px'
                    }}
                  >
                    {mName}
                  </span>
                ))
              ) : (
                <span style={{ opacity: 0.75 }}>미지정</span>
              )}
            </div>

            {/* Manager Actions (소개 수정 & 총무 협의) */}
            {isManager && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="btn btn-sm"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(6px)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    fontSize: '12px',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderRadius: '8px'
                  }}
                >
                  <Edit3 size={13} />
                  모영 소개 수정
                </button>

                <button
                  type="button"
                  onClick={() => setShowHandoverModal(true)}
                  className="btn btn-sm"
                  style={{
                    background: data?.handoverVotes && data.handoverVotes.length > 0 ? '#fef08a' : 'rgba(255, 255, 255, 0.2)',
                    color: data?.handoverVotes && data.handoverVotes.length > 0 ? '#854d0e' : 'white',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    fontSize: '12px',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderRadius: '8px',
                    fontWeight: '700'
                  }}
                >
                  <Handshake size={13} />
                  총무 협의 및 위임
                  {data?.handoverVotes && data.handoverVotes.length > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '17px',
                      height: '17px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      marginLeft: '3px'
                    }}>
                      {data.handoverVotes.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation (3 Tabs: 모영톡, 투표, 일정) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '4px',
        gap: '4px'
      }}>
        <button
          className="btn btn-sm"
          onClick={() => setActiveTab('talk')}
          style={{
            background: activeTab === 'talk' || activeTab === 'posts' ? 'white' : 'transparent',
            color: activeTab === 'talk' || activeTab === 'posts' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: activeTab === 'talk' || activeTab === 'posts' ? 'var(--shadow-sm)' : 'none',
            fontWeight: '700',
            padding: '9px 4px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px'
          }}
        >
          <MessageSquare size={15} />
          모영톡 (공지·일정)
        </button>

        <button
          className="btn btn-sm"
          onClick={() => setActiveTab('polls')}
          style={{
            background: activeTab === 'polls' ? 'white' : 'transparent',
            color: activeTab === 'polls' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: activeTab === 'polls' ? 'var(--shadow-sm)' : 'none',
            fontWeight: '700',
            padding: '9px 4px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px'
          }}
        >
          <Vote size={15} />
          투표 ({activePolls.length})
        </button>

        <button
          className="btn btn-sm"
          onClick={() => setActiveTab('schedules')}
          style={{
            background: activeTab === 'schedules' ? 'white' : 'transparent',
            color: activeTab === 'schedules' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: activeTab === 'schedules' ? 'var(--shadow-sm)' : 'none',
            fontWeight: '700',
            padding: '9px 4px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px'
          }}
        >
          <Calendar size={15} />
          일정 목록 ({schedules.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: POLLS (투표 참여 & 개설)                           */}
      {/* ======================================================== */}
      {activeTab === 'polls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isManager && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPollModal(true)}
                className="btn btn-primary"
                style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                신규 투표 개설하기 (총무)
              </button>
            </div>
          )}

          {/* Active Polls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-text-main)', margin: '4px 0 2px' }}>
              🔥 진행 중인 투표 ({activePolls.length}건)
            </h3>

            {activePolls.length > 0 ? (
              activePolls.map((poll) => {
                const deadline = new Date(poll.end_date);
                return (
                  <div
                    key={poll.id}
                    className="card"
                    style={{
                      borderLeft: '4px solid var(--color-primary)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    {/* Poll Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                            참여 {poll.total_votes}명
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                            개설: {poll.creator_name}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0, lineHeight: 1.4 }}>
                          {poll.title}
                        </h4>
                        {poll.description && (
                          <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                            {poll.description}
                          </p>
                        )}
                      </div>

                      {/* Manager Controls */}
                      {isManager && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleClosePoll(poll.id)}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '11px', padding: '3px 7px' }}
                            title="투표 조기 마감"
                          >
                            마감
                          </button>
                          <button
                            onClick={() => handleDeletePoll(poll.id)}
                            className="btn btn-sm btn-danger"
                            style={{ fontSize: '11px', padding: '3px 7px' }}
                            title="투표 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Deadline */}
                    <div style={{ fontSize: '11.5px', color: '#b45309', background: '#fef3c7', padding: '5px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}>
                      <Clock size={13} />
                      <span>마감: {deadline.toLocaleDateString('ko-KR')} {deadline.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {poll.options.map((opt) => {
                        const count = poll.option_counts[opt] || 0;
                        const percentage = poll.total_votes > 0 ? Math.round((count / poll.total_votes) * 100) : 0;
                        const isSelected = poll.my_vote === opt;

                        return (
                          <div
                            key={opt}
                            onClick={() => handleVote(poll.id, opt)}
                            style={{
                              position: 'relative',
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-md)',
                              border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--color-bg)',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Background percentage fill */}
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${percentage}%`,
                              background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                              zIndex: 0,
                              transition: 'width 0.4s ease'
                            }} />

                            {/* Option content */}
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  border: isSelected ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '11px'
                                }}>
                                  {isSelected && <Check size={12} />}
                                </div>
                                <span style={{ fontSize: '13.5px', fontWeight: isSelected ? '800' : '600', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                                  {opt}
                                </span>
                                {isSelected && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '700' }}>
                                    (내 선택)
                                  </span>
                                )}
                              </div>

                              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)' }}>
                                {count}표 ({percentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                현재 진행 중인 투표가 없습니다.
              </div>
            )}
          </div>

          {/* Closed Polls Section */}
          {closedPolls.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                마감된 지난 투표 ({closedPolls.length}건)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {closedPolls.map((poll) => (
                  <div key={poll.id} className="card" style={{ padding: '12px 14px', background: '#f8fafc', opacity: 0.85 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--color-text-muted)' }}>
                        {poll.title}
                      </span>
                      <span className="badge" style={{ fontSize: '10.5px', background: '#e2e8f0', color: '#475569' }}>
                        마감됨 (총 {poll.total_votes}표)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: KAKAOTALK STYLE CHAT ROOM (모영톡 - 공지·일정·사진) */}
      {/* ======================================================== */}
      {(activeTab === 'talk' || activeTab === 'posts') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* KakaoTalk Chat Room Wrapper */}
          <div style={{
            background: '#b2c7d9',
            borderRadius: '16px',
            border: '1px solid #9fb3c4',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Top KakaoTalk Room Bar & Pinned Notice */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {/* Chat Title & Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{club.icon}</span>
                  <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#1e293b' }}>
                    {club.name} 모영톡
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontWeight: '600'
                  }}>
                    방장: {managers.join(', ') || '미지정'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isHost && (
                    <span className="badge badge-admin" style={{ fontSize: '10.5px' }}>
                      방장 권한
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    총 {timelineItems.length}건
                  </span>
                </div>
              </div>

              {/* KakaoTalk Pinned Announcement Banner */}
              {(upcomingSchedule || latestNotice) && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '14px', color: '#2563eb' }}>📢</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8' }}>
                        {upcomingSchedule ? '📌 다음 모임 일정' : '📌 모영 공지사항'}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#334155',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {upcomingSchedule 
                          ? `${upcomingSchedule.title} (${upcomingSchedule.event_date}) 📍 ${upcomingSchedule.location}`
                          : (latestNotice?.content || '')}
                      </div>
                    </div>
                  </div>

                  {upcomingSchedule && (
                    <button
                      type="button"
                      onClick={() => handleToggleAttendance(upcomingSchedule.id)}
                      className={upcomingSchedule.is_attending ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-primary'}
                      style={{ fontSize: '11px', padding: '3px 9px', whiteSpace: 'nowrap', borderRadius: '6px', fontWeight: '700' }}
                    >
                      {upcomingSchedule.is_attending ? '참석 완료' : '저도 참석 🙋‍♂️'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable Message Feed */}
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              style={{
                height: '500px',
                overflowY: 'auto',
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                scrollBehavior: 'smooth'
              }}
            >
              {timelineItems.length === 0 ? (
                <div style={{
                  margin: 'auto',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.8)',
                  padding: '20px 24px',
                  borderRadius: '16px',
                  color: '#475569',
                  fontSize: '13px'
                }}>
                  아직 등록된 공지나 일정이 없습니다.<br />
                  방장(총무)의 첫 번째 모임 공지를 기다려주세요! ⚽
                </div>
              ) : (
                timelineItems.map((item, index) => {
                  const showDivider = index === 0 || formatDateDivider(item.timestamp) !== formatDateDivider(timelineItems[index - 1].timestamp);

                  return (
                    <React.Fragment key={`${item.type}-${item.id}`}>
                      {/* Date Divider Pill */}
                      {showDivider && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                          <span style={{
                            background: 'rgba(0, 0, 0, 0.18)',
                            color: 'white',
                            fontSize: '11px',
                            padding: '3px 12px',
                            borderRadius: '12px',
                            fontWeight: '500',
                            backdropFilter: 'blur(2px)'
                          }}>
                            {formatDateDivider(item.timestamp)}
                          </span>
                        </div>
                      )}

                      {/* Item Type 1: Schedule Event Card */}
                      {item.type === 'schedule' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          {/* Profile Avatar */}
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: '#10b981',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: '800',
                            flexShrink: 0,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            📅
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '340px' }}>
                            {/* Author Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                                {item.data.creator_name}
                              </span>
                              <span style={{
                                background: '#fef08a',
                                color: '#854d0e',
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '1px 5px',
                                borderRadius: '4px'
                              }}>
                                👑 방장 공지
                              </span>
                            </div>

                            {/* Schedule Event Bubble Card */}
                            <div style={{
                              background: '#ffffff',
                              borderRadius: '4px 14px 14px 14px',
                              padding: '12px 14px',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                              border: '1px solid #d1fae5',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    color: '#059669',
                                    background: '#ecfdf5',
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                  }}>
                                    모임 일정 안내
                                  </span>
                                  <h4 style={{ fontSize: '14.5px', fontWeight: '800', color: '#065f46', margin: '4px 0 0 0' }}>
                                    {item.data.title}
                                  </h4>
                                </div>

                                {isHost && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSchedule(item.data.id)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                    title="일정 삭제"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>

                              {/* Details Grid */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                background: '#f8fafc',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#334155'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Clock size={13} color="#10b981" />
                                  <span style={{ fontWeight: '600' }}>{item.data.event_date}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <MapPin size={13} color="#ef4444" />
                                  <span>{item.data.location}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <DollarSign size={13} color="#f59e0b" />
                                  <span>{item.data.fee_info}</span>
                                </div>
                              </div>

                              {/* Attendees List */}
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                                  참석 성도 ({item.data.attendees.length}명):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {item.data.attendees.length > 0 ? (
                                    item.data.attendees.map(a => (
                                      <span
                                        key={a.userId}
                                        style={{
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          fontSize: '11px',
                                          padding: '1px 6px',
                                          borderRadius: '10px',
                                          fontWeight: '600'
                                        }}
                                      >
                                        {a.userName}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                      첫 번째로 참석을 신청해보세요!
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* One-click Attend Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(item.data.id)}
                                className={item.data.is_attending ? 'btn btn-secondary' : 'btn btn-primary'}
                                style={{
                                  padding: '7px 0',
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  width: '100%',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                {item.data.is_attending ? (
                                  <>
                                    <Check size={14} />
                                    참석 신청 완료 (취소하기)
                                  </>
                                ) : (
                                  <>
                                    <Users size={14} />
                                    저도 참석할게요! 🙋‍♂️
                                  </>
                                )}
                              </button>
                            </div>

                            <span style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.45)', marginLeft: '2px' }}>
                              {formatMessageTime(item.timestamp)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Item Type 2: Post / Notice / Photo Message */}
                      {item.type === 'post' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          {/* Profile Avatar */}
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: managers.includes(item.data.user_name) ? '#2563eb' : '#64748b',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12.5px',
                            fontWeight: '800',
                            flexShrink: 0,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            {item.data.user_name.slice(0, 1)}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '320px' }}>
                            {/* Author Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                                {item.data.user_name}
                              </span>
                              {managers.includes(item.data.user_name) ? (
                                <span style={{
                                  background: '#fef08a',
                                  color: '#854d0e',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '1px 5px',
                                  borderRadius: '4px'
                                }}>
                                  👑 총무 (방장)
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#64748b' }}>
                                  {item.data.user_cell}
                                </span>
                              )}
                            </div>

                            {/* Message Bubble Card */}
                            <div style={{
                              background: '#ffffff',
                              borderRadius: '4px 14px 14px 14px',
                              padding: '10px 12px',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                              border: item.data.content.startsWith('[공지]') ? '1.5px solid #93c5fd' : 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              {/* Notice tag if present */}
                              {item.data.content.startsWith('[공지]') && (
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  color: '#1d4ed8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <Megaphone size={12} />
                                  방장 공지사항
                                </div>
                              )}

                              {/* Text Content */}
                              <p style={{
                                fontSize: '13px',
                                color: '#1e293b',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-line',
                                margin: 0
                              }}>
                                {item.data.content.replace(/^\[공지\]\s*/, '')}
                              </p>

                              {/* Photo Attachment (if any) */}
                              {item.data.image_url && (
                                <img
                                  src={item.data.image_url}
                                  alt="공지 첨부 사진"
                                  onClick={() => setLightboxPhoto(item.data.image_url!)}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '220px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    border: '1px solid #e2e8f0'
                                  }}
                                />
                              )}

                              {/* Reactions & Comments Bar */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '4px',
                                paddingTop: '6px',
                                marginTop: '2px',
                                borderTop: '1px solid #f1f5f9'
                              }}>
                                {/* Emoji Reaction Stickers */}
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {[
                                    { emoji: 'amen', label: '🙏 아멘' },
                                    { emoji: 'heart', label: '❤️ 은혜' },
                                    { emoji: 'like', label: '👍 좋아요' },
                                    { emoji: 'fire', label: '🔥 파이팅' },
                                  ].map(({ emoji, label }) => {
                                    const count = item.data.reactions ? (item.data.reactions[emoji] || 0) : 0;
                                    const isReacted = item.data.my_reactions?.includes(emoji);
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleReaction('post', item.data.id, emoji)}
                                        style={{
                                          background: isReacted ? '#eff6ff' : '#f8fafc',
                                          color: isReacted ? 'var(--color-primary)' : '#64748b',
                                          border: isReacted ? '1px solid var(--color-primary)' : '1px solid #e2e8f0',
                                          borderRadius: '12px',
                                          padding: '2px 6px',
                                          fontSize: '11px',
                                          fontWeight: isReacted ? '700' : '500',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px'
                                        }}
                                      >
                                        <span>{label}</span>
                                        {count > 0 && <span style={{ fontWeight: '700' }}>{count}</span>}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Comments Accordion Button */}
                                <button
                                  type="button"
                                  onClick={() => setOpenComments(prev => ({ ...prev, [item.data.id]: !prev[item.data.id] }))}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#64748b',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 4px'
                                  }}
                                >
                                  <MessageSquare size={12} />
                                  <span>댓글 {item.data.comments ? item.data.comments.length : 0}</span>
                                  {openComments[item.data.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </button>
                              </div>

                              {/* Comments Section */}
                              {openComments[item.data.id] && (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                  marginTop: '4px',
                                  padding: '8px',
                                  background: '#f8fafc',
                                  borderRadius: '8px'
                                }}>
                                  {item.data.comments && item.data.comments.length > 0 ? (
                                    item.data.comments
                                      .filter(c => !c.parent_comment_id)
                                      .map(parentComm => {
                                        const replies = item.data.comments?.filter(r => r.parent_comment_id === parentComm.id) || [];
                                        return (
                                          <div key={parentComm.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{
                                              background: 'white',
                                              padding: '6px 8px',
                                              borderRadius: '6px',
                                              border: '1px solid #e2e8f0',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'flex-start'
                                            }}>
                                              <div>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>
                                                  {parentComm.user_name}
                                                </span>
                                                <span style={{ fontSize: '9.5px', color: '#94a3b8', marginLeft: '4px' }}>
                                                  ({parentComm.user_cell})
                                                </span>
                                                <p style={{ fontSize: '11.5px', color: '#334155', margin: '2px 0 0 0' }}>
                                                  {parentComm.content}
                                                </p>
                                              </div>
                                              {(parentComm.user_id === user.id || isHost) && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteComment(parentComm.id)}
                                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              )}
                                            </div>

                                            {/* Replies */}
                                            {replies.map(r => (
                                              <div key={r.id} style={{
                                                marginLeft: '14px',
                                                background: '#f1f5f9',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                justifyContent: 'space-between'
                                              }}>
                                                <div>
                                                  <span style={{ fontSize: '10.5px', fontWeight: '700' }}>↳ {r.user_name}</span>
                                                  <p style={{ fontSize: '11px', margin: 0 }}>{r.content}</p>
                                                </div>
                                                {(r.user_id === user.id || isHost) && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteComment(r.id)}
                                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                                  >
                                                    <Trash2 size={10} />
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })
                                  ) : (
                                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '4px 0' }}>
                                      댓글이 없습니다.
                                    </div>
                                  )}

                                  {/* Add Comment Input */}
                                  <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                    <input
                                      type="text"
                                      className="form-input"
                                      placeholder="댓글 입력..."
                                      value={commentInputs[item.data.id] || ''}
                                      onChange={(e) => setCommentInputs({ ...commentInputs, [item.data.id]: e.target.value })}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(item.data.id); }}
                                      style={{ flex: 1, fontSize: '11.5px', padding: '4px 8px', background: 'white' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddComment(item.data.id)}
                                      className="btn btn-primary"
                                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                                    >
                                      등록
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <span style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.45)', marginLeft: '2px' }}>
                              {formatMessageTime(item.timestamp)}
                            </span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Scroll-to-Bottom Floating Button */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                style={{
                  position: 'absolute',
                  bottom: isHost ? '110px' : '65px',
                  right: '16px',
                  background: 'white',
                  color: 'var(--color-primary)',
                  border: '1px solid #cbd5e1',
                  borderRadius: '20px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                <ChevronDown size={14} />
                최신 글로
              </button>
            )}

            {/* Bottom Input Area: Locked for Regular Members vs Controls for Room Master */}
            {!isHost ? (
              /* KakaoTalk Room Host Disabled Chat Bar */
              <div style={{
                padding: '14px 16px',
                background: '#d1d8e0',
                color: '#475569',
                borderTop: '1px solid #c0c9d3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '700'
              }}>
                <Lock size={16} color="#64748b" />
                <span>방장이 채팅을 금지했습니다. (공지 및 일정 확인 전용)</span>
              </div>
            ) : (
              /* Room Master Control & Input Bar */
              <div style={{
                background: 'white',
                borderTop: '1px solid #cbd5e1',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {/* Host Action Buttons */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowSchedModal(true)}
                    className="btn btn-sm btn-secondary"
                    style={{
                      fontSize: '11.5px',
                      padding: '4px 9px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0'
                    }}
                  >
                    <Calendar size={13} />
                    + 일정 등록
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAttachImage(!showAttachImage)}
                    className="btn btn-sm btn-secondary"
                    style={{
                      fontSize: '11.5px',
                      padding: '4px 9px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: showAttachImage ? '#eff6ff' : '#f8fafc',
                      color: showAttachImage ? 'var(--color-primary)' : 'var(--color-text-main)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    <ImageIcon size={13} />
                    + 사진 올리기
                  </button>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    color: '#2563eb',
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}>
                    <input
                      type="checkbox"
                      checked={isNoticePost}
                      onChange={(e) => setIsNoticePost(e.target.checked)}
                    />
                    📢 방장 공지로 등록
                  </label>
                </div>

                {/* Main Screen Photo Upload Box */}
                {showAttachImage && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                        📷 메인 화면 사진 올리기 (이미지 URL 입력)
                      </span>
                      <button
                        type="button"
                        onClick={() => { setShowAttachImage(false); setPostImageUrl(''); }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <input
                      type="text"
                      className="form-input"
                      placeholder="이미지 URL을 입력하세요 (https://...)"
                      value={postImageUrl}
                      onChange={(e) => setPostImageUrl(e.target.value)}
                      style={{ fontSize: '12px', padding: '5px 8px' }}
                    />

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>테스트 사진:</span>
                      {[
                        { label: '⚽ 풋살/축구', url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80' },
                        { label: '🏸 배드민턴', url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80' },
                        { label: '🎳 볼링', url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=800&q=80' },
                        { label: '👥 단체 모임', url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80' },
                      ].map(item => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setPostImageUrl(item.url)}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Input & Send Form */}
                <form onSubmit={handleCreatePost} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="[방장] 모영 성도들에게 전달할 공지나 일정을 입력하세요..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    required={!postImageUrl}
                    style={{ flex: 1, fontSize: '12.5px', padding: '7px 10px', minHeight: '44px', resize: 'none' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '700',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: '8px'
                    }}
                  >
                    <Send size={15} />
                    전송
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SCHEDULES (모임 일정 & 참석 확인)                  */}
      {/* ======================================================== */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isManager && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSchedModal(true)}
                className="btn btn-primary"
                style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                새 모임 일정 등록 (총무)
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {schedules.length > 0 ? (
              schedules.map((sched) => (
                <div
                  key={sched.id}
                  className="card"
                  style={{
                    borderLeft: '4px solid #10b981',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                        정기 / 번개 모임
                      </span>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-text-main)', margin: '4px 0 0 0' }}>
                        {sched.title}
                      </h4>
                    </div>

                    {isManager && (
                      <button
                        onClick={() => handleDeleteSchedule(sched.id)}
                        className="btn btn-sm btn-danger"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        title="일정 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Schedule Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      <Clock size={14} color="#10b981" />
                      <span>{sched.event_date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      <MapPin size={14} color="#ef4444" />
                      <span>{sched.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      <DollarSign size={14} color="#f59e0b" />
                      <span>{sched.fee_info}</span>
                    </div>
                  </div>

                  {/* Attendees List */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '6px' }}>
                      참석 예정 성도 ({sched.attendees.length}명):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {sched.attendees.length > 0 ? (
                        sched.attendees.map(a => (
                          <span
                            key={a.userId}
                            style={{
                              background: '#ecfdf5',
                              color: '#047857',
                              fontSize: '11.5px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              border: '1px solid #a7f3d0',
                              fontWeight: '600'
                            }}
                          >
                            {a.userName} ({a.cellName})
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '11.5px', color: 'var(--color-text-light)' }}>
                          아직 참석 신청자가 없습니다. 제일 먼저 참석해 보세요!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance Toggle Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      onClick={() => handleToggleAttendance(sched.id)}
                      className={sched.is_attending ? 'btn btn-secondary' : 'btn btn-primary'}
                      style={{
                        padding: '8px 18px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {sched.is_attending ? (
                        <>
                          <Check size={14} />
                          참석 신청 완료 (취소하기)
                        </>
                      ) : (
                        <>
                          <Users size={14} />
                          저도 참석할게요! 🙋‍♂️
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                등록된 모임 일정이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}



      {/* ======================================================== */}
      {/* MODAL 1: EDIT CLUB INFO (Managers only)                   */}
      {/* ======================================================== */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                ✏️ 모영 소개 및 이름 수정 (총무 전용)
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClubInfo} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">모영 소개 문구</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="모영 활동 내용, 모임 주기, 환영 인사 등을 작성해주세요."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  수정 내용 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATE POLL MODAL (Managers only)                */}
      {/* ======================================================== */}
      {showPollModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                🗳️ 신규 투표 개설 (총무 전용)
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
                  placeholder="예: 이번 주 토요일 참석 여부 조사"
                  value={pollTitle}
                  onChange={(e) => setPollTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">투표 설명 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 대관비 정산 및 유니폼 조끼 준비용"
                  value={pollDesc}
                  onChange={(e) => setPollDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">선택지 (최소 2개)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`선택지 ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[i] = e.target.value;
                          setPollOptions(updated);
                        }}
                        required
                        style={{ fontSize: '12.5px', padding: '6px 10px' }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                          className="btn btn-sm btn-danger"
                          style={{ padding: '6px' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="btn btn-sm btn-secondary"
                    style={{ marginTop: '6px', fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    + 선택지 추가
                  </button>
                )}
              </div>

              <div>
                <label className="form-label">투표 마감 일시</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={pollEndDate}
                  onChange={(e) => setPollEndDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPollModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  투표 개설 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: SCHEDULE MODAL (Managers only)                   */}
      {/* ======================================================== */}
      {showSchedModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                📅 새 모임 일정 등록 (총무 전용)
              </h3>
              <button onClick={() => setShowSchedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">모임 명칭</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 9월 4주차 주말 정기 모임"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">일시</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 2026-09-26 (토) 14:00 ~ 16:00"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">장소</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 대전 풋살파크 B구장 (둔산동)"
                  value={schedLocation}
                  onChange={(e) => setSchedLocation(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">회비 / 준비물</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 10,000원 (음료 제공 / 개인 운동복)"
                  value={schedFee}
                  onChange={(e) => setSchedFee(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSchedModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  일정 등록하기
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

      {/* ======================================================== */}
      {/* MODAL 5: MANAGER HANDOVER & AGREEMENT MODAL (총무 자율 협의) */}
      {/* ======================================================== */}
      {showHandoverModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '480px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Handshake size={18} color="var(--color-primary)" />
                  총무 자율 협의 및 위임
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', margin: '3px 0 0 0' }}>
                  모영당 최대 3명 체계 / 총무 2인 이상 동의 시 직분이 즉시 변경됩니다.
                </p>
              </div>
              <button onClick={() => setShowHandoverModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Current Managers List */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                현재 활동 중인 총무 ({managers.length}/3명)
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {managers.map(mName => (
                  <span
                    key={mName}
                    className="badge"
                    style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '11.5px', padding: '3px 8px', fontWeight: '700' }}
                  >
                    👑 {mName}
                  </span>
                ))}
              </div>
            </div>

            {/* Active Handover Proposals */}
            {data?.handoverVotes && data.handoverVotes.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#b45309', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={14} />
                  진행 중인 총무 동의 안건 ({data.handoverVotes.length}건)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.handoverVotes.map(vote => (
                    <div
                      key={vote.id}
                      style={{
                        padding: '12px',
                        background: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#92400e' }}>
                          {vote.target_user_name} 성도님 {vote.action_type === 'appoint' ? '새 총무 선임' : '총무 해임'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
                          발의: {vote.proposer_name} | 현재 동의: {vote.agreed_user_ids.length}/2명
                        </div>
                      </div>

                      {vote.has_agreed ? (
                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', padding: '3px 8px' }}>
                          <Check size={11} style={{ marginRight: '3px' }} />
                          동의 완료
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAgreeHandover(vote.id)}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                        >
                          <Check size={12} />
                          동의하기
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Propose New Action */}
            <form onSubmit={handleProposeHandover} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                새로운 총무 안건 발의
              </div>

              {/* Action Type Select */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setHandoverActionType('appoint'); setHandoverTargetUserId(null); }}
                  className="btn btn-sm"
                  style={{
                    background: handoverActionType === 'appoint' ? 'var(--color-primary)' : '#f1f5f9',
                    color: handoverActionType === 'appoint' ? 'white' : 'var(--color-text-muted)',
                    fontWeight: '700',
                    fontSize: '12px'
                  }}
                >
                  <UserCheck size={13} />
                  새 총무 선임
                </button>
                <button
                  type="button"
                  onClick={() => { setHandoverActionType('dismiss'); setHandoverTargetUserId(null); }}
                  className="btn btn-sm"
                  style={{
                    background: handoverActionType === 'dismiss' ? '#ef4444' : '#f1f5f9',
                    color: handoverActionType === 'dismiss' ? 'white' : 'var(--color-text-muted)',
                    fontWeight: '700',
                    fontSize: '12px'
                  }}
                >
                  <UserMinus size={13} />
                  기존 총무 해임
                </button>
              </div>

              {/* Target Selection */}
              {handoverActionType === 'appoint' ? (
                managers.length >= 3 ? (
                  <div style={{ fontSize: '12px', color: '#b45309', background: '#fffbeb', padding: '10px', borderRadius: '8px' }}>
                    ⚠️ 이미 최대 총무 인원(3명)이 가득 찼습니다. 새 총무를 모시려면 먼저 기존 총무 해임 안건을 발의해 주세요.
                  </div>
                ) : (
                  <div>
                    <label className="form-label">선임할 성도 선택</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="성도 이름 검색..."
                      value={handoverSearch}
                      onChange={(e) => setHandoverSearch(e.target.value)}
                      style={{ fontSize: '12px', marginBottom: '6px', padding: '6px 8px' }}
                    />
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px' }}>
                      {(data?.churchMembers || [])
                        .filter(m => !managers.includes(m.name))
                        .filter(m => !handoverSearch || m.name.includes(handoverSearch) || m.cell_name.includes(handoverSearch))
                        .map(m => (
                          <div
                            key={m.id}
                            onClick={() => setHandoverTargetUserId(m.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: handoverTargetUserId === m.id ? '#eff6ff' : 'transparent',
                              border: handoverTargetUserId === m.id ? '1px solid var(--color-primary)' : '1px solid transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '12px'
                            }}
                          >
                            <span style={{ fontWeight: '700' }}>{m.name}</span>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>{m.cell_name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              ) : (
                managers.length <= 1 ? (
                  <div style={{ fontSize: '12px', color: '#b45309', background: '#fffbeb', padding: '10px', borderRadius: '8px' }}>
                    ⚠️ 모영의 정상 운영을 위해 최소 1명의 총무가 유지되어야 합니다.
                  </div>
                ) : (
                  <div>
                    <label className="form-label">해임할 총무 선택</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(data?.churchMembers || [])
                        .filter(m => managers.includes(m.name))
                        .map(m => (
                          <div
                            key={m.id}
                            onClick={() => setHandoverTargetUserId(m.id)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: handoverTargetUserId === m.id ? '#fef2f2' : '#f8fafc',
                              border: handoverTargetUserId === m.id ? '1px solid #ef4444' : '1px solid #e2e8f0',
                              cursor: 'pointer',
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
                )
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
    </div>
  );
};

