import React, { useState, useEffect } from 'react';
import { User, CellItem, PopupItem, Notice, Club, MemberItem, TargetedWelcomeItem } from '../types';
import { PopupModal } from '../components/PopupModal';
import { ClubAnalyticsModal } from '../components/ClubAnalyticsModal';
import { 
  Eye, Save, Trash2, Plus, ArrowLeft, RefreshCw,
  X, Search, Users, UserCheck, UserX, Megaphone, Sliders, Shield,
  ChevronDown, ChevronUp, Sparkles, ChevronRight, Target, Check, Edit2,
  ToggleLeft, ToggleRight, UserPlus, Heart, BarChart3
} from 'lucide-react';

interface HeadAdminPageProps {
  user: User | null;
  onBackToLobby: () => void;
}

export const HeadAdminPage: React.FC<HeadAdminPageProps> = ({ user, onBackToLobby }) => {
  const isMediaAdmin = user?.role === 'media_admin';

  // State for Club Analytics Modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedAnalyticsClubId, setSelectedAnalyticsClubId] = useState<number | null>(null);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'cells' | 'welcome' | 'popup' | 'notices' | 'clubs' | 'media_admins'>(
    isMediaAdmin ? 'welcome' : 'cells'
  );

  // State for Lobby Welcome Message
  const [welcomeTagline, setWelcomeTagline] = useState('은혜와 교제가 넘치는 둔산제일교회 모영');
  const [welcomeMessage, setWelcomeMessage] = useState('이번 주에도 모영에서 기쁨의 교제 함께해요.');

  // State for Targeted Welcome Messages (새가족, 말씀양육 결단/수료 등 대상별 환영 문구)
  const [targetedWelcomes, setTargetedWelcomes] = useState<TargetedWelcomeItem[]>([]);
  const [showTargetedModal, setShowTargetedModal] = useState(false);
  const [editingTargetedId, setEditingTargetedId] = useState<number | null>(null);
  const [targetGroupName, setTargetGroupName] = useState('');
  const [targetWelcomeTagline, setTargetWelcomeTagline] = useState('');
  const [targetWelcomeMessage, setTargetWelcomeMessage] = useState('');
  const [targetSelectedUserIds, setTargetSelectedUserIds] = useState<number[]>([]);
  const [targetMemberSearch, setTargetMemberSearch] = useState('');
  const [targetIsActive, setTargetIsActive] = useState(true);

  // State for Cells (instant localStorage cache hydration)
  const [cells, setCells] = useState<CellItem[]>(() => {
    try {
      const cached = localStorage.getItem('dfmc_cells_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [cellsLoading, setCellsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('dfmc_cells_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [newCellName, setNewCellName] = useState('');
  const [showAddCellModal, setShowAddCellModal] = useState(false);
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
  const [noticeIsActive, setNoticeIsActive] = useState<boolean>(true);

  // State for Clubs (with instant localStorage cache hydration)
  const [clubs, setClubs] = useState<Club[]>(() => {
    try {
      const cached = localStorage.getItem('dfmc_clubs_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [clubsLoading, setClubsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('dfmc_clubs_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [newClubName, setNewClubName] = useState('');
  const [newClubIcon, setNewClubIcon] = useState('⚽');
  const [newClubManagers, setNewClubManagers] = useState('');
  const [inlineManagerSearch, setInlineManagerSearch] = useState('');
  const [showNewClubModal, setShowNewClubModal] = useState(false);

  // State for Media Admins (with instant localStorage cache hydration)
  const [mediaAdmins, setMediaAdmins] = useState<MemberItem[]>(() => {
    try {
      const cached = localStorage.getItem('dfmc_media_admins_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [mediaAdminsLoading, setMediaAdminsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('dfmc_media_admins_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [mediaAdminSearch, setMediaAdminSearch] = useState('');

  // State for Cell Reorganization Modal
  const [showReorganizeModal, setShowReorganizeModal] = useState(false);
  const [reorganizeCellList, setReorganizeCellList] = useState<string[]>([]);

  // State for Manager Appointment Modal & Members (with instant localStorage cache hydration)
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>(() => {
    try {
      const cached = localStorage.getItem('dfmc_members_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [membersLoading, setMembersLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('dfmc_members_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
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

      // 1. Immediately fetch cells for Tab 1
      if (!isMediaAdmin) {
        fetch('/api/head-admin/cells', { headers })
          .then((res) => res.json())
          .then((cData) => {
            const cellList = Array.isArray(cData) ? cData : (cData.cells || []);
            setCells(cellList);
            try { localStorage.setItem('dfmc_cells_cache', JSON.stringify(cellList)); } catch {}
          })
          .catch((err) => console.error('Failed to load cells:', err))
          .finally(() => setCellsLoading(false));

        // 2. Immediately fetch clubs
        fetch('/api/head-admin/clubs', { headers })
          .then((res) => res.json())
          .then((clData) => {
            const clubList = Array.isArray(clData) ? clData : (clData.clubs || []);
            setClubs(clubList);
            try { localStorage.setItem('dfmc_clubs_cache', JSON.stringify(clubList)); } catch {}
          })
          .catch((err) => console.error('Failed to load clubs:', err))
          .finally(() => setClubsLoading(false));

        // 3. Immediately fetch media admins
        fetch('/api/head-admin/media-admins', { headers })
          .then((res) => res.json())
          .then((maData) => {
            const maList = Array.isArray(maData) ? maData : (maData.mediaAdmins || []);
            setMediaAdmins(maList);
            try { localStorage.setItem('dfmc_media_admins_cache', JSON.stringify(maList)); } catch {}
          })
          .catch((err) => console.error('Failed to load media admins:', err))
          .finally(() => setMediaAdminsLoading(false));
      }

      // 4. Popup
      fetch('/api/head-admin/popup', { headers })
        .then((res) => res.json())
        .then((pData) => {
          if (pData?.popup) {
            setPopupTitle(pData.popup.title || '');
            setPopupContent(pData.popup.content_text || '');
            setPopupImageUrl(pData.popup.image_url || '');
            setPopupEndDate(pData.popup.end_date ? pData.popup.end_date.slice(0, 16) : '');
            setPopupIsActive(!!pData.popup.is_active);
          }
        })
        .catch((err) => console.error('Failed to load popup:', err));

      // 5. Notices
      fetch('/api/head-admin/notices', { headers })
        .then((res) => res.json())
        .then((nData) => {
          const noticeList: Notice[] = Array.isArray(nData) ? nData : (nData.notices || (nData.notice ? [nData.notice] : []));
          noticeList.sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime() || a.id || 0;
            const timeB = new Date(b.created_at || 0).getTime() || b.id || 0;
            return timeB - timeA;
          });
          if (noticeList.length > 0) {
            const firstNotice = noticeList[0];
            setActiveNotice(firstNotice);
            setNoticeTitle(firstNotice.title || '');
            setNoticeContent(firstNotice.content || '');
            setNoticeIsActive(firstNotice.is_active !== 0);
          } else {
            setActiveNotice(null);
            setNoticeTitle('');
            setNoticeContent('');
            setNoticeIsActive(true);
          }
        })
        .catch((err) => console.error('Failed to load notices:', err));

      // 6. Welcome
      fetch('/api/head-admin/welcome', { headers })
        .then((res) => res.json())
        .then((wData) => {
          const welcomeObj = wData?.welcome || wData;
          if (welcomeObj && (welcomeObj.welcome_tagline !== undefined || welcomeObj.welcome_message !== undefined)) {
            setWelcomeTagline(welcomeObj.welcome_tagline || '');
            setWelcomeMessage(welcomeObj.welcome_message || '');
          }
        })
        .catch((err) => console.error('Failed to load welcome:', err));

      // 7. Targeted Welcomes
      fetch('/api/head-admin/targeted-welcomes', { headers })
        .then((res) => res.json())
        .then((twData) => {
          const twList = twData?.targetedWelcomes || [];
          setTargetedWelcomes(twList);
        })
        .catch((err) => console.error('Failed to load targeted welcomes:', err));
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    loadAdminData();
    fetchMembers();
  }, []);

  const flashMessage = (msg: string) => {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  };

  // --- Targeted Welcome Message Handlers ---
  // Helper: Find if a member is already in another targeted welcome message (1 member = max 1 targeted welcome)
  const getAssignedOtherGroup = (memberId: number) => {
    return targetedWelcomes.find(
      (tw) => tw.id !== editingTargetedId && (tw.user_ids || []).includes(memberId)
    );
  };

  const applyTargetPreset = (type: 'new_family' | 'commitment' | 'graduate' | 'custom') => {
    setEditingTargetedId(null);
    setTargetIsActive(true);
    setTargetMemberSearch('');
    if (type === 'new_family') {
      setTargetGroupName('새가족 등록 성도');
      setTargetWelcomeTagline('둔산제일교회 가족이 되신 것을 환영합니다!');
      setTargetWelcomeMessage('모영에서 따뜻한 교제와 기쁨의 동역이 가득하길 축복합니다.');
      setTargetSelectedUserIds([]);
    } else if (type === 'commitment') {
      setTargetGroupName('말씀양육 결단자');
      setTargetWelcomeTagline('말씀양육 훈련 결단을 축복합니다!');
      setTargetWelcomeMessage('말씀으로 자라나는 은혜와 성장의 여정을 온 교회가 응원합니다.');
      setTargetSelectedUserIds([]);
    } else if (type === 'graduate') {
      setTargetGroupName('말씀양육 수료자');
      setTargetWelcomeTagline('말씀양육 수료를 진심으로 축하드립니다!');
      setTargetWelcomeMessage('주님의 말씀 위에 굳건히 서신 참된 제자로 승리하세요.');
      setTargetSelectedUserIds([]);
    } else {
      setTargetGroupName('');
      setTargetWelcomeTagline('');
      setTargetWelcomeMessage('');
      setTargetSelectedUserIds([]);
    }
    setShowTargetedModal(true);
  };

  const handleOpenEditTargeted = (item: TargetedWelcomeItem) => {
    setEditingTargetedId(item.id);
    setTargetGroupName(item.group_name);
    setTargetWelcomeTagline(item.welcome_tagline || '');
    setTargetWelcomeMessage(item.welcome_message || '');
    setTargetSelectedUserIds(item.user_ids || []);
    setTargetIsActive(item.is_active === 1);
    setTargetMemberSearch('');
    setShowTargetedModal(true);
  };

  const handleToggleTargeted = async (id: number) => {
    try {
      const res = await fetch(`/api/head-admin/targeted-welcomes/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashMessage(data.message);
      setTargetedWelcomes((prev) =>
        prev.map((it) => (it.id === id ? { ...it, is_active: data.is_active } : it))
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTargeted = async (id: number) => {
    if (!window.confirm('이 맞춤 환영 문구를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/head-admin/targeted-welcomes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashMessage(data.message);
      setTargetedWelcomes((prev) => prev.filter((it) => it.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveTargeted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroupName.trim()) {
      setError('대상 그룹명을 입력해주세요 (예: 말씀양육 수료자, 새가족 등록 성도 등).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/head-admin/targeted-welcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingTargetedId || undefined,
          group_name: targetGroupName.trim(),
          welcome_tagline: targetWelcomeTagline.trim(),
          welcome_message: targetWelcomeMessage.trim(),
          user_ids: targetSelectedUserIds,
          is_active: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashMessage(data.message);
      setShowTargetedModal(false);
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/head-admin/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.members || []);
        const list = rawList.filter((m: any) => m.role !== 'guest' && !m.is_guest);
        setMembers(list);
        try { localStorage.setItem('dfmc_members_cache', JSON.stringify(list)); } catch {}
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setMembersLoading(false);
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
      setShowAddCellModal(false);
      setCells(prev => {
        const newCells = [...prev, data.cell];
        newCells.sort((a, b) => {
          if (a.name === '둔산제일교회') return -1;
          if (b.name === '둔산제일교회') return 1;
          return (a.name || '').localeCompare(b.name || '', 'ko');
        });
        try {
          localStorage.setItem('dfmc_cells_cache', JSON.stringify(newCells));
        } catch {}
        return newCells;
      });
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCell = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const targetCell = cells.find(c => c.id === id);
    if (targetCell?.name === '둔산제일교회') {
      alert("'둔산제일교회'는 고정 기본 셀이므로 삭제할 수 없습니다.");
      return;
    }
    if (!confirm('정말 이 셀을 삭제하시겠습니까?')) return;
    
    // Optimistic UI update
    setCells(prev => {
      const updated = prev.filter(c => c.id !== id);
      try {
        localStorage.setItem('dfmc_cells_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (expandedCellId === id) setExpandedCellId(null);
    
    try {
      const res = await fetch(`/api/head-admin/cells/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      flashMessage(data.message);
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
      loadAdminData(); // Refresh if failed
    }
  };

  const handleOpenReorganizeModal = () => {
    const list = cells
      .map(c => c.name)
      .filter(n => n && n !== '둔산제일교회');
    setReorganizeCellList(list.length > 0 ? list : ['']);
    setShowReorganizeModal(true);
  };

  const handleExecuteReorganize = async () => {
    const filtered = reorganizeCellList.map(c => c.trim()).filter(c => c.length > 0 && c !== '둔산제일교회');
    const msg = filtered.length === 0
      ? '입력된 셀이 없습니다. 개편을 실행하면 기존 셀이 모두 삭제되고 기본 셀만 유지됩니다. 계속하시겠습니까?'
      : '정말로 셀 개편을 실행하시겠습니까? 등록된 셀 목록으로 전체 갱신되며, 일반 회원들의 소속 셀 재설정이 요청됩니다.';
    if (!confirm(msg)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/head-admin/cells/reorganize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cellNames: filtered, cellListText: filtered.join('\n') }),
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
        setClubs(prev => prev.map(c => c.id === targetClubForManager.id ? { ...c, manager_names: joined } : c));
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

    // 팝업이 활성화 상태일 때만 제목 검사 (비활성화 상태면 종료일/제목 없이도 즉시 저장 가능)
    if (popupIsActive && !popupTitle.trim()) {
      setError('활성화 상태에서는 팝업 제목을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 종료일 미입력 시 1년 뒤 기본값 지정
      const finalEndDate = popupEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch('/api/head-admin/popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: popupTitle.trim() || '공지 팝업',
          content_text: popupContent.trim(),
          image_url: popupImageUrl.trim(),
          end_date: finalEndDate,
          is_active: popupIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 로비 캐시 무효화 (팝업 즉각 반영)
      localStorage.removeItem('dfmc_lobby_cache');
      flashMessage(data.message || (popupIsActive ? '팝업 설정이 저장되었습니다.' : '팝업이 비활성화(숨김)되었습니다.'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. Single Notice Handlers ---
  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      const res = await fetch('/api/head-admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
          is_active: noticeIsActive ? 1 : 0
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.removeItem('dfmc_lobby_cache');
      flashMessage(data.message);
      if (data.notice) {
        setActiveNotice(data.notice);
        setNoticeTitle(data.notice.title || '');
        setNoticeContent(data.notice.content || '');
        setNoticeIsActive(data.notice.is_active !== 0);
      }
      loadAdminData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNoticeActive = async () => {
    if (!activeNotice) return;
    const newActive = !noticeIsActive;
    // 0ms 낙관적 업데이트
    setNoticeIsActive(newActive);
    setActiveNotice({ ...activeNotice, is_active: newActive ? 1 : 0 });
    localStorage.removeItem('dfmc_lobby_cache');

    try {
      const res = await fetch('/api/head-admin/notices/toggle', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashMessage(data.message || (newActive ? '공지가 ON(노출)되었습니다.' : '공지가 OFF(숨김)되었습니다.'));
    } catch (err: any) {
      // 롤백
      setNoticeIsActive(!newActive);
      setActiveNotice({ ...activeNotice, is_active: !newActive ? 1 : 0 });
      setError(err.message || '공지 상태 변경 실패');
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
      localStorage.removeItem('dfmc_lobby_cache');
      flashMessage(data.message);
      setActiveNotice(null);
      setNoticeTitle('');
      setNoticeContent('');
      setNoticeIsActive(true);
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
      setInlineManagerSearch('');
      setShowNewClubModal(false);
      setClubs(prev => {
        const updated = [...prev, data.club];
        try { localStorage.setItem('dfmc_clubs_cache', JSON.stringify(updated)); } catch {}
        return updated;
      });
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
      setClubs(prev => {
        const updated = prev.filter(c => c.id !== id);
        try { localStorage.setItem('dfmc_clubs_cache', JSON.stringify(updated)); } catch {}
        return updated;
      });
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
          { id: 'clubs', label: '모영 관리' },
          { id: 'cells', label: '셀 관리' },
          { id: 'notices', label: '전체 공지' },
          { id: 'welcome', label: '환영 문구' },
          { id: 'popup', label: '팝업 설정' },
          { id: 'media_admins', label: <>미디어<br/>관리자</> },
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
          {/* Existing Cells List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0 }}>
                  셀 목록 {cellsLoading && cells.length === 0 ? '(불러오는 중...)' : `(${cells.length}개)`}
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '2px', margin: 0 }}>
                  셀을 클릭하면 해당 셀에 소속된 셀원 명단이 펼쳐집니다.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setNewCellName('');
                  setShowAddCellModal(true);
                }}
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={14} />
                <span>신규 셀</span>
              </button>
            </div>

            {cellsLoading && cells.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e2e8f0',
                  borderTop: '3px solid var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, fontWeight: '700' }}>
                  셀 목록을 불러오는 중입니다...
                </p>
              </div>
            ) : cells.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                등록된 셀이 없습니다. 우측 상단의 <strong>[신규 셀]</strong> 버튼을 눌러 첫 셀을 등록해보세요.
              </div>
            ) : (
              <div style={{ paddingRight: '6px' }}>
              {cells.map((cell, idx) => {
                const isExpanded = expandedCellId === cell.id;
                const cellMembers = members.filter(m => m.cell_name === cell.name);

                return (
                  <div
                    key={cell.id}
                    style={{
                      display: 'block',
                      marginBottom: idx === cells.length - 1 ? 0 : '8px',
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
                        padding: '10px 14px',
                        minHeight: '46px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-light)', fontWeight: '700', width: '22px', flexShrink: 0, textAlign: 'right' }}>
                          {idx + 1}.
                        </span>
                        <span style={{ fontWeight: '700', color: 'var(--color-text-main)', fontSize: '13.5px', wordBreak: 'keep-all', lineHeight: 1.4 }}>
                          {cell.name}
                        </span>
                        {cell.name === '둔산제일교회' && (
                          <span style={{
                            fontSize: '10px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: '700',
                            lineHeight: 1.3
                          }}>
                            고정 기본
                          </span>
                        )}
                        <span style={{
                          fontSize: '11px',
                          color: isExpanded ? 'white' : 'var(--color-text-light)',
                          background: isExpanded ? 'var(--color-primary)' : '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: '600',
                          lineHeight: 1.3
                        }}>
                          {cell.member_count ?? cellMembers.length}명
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11.5px', color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {isExpanded ? '접기' : '셀원 보기'}
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>

                        {cell.name !== '둔산제일교회' ? (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCell(e, cell.id)}
                            className="btn btn-sm"
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                            title="셀 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span
                            style={{ fontSize: '11px', color: '#94a3b8', padding: '4px', cursor: 'default' }}
                            title="시스템 고정 기본 셀 (삭제 불가)"
                          >
                            🔒
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Cell Members List */}
                    {isExpanded && (
                      <div style={{
                        padding: '12px 14px 14px',
                        borderTop: '1px solid #e2e8f0',
                        background: '#ffffff',
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '10px' }}>
                          👥 [{cell.name}] 소속 셀원 ({cellMembers.length}명):
                        </div>

                        {cellMembers.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingRight: '4px' }}>
                            {cellMembers.map((m) => (
                              <div
                                key={m.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '5px 10px',
                                  background: '#f8fafc',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12px',
                                  flexShrink: 0
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
          )}
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
                {welcomeTagline && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>
                    <Sparkles size={14} color="#fde047" />
                    <span>{welcomeTagline}</span>
                  </div>
                )}
                <h2 style={{ fontSize: '18px', fontWeight: '800' }}>
                  환영합니다, 홍길동님!
                </h2>
                <p style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
                  소속 셀: <strong>1청년부 1셀</strong>{welcomeMessage ? ` | ${welcomeMessage}` : ''}
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
                <label className="form-label">상단 슬로건 / 소제목 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 은혜와 교제가 넘치는 둔산제일교회 모영"
                  value={welcomeTagline}
                  onChange={(e) => setWelcomeTagline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">하단 교제 안내 문구 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 이번 주에도 모영에서 기쁨의 교제 함께해요."
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
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

          {/* ========================================================= */}
          {/* Section: Targeted Welcome Messages (대상별 맞춤 환영 문구) */}
          {/* ========================================================= */}
          <div className="card" style={{ borderTop: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={18} color="#8b5cf6" />
                  <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
                    대상별 맞춤 환영 문구
                  </h3>
                  <span style={{ fontSize: '11px', background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                    새가족 · 말씀양육 결단/수료 등
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  특정 인원들을 모아서 로비 접속 시 개인 맞춤형 축복/환영 문구를 개별 노출합니다.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => applyTargetPreset('new_family')}
                  style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '11.5px', fontWeight: '700', padding: '5px 10px' }}
                >
                  + 🌿 새가족 등록
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => applyTargetPreset('commitment')}
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '11.5px', fontWeight: '700', padding: '5px 10px' }}
                >
                  + 📖 말씀양육 결단
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => applyTargetPreset('graduate')}
                  style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', fontSize: '11.5px', fontWeight: '700', padding: '5px 10px' }}
                >
                  + 🎓 말씀양육 수료
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => applyTargetPreset('custom')}
                  style={{ fontSize: '11.5px', fontWeight: '700', padding: '5px 10px' }}
                >
                  <Plus size={13} />
                  직접 맞춤 추가
                </button>
              </div>
            </div>

            {/* Targeted Welcomes List */}
            {targetedWelcomes.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '32px 16px',
                background: '#faf5ff',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed #d8b4fe'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#6b21a8' }}>
                  등록된 맞춤 환영 문구가 없습니다.
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  상단의 <strong>[+ 새가족 등록]</strong>, <strong>[+ 말씀양육 수료]</strong> 등의 버튼을 눌러 대상자를 모아보세요.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {targetedWelcomes.map((item) => {
                  const targetCount = item.user_ids?.length || 0;
                  const sampleNames = (item.target_users || []).slice(0, 3).map(u => u.name).join(', ');
                  const extraCount = targetCount > 3 ? ` 외 ${targetCount - 3}명` : '';

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '14px 16px',
                        background: item.is_active ? '#ffffff' : '#f8fafc',
                        border: `1px solid ${item.is_active ? '#e2e8f0' : '#cbd5e1'}`,
                        borderRadius: 'var(--radius-md)',
                        boxShadow: item.is_active ? 'var(--shadow-sm)' : 'none',
                        opacity: item.is_active ? 1 : 0.75,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '12.5px',
                            fontWeight: '800',
                            color: '#6d28d9',
                            background: '#f5f3ff',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid #ddd6fe'
                          }}>
                            🎯 {item.group_name}
                          </span>

                          <span style={{
                            fontSize: '11.5px',
                            color: targetCount > 0 ? '#047857' : '#94a3b8',
                            background: targetCount > 0 ? '#ecfdf5' : '#f1f5f9',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: '700'
                          }}>
                            대상 {targetCount}명
                            {sampleNames ? ` (${sampleNames}${extraCount})` : ''}
                          </span>
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleTargeted(item.id)}
                            className="btn btn-sm"
                            style={{
                              padding: '3px 9px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: item.is_active ? '#ecfdf5' : '#f1f5f9',
                              color: item.is_active ? '#059669' : '#64748b',
                              border: `1px solid ${item.is_active ? '#a7f3d0' : '#e2e8f0'}`
                            }}
                          >
                            {item.is_active ? '● 노출 활성' : '○ 일시 비활성'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditTargeted(item)}
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            title="문구 및 대상자 수정"
                          >
                            <Edit2 size={12} />
                            수정
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTargeted(item.id)}
                            className="btn btn-sm btn-danger"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Tagline & Message */}
                      <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
                        {item.welcome_tagline && (
                          <div style={{ fontWeight: '700', color: '#1e3a8a', marginBottom: '2px' }}>
                            {item.welcome_tagline}
                          </div>
                        )}
                        <div style={{ color: '#475569' }}>
                          {item.welcome_message || '(문구 없음)'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* Modal: Targeted Welcome Message Create / Edit              */}
          {/* ========================================================= */}
          {showTargetedModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}>
              <div style={{
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                width: '100%',
                maxWidth: '540px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-xl)',
                padding: '22px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={20} color="#8b5cf6" />
                    <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0 }}>
                      {editingTargetedId ? '맞춤 환영 문구 및 대상자 수정' : '새 맞춤 환영 문구 등록'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTargetedModal(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveTargeted}>
                  {/* Group Name */}
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>
                      대상 그룹명 <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="예: 말씀양육 수료자, 새가족 등록 성도, 말씀양육 결단자"
                      value={targetGroupName}
                      onChange={(e) => setTargetGroupName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Tagline */}
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">상단 슬로건 / 소제목 (선택)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="예: 🎓 말씀양육 수료를 진심으로 축하드립니다!"
                      value={targetWelcomeTagline}
                      onChange={(e) => setTargetWelcomeTagline(e.target.value)}
                    />
                  </div>

                  {/* Message */}
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">하단 축복 및 교제 문구 (선택)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="예: 주님의 말씀 위에 굳건히 서신 참된 제자로 승리하세요."
                      value={targetWelcomeMessage}
                      onChange={(e) => setTargetWelcomeMessage(e.target.value)}
                    />
                  </div>

                  {/* Member Picker Section (성도 모으기) */}
                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    background: '#f8fafc',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <div>
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                          대상 성도 선택 (모으기)
                        </span>
                        <span style={{ fontSize: '12px', color: '#6d28d9', fontWeight: '700', marginLeft: '6px' }}>
                          선택됨: {targetSelectedUserIds.length}명
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                          (1인당 1개 문구만 지정 가능)
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => {
                            const availableIds = members
                              .filter(m => !getAssignedOtherGroup(m.id))
                              .map(m => m.id);
                            setTargetSelectedUserIds(availableIds);
                          }}
                          title="다른 맞춤 문구에 포함되지 않은 성도만 전체 선택합니다"
                        >
                          가능 인원 전체 선택
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => setTargetSelectedUserIds([])}
                        >
                          선택 해제
                        </button>
                      </div>
                    </div>

                    {/* Member Search */}
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="성도 이름 또는 소속 셀 검색..."
                        value={targetMemberSearch}
                        onChange={(e) => setTargetMemberSearch(e.target.value)}
                        style={{ paddingLeft: '32px', fontSize: '12.5px', height: '34px' }}
                      />
                    </div>

                    {/* Selected Member Chips */}
                    {targetSelectedUserIds.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginBottom: '10px',
                        maxHeight: '70px',
                        overflowY: 'auto',
                        padding: '4px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px'
                      }}>
                        {targetSelectedUserIds.map((uid) => {
                          const mem = members.find(m => m.id === uid);
                          if (!mem) return null;
                          return (
                            <span
                              key={uid}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#f5f3ff',
                                color: '#6d28d9',
                                border: '1px solid #ddd6fe',
                                borderRadius: '12px',
                                padding: '2px 7px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {mem.name} ({mem.cell_name})
                              <X
                                size={11}
                                style={{ cursor: 'pointer', marginLeft: '2px' }}
                                onClick={() => setTargetSelectedUserIds(prev => prev.filter(id => id !== uid))}
                              />
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Scrollable Member Checklist */}
                    <div style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: 'white',
                      padding: '4px'
                    }}>
                      {(() => {
                        const filtered = members.filter((m) => {
                          if (!targetMemberSearch.trim()) return true;
                          const term = targetMemberSearch.toLowerCase();
                          return (
                            m.name.toLowerCase().includes(term) ||
                            (m.cell_name && m.cell_name.toLowerCase().includes(term))
                          );
                        });

                        const availableMembers = filtered.filter((m) => !getAssignedOtherGroup(m.id));
                        const disabledMembers = filtered.filter((m) => !!getAssignedOtherGroup(m.id));

                        availableMembers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                        disabledMembers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

                        return (
                          <>
                            {/* Available Members (Top) */}
                            {availableMembers.map((m) => {
                              const isChecked = targetSelectedUserIds.includes(m.id);
                              return (
                                <label
                                  key={m.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    background: isChecked ? '#f5f3ff' : 'transparent',
                                    fontSize: '12.5px',
                                    transition: 'background 0.1s ease',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setTargetSelectedUserIds((prev) => [...prev, m.id]);
                                        } else {
                                          setTargetSelectedUserIds((prev) => prev.filter((id) => id !== m.id));
                                        }
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: isChecked ? '800' : '500', color: isChecked ? '#6d28d9' : 'var(--color-text-main)' }}>
                                      {m.name}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    {m.cell_name}
                                  </span>
                                </label>
                              );
                            })}

                            {availableMembers.length === 0 && disabledMembers.length === 0 && (
                              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                검색 결과가 없습니다.
                              </div>
                            )}

                            {/* Disabled Members: Already Assigned to Other Group (Bottom) */}
                            {disabledMembers.length > 0 && (
                              <div style={{ marginTop: '6px' }}>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: '#94a3b8',
                                  padding: '6px 8px 3px',
                                  borderTop: '1px solid #f1f5f9',
                                  background: '#f8fafc',
                                  borderRadius: '4px',
                                  marginBottom: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <span>⚠️ 다른 맞춤 문구에 이미 포함된 성도 ({disabledMembers.length}명 - 선택 불가)</span>
                                </div>
                                {disabledMembers.map((m) => {
                                  const otherGroup = getAssignedOtherGroup(m.id);
                                  return (
                                    <div
                                      key={m.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 10px',
                                        borderRadius: '4px',
                                        background: '#f8fafc',
                                        opacity: 0.55,
                                        cursor: 'not-allowed',
                                        fontSize: '12px',
                                      }}
                                      title={`이미 '${otherGroup?.group_name}' 맞춤 환영 문구에 지정되어 있어 중복 선택할 수 없습니다.`}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                          type="checkbox"
                                          checked={false}
                                          disabled={true}
                                          style={{ cursor: 'not-allowed' }}
                                        />
                                        <span style={{ color: '#64748b' }}>
                                          {m.name}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: '10.5px',
                                            color: '#b45309',
                                            background: '#fef3c7',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontWeight: '600'
                                          }}
                                        >
                                          {otherGroup?.group_name}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        {m.cell_name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Live Preview for Targeted Banner */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                      ✨ 대상 성도 로비 화면 실시간 미리보기
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      color: 'white',
                      boxShadow: 'var(--shadow-md)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{ position: 'relative', zIndex: 2 }}>
                        {targetGroupName && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(254, 240, 138, 0.25)',
                            color: '#fef08a',
                            border: '1px solid rgba(254, 240, 138, 0.45)',
                            padding: '2px 7px',
                            borderRadius: '12px',
                            fontSize: '10.5px',
                            fontWeight: '800',
                            marginBottom: '4px'
                          }}>
                            <span>🎯</span>
                            <span>{targetGroupName} 맞춤 환영</span>
                          </div>
                        )}
                        {targetWelcomeTagline && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: 0.95, marginBottom: '2px' }}>
                            <Sparkles size={12} color="#fde047" />
                            <span>{targetWelcomeTagline}</span>
                          </div>
                        )}
                        <h4 style={{ fontSize: '15px', fontWeight: '800', margin: '2px 0' }}>
                          환영합니다, 대상성도님!
                        </h4>
                        <p style={{ fontSize: '11.5px', opacity: 0.85, margin: 0 }}>
                          소속 셀: <strong>1청년부 1셀</strong>{targetWelcomeMessage ? ` | ${targetWelcomeMessage}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowTargetedModal(false)}
                      disabled={loading}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                      style={{ padding: '8px 20px', fontWeight: '700' }}
                    >
                      <Save size={15} />
                      {loading ? '저장 중...' : '맞춤 문구 저장'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
              <label className="form-label">팝업 제목 (선택)</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 2026 전교인 한마음 체육대회 안내"
                value={popupTitle}
                onChange={(e) => setPopupTitle(e.target.value)}
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
              <label className="form-label">팝업 종료 일시 (선택 - 미입력 시 1년 유지)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={popupEndDate}
                onChange={(e) => setPopupEndDate(e.target.value)}
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
          <div className="card" style={{ borderLeft: `4px solid ${noticeIsActive && activeNotice ? 'var(--color-primary)' : '#94a3b8'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={18} color={noticeIsActive && activeNotice ? 'var(--color-primary)' : '#94a3b8'} />
                <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                  현재 로비 공지 상태
                </h3>
                {activeNotice && (
                  noticeIsActive ? (
                    <span className="badge badge-success" style={{ fontWeight: '800', fontSize: '11.5px', padding: '3px 8px' }}>
                      ● 노출 ON
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: '800', fontSize: '11.5px', padding: '3px 8px' }}>
                      ○ 숨김 OFF
                    </span>
                  )
                )}
              </div>

              {activeNotice && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* 전체 공지 ON/OFF 스위치 버튼 */}
                  <button
                    type="button"
                    onClick={handleToggleNoticeActive}
                    className="btn btn-sm"
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      background: noticeIsActive ? '#fef2f2' : '#ecfdf5',
                      color: noticeIsActive ? '#dc2626' : '#059669',
                      border: `1px solid ${noticeIsActive ? '#fecaca' : '#a7f3d0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{noticeIsActive ? '공지 끄기 (OFF)' : '공지 켜기 (ON)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteNotice}
                    className="btn btn-sm btn-danger"
                    style={{ fontSize: '11.5px', padding: '5px 8px' }}
                    title="공지 완전 삭제"
                  >
                    <Trash2 size={13} />
                    삭제
                  </button>
                </div>
              )}
            </div>

            {activeNotice ? (
              <div style={{
                background: noticeIsActive ? '#f8fafc' : '#f1f5f9',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                opacity: noticeIsActive ? 1 : 0.65
              }}>
                {!noticeIsActive && (
                  <div style={{
                    marginBottom: '8px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>⚠️ 현재 공지가 [OFF (숨김)] 상태입니다. 홈 화면(로비)에 공지 카드가 노출되지 않습니다.</span>
                  </div>
                )}
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '6px' }}>
                  {activeNotice.title}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {activeNotice.content}
                </p>
                <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--color-text-light)' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
                교회 전체 공지 {activeNotice ? '수정 및 갱신' : '신규 등록'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-muted)' }}>노출 여부:</span>
                <button
                  type="button"
                  onClick={() => setNoticeIsActive(!noticeIsActive)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: noticeIsActive ? '#ecfdf5' : '#f1f5f9',
                    color: noticeIsActive ? '#059669' : '#64748b',
                    border: `1px solid ${noticeIsActive ? '#a7f3d0' : '#cbd5e1'}`,
                    cursor: 'pointer'
                  }}
                >
                  {noticeIsActive ? '● 노출 ON' : '○ 숨김 OFF'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
              💡 안내: 로비 상단에는 항상 <strong>1건의 교회 전체 공지</strong>만 노출됩니다. 새 공지를 저장하면 이전 공지는 자동으로 교체됩니다.
            </p>

            <form onSubmit={handleSaveNotice}>
              <div className="form-group">
                <label className="form-label">공지 제목 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 2026년 상반기 모영 활동 및 셀 교제 안내"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">공지 내용 (선택)</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="교회 모든 성도 및 회원들이 볼 공지사항 내용을 작성해주세요."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
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
          {/* Existing Clubs List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0 }}>
                운영 중인 모영 목록 {clubsLoading && clubs.length === 0 ? '(불러오는 중...)' : `(${clubs.length}개)`}
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setNewClubName('');
                  setNewClubManagers('');
                  setInlineManagerSearch('');
                  setShowNewClubModal(true);
                }}
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={14} />
                <span>신규 모영</span>
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 14px 0' }}>
              💡 모영 카드를 클릭하면 현존하는 총무를 해임하거나 새로운 총무를 선임할 수 있습니다 (모영당 최대 3명).
            </p>

            {clubsLoading && clubs.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e2e8f0',
                  borderTop: '3px solid var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, fontWeight: '700' }}>
                  모영 목록을 불러오는 중입니다...
                </p>
              </div>
            ) : clubs.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                현재 운영 중인 모영이 없습니다. 우측 상단의 <strong>[신규 모영]</strong> 버튼을 눌러 개설해보세요.
              </div>
            ) : (
              <>

            {/* 전체 모영 조회수 현황 통계 요약 (전체 관리자 전용) */}
            {clubs.length > 0 && (
              <div style={{
                background: '#f8fafc',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart3 size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                      모영 피드 접속 통계 지표
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAnalyticsClubId(null);
                      setShowAnalyticsModal(true);
                    }}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <BarChart3 size={14} />
                    <span>날짜·주·월별 통계 분석 차트 보기</span>
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px'
                }}>
                  <div style={{ textAlign: 'center', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>총 개설 모영</div>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-primary)', marginTop: '2px' }}>
                      {clubs.length}개
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>전체 모영 총 조회수</div>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                      {clubs.reduce((acc, c) => acc + (c.view_count || 0), 0).toLocaleString()}회
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>최다 조회 모영</div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clubs.reduce((max, c) => ((c.view_count || 0) > (max.view_count || 0) ? c : max), clubs[0])?.name || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                      flexWrap: 'wrap'
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '28px', lineHeight: 1 }}>{club.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0, wordBreak: 'break-all' }}>
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
                          {/* 전체 관리자 전용 누적 조회수 뱃지 (클릭 시 상세 분석 모달 열림) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnalyticsClubId(club.id);
                              setShowAnalyticsModal(true);
                            }}
                            style={{
                              fontSize: '11px',
                              color: '#0284c7',
                              fontWeight: '700',
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#bae6fd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#e0f2fe';
                            }}
                            title="클릭하여 이 모영의 날짜별/주별/월별 상세 조회수를 분석합니다."
                          >
                            <Eye size={11} />
                            <span>누적 {(club.view_count || 0).toLocaleString()}회</span>
                            <span style={{ fontSize: '9px', background: '#0284c7', color: '#ffffff', padding: '0 3px', borderRadius: '3px' }}>통계</span>
                          </button>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
            </>
            )}
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
              선임된 미디어 관리자 명단 {mediaAdminsLoading && mediaAdmins.length === 0 ? '(불러오는 중...)' : `(${mediaAdmins.length}명)`}
            </h3>

            {mediaAdminsLoading && mediaAdmins.length === 0 ? (
              <div style={{
                padding: '30px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  border: '3px solid #e2e8f0',
                  borderTop: '3px solid #7c3aed',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', margin: 0, fontWeight: '600' }}>
                  미디어 관리자 명단을 불러오는 중입니다...
                </p>
              </div>
            ) : mediaAdmins.length > 0 ? (
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
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-light)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="회원 이름 또는 셀 검색 후 엔터 (예: 홍길동, 1셀)"
                value={mediaAdminSearch}
                onChange={(e) => setMediaAdminSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!mediaAdminSearch.trim()) return;
                    const filtered = members.filter(m => 
                      m.name.toLowerCase().includes(mediaAdminSearch.toLowerCase()) ||
                      m.cell_name.toLowerCase().includes(mediaAdminSearch.toLowerCase()) ||
                      m.username.toLowerCase().includes(mediaAdminSearch.toLowerCase())
                    );
                    const toAppoint = filtered.find(m => !mediaAdmins.some(ma => ma.id === m.id));
                    if (toAppoint) {
                      handleToggleMediaAdmin(toAppoint.id, 'appoint');
                      setMediaAdminSearch('');
                    } else if (filtered.length > 0) {
                      alert(`'${filtered[0].name}' 성도는 이미 미디어 관리자로 선임되어 있습니다.`);
                    } else {
                      alert(`'${mediaAdminSearch}'에 해당하는 성도를 찾을 수 없습니다.`);
                    }
                  }
                }}
                style={{ paddingLeft: '32px', fontSize: '12.5px' }}
              />
              {mediaAdminSearch && (
                <button
                  type="button"
                  onClick={() => setMediaAdminSearch('')}
                  style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  title="검색어 지우기"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#6d28d9', marginBottom: '10px' }}>
              💡 성도 이름을 입력하시면 아래 목록에 실시간으로 나타납니다. (이름 입력 후 <strong>엔터</strong>를 누르면 첫 번째 성도가 즉시 선임됩니다)
            </div>

            {/* Member List */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {membersLoading && members.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0', gap: '10px', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: '#7c3aed' }} />
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>성도 목록을 빠르게 불러오는 중...</span>
                </div>
              ) : members
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
              {members.filter(m => 
                m.name.toLowerCase().includes(mediaAdminSearch.toLowerCase()) ||
                m.cell_name.toLowerCase().includes(mediaAdminSearch.toLowerCase()) ||
                m.username.toLowerCase().includes(mediaAdminSearch.toLowerCase())
              ).length === 0 && (
                <div style={{ padding: '16px', fontSize: '12.5px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  {members.length === 0 ? '등록된 전체 성도 명단을 불러오는 중입니다...' : '검색 결과와 일치하는 성도가 없습니다.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* 0-0. New Cell Creation Modal (단일 셀 추가 팝업)                   */}
      {/* =============================================================== */}
      {showAddCellModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowAddCellModal(false)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', padding: '22px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0 }}>
                  ✨ 단일 셀 추가
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', margin: 0 }}>
                  교회에 새로 등록될 공식 셀 이름을 추가합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCellModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCell}>
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px' }}>
                  셀 이름
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 3청년부 2셀"
                  value={newCellName}
                  onChange={(e) => setNewCellName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddCellModal(false)}
                  style={{ fontSize: '12.5px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '12.5px', fontWeight: '700', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={15} />
                  <span>추가하기</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* 0. New Club Creation Modal (신규 모영 개설 팝업)                    */}
      {/* =============================================================== */}
      {showNewClubModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '480px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0 }}>
                  ✨ 신규 모영 개설
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', margin: 0 }}>
                  새로운 교제 모영을 개설하고 초기 총무를 지정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewClubModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>모영 총무 선임 (최대 3명)</label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>
                    선임된 총무: {newClubManagers ? newClubManagers.split(',').map(s => s.trim()).filter(Boolean).length : 0} / 3명
                  </span>
                </div>

                {/* Selected Manager Badges */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  alignItems: 'center',
                  marginBottom: '8px',
                  minHeight: '36px',
                  padding: '6px 10px',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}>
                  {newClubManagers && newClubManagers.split(',').map(s => s.trim()).filter(Boolean).length > 0 ? (
                    newClubManagers.split(',').map((name) => name.trim()).filter(Boolean).map((mName) => (
                      <span key={mName} className="badge badge-primary" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '700' }}>
                        {mName}
                        <X
                          size={13}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            const updated = newClubManagers.split(',').map(s => s.trim()).filter(n => n !== mName).join(', ');
                            setNewClubManagers(updated);
                          }}
                        />
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      아래 검색창에 성도 이름을 입력하시면 검색 결과에서 바로 총무로 선임할 수 있습니다.
                    </span>
                  )}
                </div>

                {/* Inline Member Search Box */}
                <div style={{ position: 'relative', marginBottom: '6px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-light)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="성도 이름 또는 셀 검색 (예: 홍길동, 1셀)"
                    value={inlineManagerSearch}
                    onChange={(e) => setInlineManagerSearch(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '12.5px' }}
                  />
                  {inlineManagerSearch && (
                    <button
                      type="button"
                      onClick={() => setInlineManagerSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                      title="검색어 지우기"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filtered Member Dropdown List */}
                {inlineManagerSearch.trim().length > 0 && (
                  <div style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1.5px solid var(--color-primary)',
                    borderRadius: 'var(--radius-sm)',
                    background: '#ffffff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    padding: '4px'
                  }}>
                    {members
                      .filter(m => 
                        m.name.toLowerCase().includes(inlineManagerSearch.toLowerCase()) ||
                        m.cell_name.toLowerCase().includes(inlineManagerSearch.toLowerCase()) ||
                        m.username.toLowerCase().includes(inlineManagerSearch.toLowerCase())
                      )
                      .slice(0, 15)
                      .map((m) => {
                        const currentList = newClubManagers.split(',').map(s => s.trim()).filter(Boolean);
                        const isAlready = currentList.includes(m.name);
                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (isAlready) {
                                const updated = currentList.filter(n => n !== m.name).join(', ');
                                setNewClubManagers(updated);
                              } else {
                                if (currentList.length >= 3) {
                                  alert('총무는 모영당 최대 3명까지만 선임할 수 있습니다.');
                                  return;
                                }
                                setNewClubManagers([...currentList, m.name].join(', '));
                                setInlineManagerSearch('');
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              background: isAlready ? '#eff6ff' : '#ffffff',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isAlready) e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              if (!isAlready) e.currentTarget.style.background = '#ffffff';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: isAlready ? '#3b82f6' : '#cbd5e1',
                                color: 'white',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}>
                                {m.name.slice(0, 1)}
                              </span>
                              <span style={{ fontSize: '12.5px', fontWeight: '700', color: isAlready ? '#1d4ed8' : '#1e293b' }}>
                                {m.name}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                ({m.cell_name})
                              </span>
                            </div>

                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: isAlready ? '#dc2626' : 'var(--color-primary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isAlready ? '#fee2e2' : '#dbeafe'
                            }}>
                              {isAlready ? '선임 취소' : '+ 총무 선임'}
                            </span>
                          </div>
                        );
                      })}
                    {members.filter(m => 
                      m.name.toLowerCase().includes(inlineManagerSearch.toLowerCase()) ||
                      m.cell_name.toLowerCase().includes(inlineManagerSearch.toLowerCase()) ||
                      m.username.toLowerCase().includes(inlineManagerSearch.toLowerCase())
                    ).length === 0 && (
                      <div style={{ padding: '8px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                        일치하는 성도가 없습니다.
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenManagerModal(null)}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '11.5px', fontWeight: '600' }}
                >
                  <Users size={13} />
                  전체 성도
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNewClubModal(false)}
                  style={{ fontSize: '12.5px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '12.5px', fontWeight: '800', padding: '8px 18px' }}
                >
                  <Plus size={16} />
                  신규 모영 개설하기
                </button>
              </div>
            </form>
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
              lineHeight: 1.5,
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
                    id={`reorganize-cell-input-${idx}`}
                    type="text"
                    className="form-input"
                    value={cName}
                    onChange={(e) => {
                      const updated = [...reorganizeCellList];
                      updated[idx] = e.target.value;
                      setReorganizeCellList(updated);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const updated = [...reorganizeCellList];
                        updated.splice(idx + 1, 0, '');
                        setReorganizeCellList(updated);
                        setTimeout(() => {
                          const nextInput = document.getElementById(`reorganize-cell-input-${idx + 1}`);
                          nextInput?.focus();
                        }, 50);
                      }
                    }}
                    placeholder="셀 이름 (예: 1청년부 1셀)"
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      fontSize: '13px',
                      background: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = reorganizeCellList.filter((_, i) => i !== idx);
                      setReorganizeCellList(updated.length > 0 ? updated : ['']);
                    }}
                    className="btn btn-sm"
                    style={{ color: 'var(--color-danger)', padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  const nextIdx = reorganizeCellList.length;
                  setReorganizeCellList([...reorganizeCellList, '']);
                  setTimeout(() => {
                    const nextInput = document.getElementById(`reorganize-cell-input-${nextIdx}`);
                    nextInput?.focus();
                  }, 50);
                }}
                className="btn btn-sm btn-secondary"
                style={{ flex: 1, padding: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Plus size={14} />
                셀 추가
              </button>
              <button
                type="button"
                onClick={() => {
                  if (reorganizeCellList.length === 0 || (reorganizeCellList.length === 1 && !reorganizeCellList[0])) return;
                  if (confirm('목록의 모든 셀을 삭제하시겠습니까?')) {
                    setReorganizeCellList(['']);
                    setTimeout(() => {
                      const firstInput = document.getElementById('reorganize-cell-input-0');
                      firstInput?.focus();
                    }, 50);
                  }
                }}
                className="btn btn-sm"
                style={{
                  padding: '8px 14px',
                  fontWeight: '700',
                  color: '#dc2626',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} />
                전체 삭제
              </button>
            </div>

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
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
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
                총 {membersLoading && members.length === 0 ? '불러오는 중...' : `${members.length}명`}
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
              {membersLoading && members.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0', gap: '10px', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>성도 목록을 빠르게 불러오는 중...</span>
                </div>
              ) : members
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

      {/* Club View Analytics Modal (Head Admin & Server Admin Only) */}
      {showAnalyticsModal && (
        <ClubAnalyticsModal
          initialClubId={selectedAnalyticsClubId}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}
    </div>
  );
};
