import React, { useState, useEffect } from 'react';
import { User, Club, ClubDetailData, ClubPollItem, ClubPostItem, ClubScheduleItem, ClubPhotoItem, ClubCommentItem, ManagerHandoverVoteItem, MemberItem } from '../types';
import { 
  ArrowLeft, Edit3, Vote, MessageSquare, Calendar, Image as ImageIcon, 
  Plus, Check, X, Trash2, MapPin, DollarSign, Clock, Users,
  Send, Sparkles, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  CornerDownRight, ThumbsUp, Flame, Heart, Smile, UserCheck, UserMinus, Settings, Handshake
} from 'lucide-react';

interface ClubDetailPageProps {
  clubId: number;
  user: User;
  initialTab?: 'polls' | 'posts' | 'schedules' | 'photos';
  onBackToLobby: () => void;
}

export const ClubDetailPage: React.FC<ClubDetailPageProps> = ({
  clubId,
  user,
  initialTab = 'polls',
  onBackToLobby,
}) => {
  const [data, setData] = useState<ClubDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<'polls' | 'posts' | 'schedules' | 'photos'>(initialTab);
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
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [replyingToId, setReplyingToId] = useState<number | null>(null);

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

  // Photo Modal & Lightbox
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
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
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: postContent, image_url: postImageUrl }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setPostContent('');
      setPostImageUrl('');
      loadClubData();
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
      loadClubData();
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

  // 5. Photo Handlers
  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl.trim()) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image_url: photoUrl, caption: photoCaption }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      flash(resData.message);
      setShowPhotoModal(false);
      setPhotoUrl('');
      setPhotoCaption('');
      loadClubData();
    } catch (err: any) {
      flashErr(err.message);
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('이 사진을 앨범에서 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/photos/${photoId}`, {
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

      {/* Tab Navigation (4 Tabs) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '4px',
        gap: '4px'
      }}>
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
          onClick={() => setActiveTab('posts')}
          style={{
            background: activeTab === 'posts' ? 'white' : 'transparent',
            color: activeTab === 'posts' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: activeTab === 'posts' ? 'var(--shadow-sm)' : 'none',
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
          나눔 ({posts.length})
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
          일정 ({schedules.length})
        </button>

        <button
          className="btn btn-sm"
          onClick={() => setActiveTab('photos')}
          style={{
            background: activeTab === 'photos' ? 'white' : 'transparent',
            color: activeTab === 'photos' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: activeTab === 'photos' ? 'var(--shadow-sm)' : 'none',
            fontWeight: '700',
            padding: '9px 4px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px'
          }}
        >
          <ImageIcon size={15} />
          앨범 ({photos.length})
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
      {/* TAB 2: COMMUNITY POSTS / FEED (나눔 & 소통)               */}
      {/* ======================================================== */}
      {activeTab === 'posts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Write Box */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px' }}>
              💬 모영 성도들과 나눔 글 작성하기
            </h3>
            <form onSubmit={handleCreatePost}>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder={`[${user.name}] 성도님, 모임 소감이나 나누고 싶은 이야기를 자유롭게 적어주세요.`}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                required
                style={{ fontSize: '13px', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="사진 이미지 URL (선택 사항)"
                  value={postImageUrl}
                  onChange={(e) => setPostImageUrl(e.target.value)}
                  style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '13px' }}>
                  <Send size={14} />
                  글 올리기
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {posts.length > 0 ? (
              posts.map((post) => (
                <div key={post.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--color-primary-light)',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {post.user_name.slice(0, 1)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                            {post.user_name}
                          </span>
                          <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', background: '#f1f5f9', color: '#475569' }}>
                            {post.user_cell}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                          {new Date(post.created_at).toLocaleDateString('ko-KR')} {new Date(post.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {(post.user_id === user.id || isManager) && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="btn btn-sm"
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-light)', padding: '4px' }}
                        title="글 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: '13.5px', color: 'var(--color-text-main)', lineHeight: 1.6, whiteSpace: 'pre-line', margin: '4px 0 0 0' }}>
                    {post.content}
                  </p>

                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="첨부 이미지"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '260px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-md)',
                        marginTop: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setLightboxPhoto(post.image_url!)}
                    />
                  )}

                  {/* Reaction Bar & Comments Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                    paddingTop: '8px',
                    marginTop: '4px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    {/* Emoji Reaction Buttons */}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {[
                        { emoji: 'amen', label: '🙏 아멘' },
                        { emoji: 'heart', label: '❤️ 은혜' },
                        { emoji: 'like', label: '👍 좋아요' },
                        { emoji: 'fire', label: '🔥 파이팅' },
                      ].map(({ emoji, label }) => {
                        const count = post.reactions ? (post.reactions[emoji] || 0) : 0;
                        const isReacted = post.my_reactions?.includes(emoji);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction('post', post.id, emoji)}
                            style={{
                              background: isReacted ? '#eff6ff' : '#f8fafc',
                              color: isReacted ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              border: isReacted ? '1px solid var(--color-primary)' : '1px solid #e2e8f0',
                              borderRadius: '16px',
                              padding: '3px 9px',
                              fontSize: '11.5px',
                              fontWeight: isReacted ? '700' : '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>{label}</span>
                            {count > 0 && <span style={{ fontWeight: '700' }}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Comments Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 6px'
                      }}
                    >
                      <MessageSquare size={13} />
                      <span>댓글 {post.comments ? post.comments.length : 0}개</span>
                      {openComments[post.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Comments Section (Expandable) */}
                  {openComments[post.id] && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '6px',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      {/* Comments List */}
                      {post.comments && post.comments.length > 0 ? (
                        post.comments
                          .filter(c => !c.parent_comment_id)
                          .map(parentComm => {
                            const replies = post.comments?.filter(r => r.parent_comment_id === parentComm.id) || [];
                            return (
                              <div key={parentComm.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {/* Top-Level Comment */}
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  background: 'white',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid #f1f5f9'
                                }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-main)' }}>
                                        {parentComm.user_name}
                                      </span>
                                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                                        {parentComm.user_cell}
                                      </span>
                                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                        {new Date(parentComm.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: '12.5px', margin: '2px 0 0 0', color: '#1e293b', lineHeight: 1.4 }}>
                                      {parentComm.content}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                                      <button
                                        type="button"
                                        onClick={() => setReplyingToId(replyingToId === parentComm.id ? null : parentComm.id)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: 'var(--color-primary)',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          padding: 0,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        답글 달기
                                      </button>
                                    </div>
                                  </div>

                                  {(parentComm.user_id === user.id || isManager) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(parentComm.id)}
                                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                      title="댓글 삭제"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>

                                {/* Nested Replies */}
                                {replies.map(reply => (
                                  <div
                                    key={reply.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'flex-start',
                                      marginLeft: '18px',
                                      background: '#f1f5f9',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      borderLeft: '2px solid var(--color-primary)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <CornerDownRight size={11} color="var(--color-primary)" />
                                        <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--color-text-main)' }}>
                                          {reply.user_name}
                                        </span>
                                        <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                                          {reply.user_cell}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: '12px', margin: '2px 0 0 15px', color: '#1e293b', lineHeight: 1.4 }}>
                                        {reply.content}
                                      </p>
                                    </div>
                                    {(reply.user_id === user.id || isManager) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(reply.id)}
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                        title="답글 삭제"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {/* Reply Input Box (when replyingToId === parentComm.id) */}
                                {replyingToId === parentComm.id && (
                                  <div style={{ display: 'flex', gap: '6px', marginLeft: '18px', marginTop: '2px' }}>
                                    <input
                                      type="text"
                                      className="form-input"
                                      placeholder={`@${parentComm.user_name} 님에게 답글 작성...`}
                                      value={replyInputs[parentComm.id] || ''}
                                      onChange={(e) => setReplyInputs({ ...replyInputs, [parentComm.id]: e.target.value })}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id, parentComm.id); }}
                                      style={{ flex: 1, fontSize: '12px', padding: '5px 8px' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddComment(post.id, parentComm.id)}
                                      className="btn btn-primary"
                                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                                    >
                                      등록
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '6px 0' }}>
                          아직 작성된 댓글이 없습니다. 첫 댓글을 남겨보세요!
                        </div>
                      )}

                      {/* Top-Level Comment Input */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="댓글을 남겨 은혜와 응원을 전해주세요..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                          style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: 'white' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          등록
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                아직 등록된 나눔 글이 없습니다. 첫 번째 글을 남겨보세요!
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
      {/* TAB 4: PHOTOS (활동 앨범 & 갤러리)                        */}
      {/* ======================================================== */}
      {activeTab === 'photos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--color-text-muted)' }}>
              모영 활동 사진 ({photos.length}장)
            </span>
            <button
              onClick={() => setShowPhotoModal(true)}
              className="btn btn-primary"
              style={{ fontSize: '12.5px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Plus size={14} />
              사진 올리기
            </button>
          </div>

          {photos.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px'
            }}>
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: '8px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setLightboxPhoto(p.image_url)}
                >
                  <img
                    src={p.image_url}
                    alt={p.caption || '활동 사진'}
                    style={{
                      width: '100%',
                      height: '130px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                  {p.caption && (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-main)', fontWeight: '600', lineHeight: 1.3 }}>
                      {p.caption}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--color-text-light)' }}>
                    <span>{p.user_name}</span>
                    {(p.user_id === user.id || isManager) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(p.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px' }}
                        title="사진 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              아직 등록된 사진이 없습니다. 모임 현장 사진을 올려보세요! 📸
            </div>
          )}
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

      {/* ======================================================== */}
      {/* MODAL 4: PHOTO UPLOAD MODAL                              */}
      {/* ======================================================== */}
      {showPhotoModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                📸 활동 사진 올리기
              </h3>
              <button onClick={() => setShowPhotoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPhoto} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">이미지 URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  required
                />
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  💡 테스트용 빠른 선택:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {[
                    { label: '⚽ 축구', url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80' },
                    { label: '🏸 배드민턴', url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80' },
                    { label: '🎳 볼링', url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=800&q=80' },
                    { label: '📚 도서', url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80' },
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setPhotoUrl(item.url)}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '10.5px', padding: '2px 6px' }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">사진 설명 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 즐거웠던 경기 후 기념 샷!"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPhotoModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  사진 등록 완료
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

