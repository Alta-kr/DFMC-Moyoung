import React, { useState, useEffect } from 'react';
import { User, CellItem, PopupItem, Notice, Club, MemberItem } from '../types';
import { PopupModal } from '../components/PopupModal';
import { 
  Eye, Save, Trash2, Plus, ArrowLeft, RefreshCw,
  X, Search, Users, UserCheck, UserX, Megaphone, Sliders, Shield,
  ChevronDown, ChevronUp, Sparkles, ChevronRight
} from 'lucide-react';

interface HeadAdminPageProps {
  user: User | null;
  onBackToLobby: () => void;
}

export const HeadAdminPage: React.FC<HeadAdminPageProps> = ({ user, onBackToLobby }) => {
  const isMediaAdmin = user?.role === 'media_admin';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'cells' | 'welcome' | 'popup' | 'notices' | 'clubs' | 'media_admins'>(
    isMediaAdmin ? 'welcome' : 'cells'
  );

  // State for Lobby Welcome Message
  const [welcomeTagline, setWelcomeTagline] = useState('은혜와 교제가 넘치는 둔산제일교회 모영');
  const [welcomeMessage, setWelcomeMessage] = useState('이번 주에도 모영에서 기쁨의 교제 함께해요.');

  // State for Cells
  const [cells, setCells] = useState<CellItem[]>([]);
  const [newCellName, setNewCellName] = useState('');
  const [expandedCellId, setExpandedCellId] = useState<number | null>(null);

  // State for Popup
  const [popupTitle, setPopupTitle] = useState('');
  const [popupContent, setPopupContent] = useState('');
  const [popupImageUrl, setPopupImageUrl] = useState('');
  const [popupEndDate, setPopupEndDate] = useState('');
  const [popupIsActive, setPopupIsActive] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // State for Single Notice
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');

  // State for Clubs
  const [clubs, setClubs] = useState<Club[]>([]);
  const [newClubName, setNewClubName] = useState('');
  const [newClubIcon, setNewClubIcon] = useState('⚽');
  const [newClubManagers, setNewClubManagers] = useState('');

  // State for Media Admins
  const [mediaAdmins, setMediaAdmins] = useState<MemberItem[]>([]);
  const [mediaAdminSearch, setMediaAdminSearch] = useState('');

  // State for Cell Reorganization Modal
  const [showReorganizeModal, setShowReorganizeModal] = useState(false);
  const [reorganizeCellList, setReorganizeCellList] = useState<string[]>([]);

  // State for Manager Appointment Modal
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [selectedManagerNames, setSelectedManagerNames] = useState<string[]>([]);
  const [targetClubForManager, setTargetClubForManager] = useState<Club | null>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // Status feedback
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('dfmc_token');

  // Fetch all admin data
  const loadAdminData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [pRes, nRes, wRes] = await Promise.all([
        fetch('/api/head-admin/popup', { headers }),
        fetch('/api/head-admin/notices', { headers }),
        fetch('/api/head-admin/welcome', { headers }),
      ]);

      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.popup) {
          setPopupTitle(pData.popup.title || '');
          setPopupContent(pData.popup.content_text || '');
          setPopupImageUrl(pData.popup.image_url || '');
          setPopupEndDate(pData.popup.end_date ? pData.popup.end_date.slice(0, 16) : '');
          setPopupIsActive(!!pData.popup.is_active);
        }
      }

      if (nRes.ok) {
        const nData = await nRes.json();
        const noticeList: Notice[] = nData.notices || [];
        if (noticeList.length > 0) {
          setActiveNotice(noticeList[0]);
          setNoticeTitle(noticeList[0].title);
          setNoticeContent(noticeList[0].content);
        } else {
          setActiveNotice(null);
          setNoticeTitle('');
          setNoticeContent('');
        }
      }

      if (wRes.ok) {
        const wData = await wRes.json();
        if (wData.welcome) {
          setWelcomeTagline(wData.welcome.welcome_tagline || '');
          setWelcomeMessage(wData.welcome.welcome_message || '');
        }
      }

      // If full admin or server admin, fetch cells, clubs, media admins, members
      if (!isMediaAdmin) {
        const [cRes, clRes, maRes] = await Promise.all([
          fetch('/api/head-admin/cells', { headers }),
          fetch('/api/head-admin/clubs', { headers }),
          fetch('/api/head-admin/media-admins', { headers }),
        ]);

        if (cRes.ok) {
          const cData = await cRes.json();
          setCells(cData.cells || []);
        }
        if (clRes.ok) {
          const clData = await clRes.json();
          setClubs(clData.clubs || []);
        }
        if (maRes.ok) {
          const maData = await maRes.json();
          setMediaAdmins(maData.mediaAdmins || []);
        }
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    loadAdminData();
    if (!isMediaAdmin) {
      fetchMembers();
    }
  }, []);

  const flashMessage = (msg: string) => {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/head-admin/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  // --- 1. Cell Handlers ---
  const handleAddCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCellName.trim()) return;

    try {
      const res = await fetch('/api/head-admin/cells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newCellName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      flashMessage(data.message);
      setNewCellName('');
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCell = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('정말 이 셀을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/head-admin/cells/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      flashMessage(data.message);
      if (expandedCellId === id) setExpandedCellId(null);
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenReorganizeModal = () => {
    setReorganizeCellList(cells.map(c => c.name));
    setShowReorganizeModal(true);
  };

  const handleExecuteReorganize = async () => {
    const filtered = reorganizeCellList.map(c => c.trim()).filter(c => c.length > 0);
    if (filtered.length === 0) {
      setError('최소 1개 이상의 셀 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/head-admin/cells/reorganize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cellNames: filtered }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      flashMessage(data.message);
      setShowReorganizeModal(false);
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Moyoung Manager Handlers (Max 3) ---
  const handleOpenManagerModal = (club: Club | null) => {
    setTargetClubForManager(club);
    setMemberSearchTerm('');
    if (club) {
      const current = club.manager_names ? club.manager_names.split(',').map(s => s.trim()).filter(Boolean) : [];
      setSelectedManagerNames(current);
    } else {
      const current = newClubManagers ? newClubManagers.split(',').map(s => s.trim()).filter(Boolean) : [];
      setSelectedManagerNames(current);
    }
    if (members.length === 0) {
      fetchMembers();
    }
    setShowManagerModal(true);
  };

  const handleToggleManager = (name: string) => {
    if (selectedManagerNames.includes(name)) {
      setSelectedManagerNames(selectedManagerNames.filter(n => n !== name));
    } else {
      if (selectedManagerNames.length >= 3) {
        alert('총무는 모영당 최대 3명까지 선임할 수 있습니다.');
        return;
      }
      setSelectedManagerNames([...selectedManagerNames, name]);
    }
  };

  const handleSaveManagers = async () => {
    const joined = selectedManagerNames.join(', ');
    if (targetClubForManager) {
      try {
        const res = await fetch(`/api/head-admin/clubs/${targetClubForManager.id}/managers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ manager_names: joined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        flashMessage(`[${targetClubForManager.name}] 총무 명단이 업데이트되었습니다. (${selectedManagerNames.length}명)`);
        loadAdminData();
      } catch (err: any) {
        setError(err.message);
      }
    } else {
      setNewClubManagers(joined);
    }
    setShowManagerModal(false);
  };

  // --- 3. Popup Handlers ---
  const handleSavePopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!popupTitle || !popupEndDate) {
      setError('제목과 종료일시는 필수입니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/head-admin/popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: popupTitle,
          content_text: popupContent,
          image_url: popupImageUrl,
          end_date: popupEndDate,
          is_active: popupIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. Single Notice Handlers ---
  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setError('공지 제목과 내용을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/head-admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      flashMessage(data.message);
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!confirm('현재 등록된 교회 전체 공지를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch('/api/head-admin/notices', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashMessage(data.message);
      setActiveNotice(null);
      setNoticeTitle('');
      setNoticeContent('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- 5. Club Handlers ---
  const handleAddClub = async (e: React.FormEvent) => {
    e.preventDefault();
    const clubNameToSave = newClubName.trim().endsWith('모영')
      ? newClubName.trim()
      : `${newClubName.trim()} 모영`;

    try {
      const res = await fetch('/api/head-admin/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: clubNameToSave,
          icon: newClubIcon,
          manager_names: newClubManagers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      flashMessage(data.message);
      setNewClubName('');
      setNewClubManagers('');
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteClub = async (id: number, name: string) => {
    if (!confirm(`[${name}] 모영을 정말 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/head-admin/clubs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      flashMessage(data.message);
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- 6. Media Admin Handlers ---
  const handleToggleMediaAdmin = async (userId: number, action: 'appoint' | 'dismiss') => {
    try {
      const res = await fetch('/api/head-admin/media-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      flashMessage(data.message);
      loadAdminData();
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Banner (Simpler '관리', Zero Crown) */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        color: 'white',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', padding: '2px 8px' }}>
                {isMediaAdmin ? '미디어관리자 권한' : '전체 관리자 권한'}
              </span>
            </div>
            <h2 style={{ fontSize: '19px', fontWeight: '800', margin: 0 }}>
              관리
            </h2>
            <p style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '2px' }}>
              {isMediaAdmin ? '환영 문구, 팝업창 및 교회 전체 공지 전담 관리' : '셀 개편, 환영 문구, 팝업 및 공지, 모영 총괄, 미디어 관리자 선임'}
            </p>
          </div>
        </div>

        <button
          onClick={onBackToLobby}
          className="btn btn-sm"
          style={{ background: 'white', color: '#1e3a8a', fontSize: '12.5px', fontWeight: '700' }}
        >
          <ArrowLeft size={14} />
          로비로
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--color-success-light)',
          color: 'var(--color-success)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMediaAdmin ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
        background: 'var(--color-card-subtle)',
        padding: '4px',
        borderRadius: 'var(--radius-md)',
        gap: '4px'
      }}>
        {(isMediaAdmin ? [
          { id: 'welcome', label: '환영 문구' },
          { id: 'popup', label: '팝업 설정' },
          { id: 'notices', label: '전체 공지' },
        ] : [
          { id: 'cells', label: '셀 개편' },
          { id: 'welcome', label: '환영 문구' },
          { id: 'popup', label: '팝업 설정' },
          { id: 'notices', label: '전체 공지' },
          { id: 'clubs', label: '모영 총괄' },
          { id: 'media_admins', label: '미디어 관리자' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="btn btn-sm"
            style={{
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
              fontWeight: '700',
              padding: '8px 4px',
              fontSize: '12px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================== */}
      {/* Tab 1: Cell Management & Reorganization    */}
      {/* ========================================== */}
      {!isMediaAdmin && activeTab === 'cells' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Add Single Cell Form */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>
              단일 셀 추가
            </h3>
            <form onSubmit={handleAddCell} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="예: 3청년부 2셀"
                value={newCellName}
                onChange={(e) => setNewCellName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={16} />
                추가
              </button>
            </form>
          </div>

          {/* Existing Cells List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800' }}>
                  현재 등록된 셀 목록 ({cells.length}개)
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  셀을 클릭하면 해당 셀에 소속된 셀원 명단이 펼쳐집니다.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              {cells.map((cell, idx) => {
                const isExpanded = expandedCellId === cell.id;
                const cellMembers = members.filter(m => m.cell_name === cell.name);

                return (
                  <div
                    key={cell.id}
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      border: isExpanded ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: isExpanded ? '#f8fafc' : 'var(--color-bg)',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    {/* Clickable Cell Header */}
                    <div
                      onClick={() => setExpandedCellId(isExpanded ? null : cell.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--color-text-light)', fontWeight: '700', width: '22px' }}>
                          {idx + 1}.
                        </span>
                        <span style={{ fontWeight: '700', color: 'var(--color-text-main)', fontSize: '13.5px' }}>
                          {cell.name}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: isExpanded ? 'white' : 'var(--color-text-light)',
                          background: isExpanded ? 'var(--color-primary)' : '#f1f5f9',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontWeight: '600'
                        }}>
                          {cell.member_count ?? cellMembers.length}명
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11.5px', color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {isExpanded ? '접기' : '셀원 보기'}
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteCell(e, cell.id)}
                          className="btn btn-sm"
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                          title="셀 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Cell Members List */}
                    {isExpanded && (
                      <div style={{
                        padding: '10px 12px 12px',
                        borderTop: '1px solid #e2e8f0',
                        background: '#ffffff',
                      }}>
                        <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>
                          👥 [{cell.name}] 소속 셀원 ({cellMembers.length}명):
                        </div>

                        {cellMembers.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {cellMembers.map((m) => (
                              <div
                                key={m.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '5px 10px',
                                  background: '#f8fafc',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12px'
                                }}
                              >
                                <span style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: 'var(--color-primary-light)',
                                  color: 'var(--color-primary)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10.5px',
                                  fontWeight: '700'
                                }}>
                                  {m.name.slice(0, 1)}
                                </span>
                                <span style={{ fontWeight: '700', color: 'var(--color-text-main)' }}>{m.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>({m.username})</span>
                                {m.role === 'head_admin' && (
                                  <span className="badge badge-admin" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                    전체
                                  </span>
                                )}
                                {m.role === 'media_admin' && (
                                  <span className="badge" style={{ fontSize: '9.5px', padding: '1px 5px', background: '#ede9fe', color: '#6d28d9' }}>
                                    미디어
                                  </span>
                                )}
                                {m.is_leader && (
                                  <span className="badge" style={{ fontSize: '9.5px', padding: '1px 5px', background: '#dbeafe', color: '#1d4ed8' }}>
                                    총무
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '6px 0' }}>
                            현재 이 셀에 소속된 회원이 없습니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cell Reorganization Execution Card */}
          <div className="card" style={{ border: '1.5px solid #fed7aa', background: '#fffbeb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#fef3c7',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <RefreshCw size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#9a3412', marginBottom: '4px' }}>
                  교회 셀 개편 안내
                </h4>
                <p style={{ fontSize: '12px', color: '#7c2d12', lineHeight: 1.5 }}>
                  새 학기나 연말 셀 개편 시 클릭하세요. 새로운 셀 명단을 입력하고 개편을 실행하면 모든 일반 회원이 다음 로그인 시 새로운 소속 셀을 선택하게 됩니다.
                </p>

                <button
                  type="button"
                  onClick={handleOpenReorganizeModal}
                  className="btn btn-sm btn-danger"
                  style={{ marginTop: '12px', fontSize: '13px', fontWeight: '800', padding: '7px 16px' }}
                >
                  <RefreshCw size={14} />
                  셀 개편
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* Tab: Lobby Welcome Message Settings (로비 환영 문구 설정) */}
      {/* ========================================================= */}
      {activeTab === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Real-time Live Preview Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Sparkles size={16} color="var(--color-primary)" />
              <h3 style={{ fontSize: '15px', fontWeight: '800' }}>
                로비 화면 실시간 미리보기
              </h3>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              color: 'white',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>
                  <Sparkles size={14} color="#fde047" />
                  <span>{welcomeTagline || '은혜와 교제가 넘치는 둔산제일교회 모영'}</span>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '800' }}>
                  환영합니다, 홍길동님! 🙏
                </h2>
                <p style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
                  소속 셀: <strong>1청년부 1셀</strong> | {welcomeMessage || '이번 주에도 모영에서 기쁨의 교제 함께해요.'}
                </p>
              </div>
              <div style={{
                position: 'absolute',
                right: '-20px',
                bottom: '-30px',
                width: '120px',
                height: '120px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
              }} />
            </div>
          </div>

          {/* Edit Form */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>
              로비 환영 문구 편집
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              모든 회원이 로비에 접속했을 때 최상단 배너에 표시될 슬로건과 교제 안내 문구를 변경합니다.
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!welcomeTagline.trim() || !welcomeMessage.trim()) {
                setError('상단 슬로건과 하단 교제 안내 문구를 모두 입력해주세요.');
                return;
              }
              setLoading(true);
              try {
                const res = await fetch('/api/head-admin/welcome', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({
                    welcome_tagline: welcomeTagline.trim(),
                    welcome_message: welcomeMessage.trim(),
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                flashMessage(data.message);
                loadAdminData();
              } catch (err: any) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }}>
              <div className="form-group">
                <label className="form-label">상단 슬로건 / 소제목</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 은혜와 교제가 넘치는 둔산제일교회 모영"
                  value={welcomeTagline}
                  onChange={(e) => setWelcomeTagline(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">하단 교제 안내 문구</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 이번 주에도 모영에서 기쁨의 교제 함께해요."
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                  ※ 회원 화면에서는 <code>소속 셀: [소속셀이름] | [입력하신 문구]</code> 형태로 조합되어 표시됩니다.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ padding: '9px 20px', fontWeight: '700' }}
                >
                  <Save size={16} />
                  {loading ? '저장 중...' : '환영 문구 저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Tab 2: Popup Modal Settings (팝업창 설정) */}
      {/* ========================================== */}
      {activeTab === 'popup' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800' }}>로비 팝업창 설정</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                로비 첫 접속 시 띄울 팝업창 (단 1개 운영)
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={popupIsActive}
                onChange={(e) => setPopupIsActive(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              팝업 활성화
            </label>
          </div>

          <form onSubmit={handleSavePopup}>
            <div className="form-group">
              <label className="form-label">팝업 제목</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 2026 전교인 한마음 체육대회 안내"
                value={popupTitle}
                onChange={(e) => setPopupTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">팝업 내용 (선택 - 사진에 문구가 포함된 경우 생략 가능)</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="팝업 본문 내용 (선택 사항 - 사진에 문구가 있는 경우 생략 가능)"
                value={popupContent}
                onChange={(e) => setPopupContent(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ margin: 0 }}>이미지 URL (선택)</label>
                <button
                  type="button"
                  onClick={() => setPopupImageUrl('https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80')}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: 'pointer' }}
                >
                  샘플 이미지 채우기
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="https://..."
                value={popupImageUrl}
                onChange={(e) => setPopupImageUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">팝업 종료 일시 (이 시간 이후 자동 미노출)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={popupEndDate}
                onChange={(e) => setPopupEndDate(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPreviewModal(true)}
                style={{ flex: 1 }}
              >
                <Eye size={16} />
                미리보기
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ flex: 1 }}
              >
                <Save size={16} />
                {loading ? '저장 중...' : '설정 저장하기'}
              </button>
            </div>
          </form>

          {/* Popup Preview Modal */}
          {showPreviewModal && (
            <PopupModal
              popup={{
                id: 999,
                title: popupTitle || '미리보기 제목',
                content_text: popupContent || '',
                image_url: popupImageUrl,
                end_date: popupEndDate || new Date().toISOString(),
                is_active: 1,
              }}
              onClose={() => setShowPreviewModal(false)}
            />
          )}
        </div>
      )}

      {/* =================================================== */}
      {/* Tab 3: Whole Notice Management (교회 전체 단일 공지) */}
      {/* =================================================== */}
      {activeTab === 'notices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Current Active Notice Status */}
          <div className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={18} color="var(--color-primary)" />
                <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                  현재 로비에 노출 중인 공지
                </h3>
              </div>
              {activeNotice && (
                <button
                  type="button"
                  onClick={handleDeleteNotice}
                  className="btn btn-sm btn-danger"
                  style={{ fontSize: '11.5px', padding: '3px 8px' }}
                >
                  <Trash2 size={13} />
                  공지 내리기
                </button>
              )}
            </div>

            {activeNotice ? (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '6px' }}>
                  {activeNotice.title}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {activeNotice.content}
                </p>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-light)' }}>
                  작성자: {activeNotice.author_name} | {new Date(activeNotice.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', margin: 0 }}>
                현재 등록된 공지가 없습니다. 아래 양식에서 등록하시면 로비 최상단에 바로 노출됩니다.
              </p>
            )}
          </div>

          {/* Edit / Register Single Notice Form */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>
              교회 전체 공지 {activeNotice ? '수정 및 갱신' : '신규 등록'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
              💡 안내: 로비 상단에는 항상 <strong>1건의 교회 전체 공지</strong>만 노출됩니다. 새 공지를 저장하면 이전 공지는 자동으로 교체됩니다.
            </p>

            <form onSubmit={handleSaveNotice}>
              <div className="form-group">
                <label className="form-label">공지 제목</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 2026년 상반기 모영 활동 및 셀 교제 안내"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">공지 내용</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="교회 모든 성도 및 회원들이 볼 공지사항 내용을 작성해주세요."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '8px 18px' }}>
                  <Save size={15} />
                  {loading ? '저장 중...' : activeNotice ? '공지 수정 및 반영하기' : '공지 즉시 등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Tab 4: Moyoung Clubs & Managers Management */}
      {/* ========================================== */}
      {!isMediaAdmin && activeTab === 'clubs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Create Club Form */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>
              신규 모영 개설
            </h3>
            <form onSubmit={handleAddClub}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label">아이콘</label>
                  <select
                    className="form-select"
                    value={newClubIcon}
                    onChange={(e) => setNewClubIcon(e.target.value)}
                    style={{ fontSize: '18px', textAlign: 'center' }}
                  >
                    {['⚽', '🏸', '🎳', '📚', '🎸', '☕', '🏕️', '📸', '🏊', '🎾', '🏃', '🎨'].map((emoji) => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">모영 이름 ([종목] 모영)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="예: 탁구 모영, 등산 모영"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Manager Appointment Selection */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">모영 총무 선임 (최대 3명)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                  {newClubManagers ? (
                    newClubManagers.split(',').map((name) => name.trim()).filter(Boolean).map((mName) => (
                      <span key={mName} className="badge badge-primary" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {mName}
                        <X size={12} style={{ cursor: 'pointer' }} onClick={() => {
                          const updated = newClubManagers.split(',').map(s => s.trim()).filter(n => n !== mName).join(', ');
                          setNewClubManagers(updated);
                        }} />
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      아직 선임된 총무가 없습니다.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenManagerModal(null)}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '12px', fontWeight: '700' }}
                >
                  <Users size={14} />
                  전체 회원에서 총무 선임 / 해임 설정 (최대 3명)
                </button>
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '8px', padding: '10px' }}>
                <Plus size={16} />
                신규 모영 개설하기
              </button>
            </form>
          </div>

          {/* Existing Clubs List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0 }}>
                운영 중인 모영 목록 ({clubs.length}개)
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 14px 0' }}>
              💡 모영 카드를 클릭하면 현존하는 총무를 해임하거나 새로운 총무를 선임할 수 있습니다 (모영당 최대 3명).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {clubs.map((club) => {
                const currentManagers = club.manager_names
                  ? club.manager_names.split(',').map((s) => s.trim()).filter(Boolean)
                  : [];
                return (
                  <div
                    key={club.id}
                    onClick={() => handleOpenManagerModal(club)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg)',
                      border: '1.5px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      gap: '12px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-bg)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    title={`클릭하여 [${club.name}] 총무를 선임하거나 해임합니다.`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '28px', lineHeight: 1 }}>{club.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0 }}>
                            {club.name}
                          </h4>
                          <span style={{
                            fontSize: '11px',
                            color: currentManagers.length > 0 ? 'var(--color-primary)' : '#ef4444',
                            fontWeight: '700',
                            background: currentManagers.length > 0 ? 'var(--color-primary-light)' : '#fee2e2',
                            padding: '2px 8px',
                            borderRadius: '12px'
                          }}>
                            총무 {currentManagers.length} / 3명
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '5px' }}>
                          <span>현재 총무:</span>
                          {currentManagers.length > 0 ? (
                            currentManagers.map((mName) => (
                              <span
                                key={mName}
                                style={{
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  fontWeight: '700',
                                  padding: '1px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                }}
                              >
                                {mName}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: '600' }}>총무 미지정 (클릭하여 선임)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: 'var(--color-primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          background: 'white',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        총무 선임 / 해임 <ChevronRight size={14} />
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClub(club.id, club.name);
                        }}
                        className="btn btn-sm"
                        style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', padding: '6px', borderRadius: '6px' }}
                        title="모영 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================== */}
      {/* Tab 5: Media Admin Management (미디어 관리자 선임) */}
      {/* =================================================== */}
      {!isMediaAdmin && activeTab === 'media_admins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Information Box */}
          <div className="card" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Shield size={18} color="#7c3aed" />
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#5b21b6' }}>
                미디어 관리자 선임 및 역할
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: '#6d28d9', lineHeight: 1.5, margin: 0 }}>
              선임된 미디어 관리자는 <strong>[팝업 설정]</strong>과 <strong>[전체 공지]</strong>를 전담하여 운영하게 됩니다. (셀 개편이나 모영 총괄 등 다른 관리 권한은 제외됩니다.)
            </p>
          </div>

          {/* Appointed Media Admins Card */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>
              선임된 미디어 관리자 명단 ({mediaAdmins.length}명)
            </h3>

            {mediaAdmins.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mediaAdmins.map((ma) => (
                  <div
                    key={ma.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: '#ede9fe',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #ddd6fe'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#7c3aed',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: '700'
                      }}>
                        {ma.name.slice(0, 1)}
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#4c1d95' }}>
                          {ma.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6d28d9' }}>
                          소속: {ma.cell_name} (아이디: {ma.username})
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleMediaAdmin(ma.id, 'dismiss')}
                      className="btn btn-sm btn-danger"
                      style={{ fontSize: '11.5px', padding: '4px 10px' }}
                    >
                      <UserX size={13} />
                      권한 해임
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                현재 선임된 미디어 관리자가 없습니다. 아래 회원 목록에서 [선임] 해주세요.
              </p>
            )}
          </div>

          {/* Appoint New Media Admin from Members */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px' }}>
              회원 검색 및 미디어 관리자 선임
            </h3>

            {/* Search Box */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-light)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="회원 이름 또는 셀 검색 (예: 신민재, 1셀)"
                value={mediaAdminSearch}
                onChange={(e) => setMediaAdminSearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '12.5px' }}
              />
            </div>

            {/* Member List */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {members
                .filter(m => 
                  m.name.toLowerCase().includes(mediaAdminSearch.toLowerCase()) ||
                  m.cell_name.toLowerCase().includes(mediaAdminSearch.toLowerCase()) ||
                  m.username.toLowerCase().includes(mediaAdminSearch.toLowerCase())
                )
                .map((m) => {
                  const isAlready = mediaAdmins.some(ma => ma.id === m.id);
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: isAlready ? '#f5f3ff' : 'var(--color-bg)',
                        borderRadius: 'var(--radius-sm)',
                        border: isAlready ? '1px solid #ddd6fe' : '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isAlready ? '#7c3aed' : '#cbd5e1',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          {m.name.slice(0, 1)}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-main)' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                            {m.cell_name} ({m.username})
                          </div>
                        </div>
                      </div>

                      {isAlready ? (
                        <button
                          type="button"
                          onClick={() => handleToggleMediaAdmin(m.id, 'dismiss')}
                          className="btn btn-sm btn-danger"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          <UserX size={12} />
                          해임
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleMediaAdmin(m.id, 'appoint')}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '11px', padding: '3px 8px', background: '#7c3aed' }}
                        >
                          <UserCheck size={12} />
                          미디어관리자 선임
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. Cell Reorganization Modal (새 셀 명단 편집 팝업)         */}
      {/* ========================================================= */}
      {showReorganizeModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                  🔄 셀 개편 및 신규 셀 설정
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  새 학기/연말에 운영될 셀 명단을 수정하고 개편을 실행합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReorganizeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              padding: '10px 12px',
              background: '#fff7ed',
              border: '1px solid #ffedd5',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11.5px',
              color: '#9a3412',
              lineHeight: 1.4,
              marginBottom: '14px'
            }}>
              ⚠️ <strong>안내</strong>: 개편 실행 시 등록된 셀 명단이 일괄 갱신되며, 일반 회원들은 다음 접속 시 새로운 소속 셀을 선택하게 됩니다.
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', paddingRight: '4px' }}>
              {reorganizeCellList.map((cName, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--color-text-light)', width: '22px', textAlign: 'right' }}>
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    value={cName}
                    onChange={(e) => {
                      const updated = [...reorganizeCellList];
                      updated[idx] = e.target.value;
                      setReorganizeCellList(updated);
                    }}
                    placeholder="셀 이름 (예: 1청년부 1셀)"
                    style={{ flex: 1, padding: '7px 10px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = reorganizeCellList.filter((_, i) => i !== idx);
                      setReorganizeCellList(updated);
                    }}
                    className="btn btn-sm"
                    style={{ color: 'var(--color-danger)', padding: '6px', background: 'transparent', border: 'none' }}
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setReorganizeCellList([...reorganizeCellList, ''])}
              className="btn btn-sm btn-secondary"
              style={{ width: '100%', marginBottom: '16px', padding: '8px' }}
            >
              <Plus size={14} />
              셀 이름 칸 추가
            </button>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReorganizeModal(false)}
                style={{ fontSize: '12.5px' }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={loading}
                onClick={handleExecuteReorganize}
                style={{ fontSize: '12.5px', fontWeight: '800' }}
              >
                {loading ? '처리 중...' : '일괄 개편 실행 및 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* 2. Manager Selection Modal (총무 선임/해임 팝업 - 최대 3명)       */}
      {/* =============================================================== */}
      {showManagerModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '460px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0 }}>
                  👥 {targetClubForManager ? `[${targetClubForManager.name}]` : '신규 모영'} 총무 관리
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', margin: 0 }}>
                  현존하는 총무를 해임하거나, 새로운 성도를 총무로 선임할 수 있습니다 (최대 3명).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Currently Appointed Badges / Dismiss Section */}
            <div style={{
              padding: '12px 14px',
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid #e2e8f0',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e293b' }}>
                  현재 활동 중인 총무 ({selectedManagerNames.length}명 / 최대 3명)
                </span>
                <span style={{ fontSize: '11px', color: selectedManagerNames.length >= 3 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: '600' }}>
                  {selectedManagerNames.length >= 3 ? '정원 마감 (3/3명)' : `${3 - selectedManagerNames.length}명 추가 선임 가능`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedManagerNames.length > 0 ? (
                  selectedManagerNames.map(name => (
                    <div
                      key={name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        background: '#eff6ff',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#3b82f6',
                          color: 'white',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          {name.slice(0, 1)}
                        </span>
                        <strong style={{ fontSize: '13px', color: '#1e40af' }}>{name}</strong>
                        <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', background: '#dbeafe', color: '#1d4ed8' }}>
                          모영 총무
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleManager(name)}
                        className="btn btn-sm btn-danger"
                        style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}
                        title={`[${name}] 총무 즉시 해임`}
                      >
                        <UserX size={12} />
                        해임하기
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', padding: '6px 0', textAlign: 'center' }}>
                    현재 선임된 총무가 없습니다. 아래 전체 성도 명단에서 [선임]을 눌러주세요.
                  </div>
                )}
              </div>
            </div>

            {/* Member Search Box */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                새로운 총무 선임 (전체 성도 검색)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                총 {members.length}명
              </span>
            </div>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-light)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="회원 이름 또는 셀 검색 (예: 이주환, 1셀)"
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '12.5px' }}
              />
            </div>

            {/* All Members List */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {members
                .filter(m => 
                  m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                  m.cell_name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                  m.username.toLowerCase().includes(memberSearchTerm.toLowerCase())
                )
                .map((m) => {
                  const isAppointed = selectedManagerNames.includes(m.name);
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: isAppointed ? '#eff6ff' : 'var(--color-bg)',
                        borderRadius: 'var(--radius-sm)',
                        border: isAppointed ? '1px solid #bfdbfe' : '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isAppointed ? '#3b82f6' : '#cbd5e1',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          {m.name.slice(0, 1)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-main)' }}>
                              {m.name}
                            </span>
                            {isAppointed && (
                              <span className="badge" style={{ fontSize: '9.5px', padding: '1px 5px', background: '#dbeafe', color: '#1d4ed8' }}>
                                총무
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                            {m.cell_name} ({m.username})
                          </div>
                        </div>
                      </div>

                      {isAppointed ? (
                        <button
                          type="button"
                          onClick={() => handleToggleManager(m.name)}
                          className="btn btn-sm btn-danger"
                          style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '5px', fontWeight: '700' }}
                          title={`[${m.name}] 총무 해임`}
                        >
                          <UserX size={12} />
                          해임
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleManager(m.name)}
                          disabled={selectedManagerNames.length >= 3}
                          className="btn btn-sm btn-primary"
                          style={{
                            fontSize: '11px',
                            padding: '4px 9px',
                            borderRadius: '5px',
                            fontWeight: '700',
                            opacity: selectedManagerNames.length >= 3 ? 0.35 : 1,
                            cursor: selectedManagerNames.length >= 3 ? 'not-allowed' : 'pointer',
                          }}
                          title={selectedManagerNames.length >= 3 ? '총무는 최대 3명까지만 선임할 수 있습니다.' : `${m.name} 성도를 총무로 선임`}
                        >
                          <UserCheck size={12} />
                          선임
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowManagerModal(false)}
                style={{ fontSize: '12.5px' }}
              >
                닫기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveManagers}
                style={{ fontSize: '12.5px', fontWeight: '700', padding: '8px 16px' }}
              >
                총무 변경사항 저장 및 반영
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
