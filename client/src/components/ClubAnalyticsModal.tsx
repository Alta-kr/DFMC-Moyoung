import React, { useState, useEffect } from 'react';
import { ClubAnalyticsData, MultiClubAnalyticsSummary, PeriodStatItem } from '../types';
import { 
  X, BarChart3, Calendar, Clock, TrendingUp, Award,
  ChevronDown, RefreshCw, Eye, Sparkles
} from 'lucide-react';

interface ClubAnalyticsModalProps {
  initialClubId?: number | null; // null means "All clubs"
  onClose: () => void;
}

export const ClubAnalyticsModal: React.FC<ClubAnalyticsModalProps> = ({
  initialClubId = null,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MultiClubAnalyticsSummary | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<number | 'all'>(
    initialClubId !== null && initialClubId !== undefined ? initialClubId : 'all'
  );
  const [statTab, setStatTab] = useState<'daily' | 'weekly' | 'monthly' | 'ranking'>('daily');

  const token = localStorage.getItem('dfmc_token');

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/club-analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json: MultiClubAnalyticsSummary = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load club analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // Compute stats for current selection
  const selectedClub: ClubAnalyticsData | null =
    selectedClubId === 'all'
      ? null
      : (data?.clubs || []).find(c => c.club_id === selectedClubId) || null;

  // Aggregate stats if 'all' is selected
  const aggregateList = (key: 'daily' | 'weekly' | 'monthly'): PeriodStatItem[] => {
    if (!data || data.clubs.length === 0) return [];
    if (selectedClub) return selectedClub[key];

    // Combine all clubs' periods
    const basePeriods = data.clubs[0]?.[key] || [];
    return basePeriods.map((bp, idx) => {
      const totalViewsForPeriod = data.clubs.reduce((sum, cl) => {
        return sum + (cl[key][idx]?.views || 0);
      }, 0);
      return {
        period: bp.period,
        label: bp.label,
        views: totalViewsForPeriod
      };
    });
  };

  const currentStats = statTab === 'ranking' ? [] : aggregateList(statTab);
  const maxStatValue = Math.max(1, ...currentStats.map(s => s.views));

  const totalViews = selectedClub ? selectedClub.total_views : (data?.all_total_views || 0);
  const todayViews = selectedClub ? selectedClub.today_views : (data?.all_today_views || 0);
  const thisWeekViews = selectedClub ? selectedClub.this_week_views : (data?.all_this_week_views || 0);
  const thisMonthViews = selectedClub ? selectedClub.this_month_views : (data?.all_this_month_views || 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
            }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  모영 피드 접속 통계 분석
                </h3>
                <span style={{
                  fontSize: '11px',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: '700',
                  padding: '2px 7px',
                  borderRadius: '6px'
                }}>
                  전체/서버 관리자 전용
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                진입 경로 무관 세션 1회 집계 기반 일별·주별·월별 조회수 현황
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={loadAnalytics}
              className="btn btn-sm btn-secondary"
              style={{ padding: '6px', borderRadius: '8px' }}
              title="새로고침"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Club Selector Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#f8fafc',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>
              조회 대상 모영:
            </span>
            <select
              className="form-select"
              value={selectedClubId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedClubId(val === 'all' ? 'all' : Number(val));
              }}
              style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#1e293b',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                maxWidth: '280px'
              }}
            >
              <option value="all">🌐 [전체 모영 종합 통계]</option>
              {(data?.clubs || []).map(c => (
                <option key={c.club_id} value={c.club_id}>
                  {c.club_icon} {c.club_name} (총 {c.total_views.toLocaleString()}회)
                </option>
              ))}
            </select>
          </div>

          {/* 4 Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px'
          }}>
            {/* Card 1: Total */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700' }}>총 누적 조회수</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d', marginTop: '4px' }}>
                {totalViews.toLocaleString()}회
              </div>
            </div>

            {/* Card 2: Today */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '700' }}>오늘 접속</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563eb', marginTop: '4px' }}>
                {todayViews.toLocaleString()}회
              </div>
            </div>

            {/* Card 3: This Week */}
            <div style={{
              background: '#faf5ff',
              border: '1px solid #e9d5ff',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#6b21a8', fontWeight: '700' }}>이번 주 접속</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#9333ea', marginTop: '4px' }}>
                {thisWeekViews.toLocaleString()}회
              </div>
            </div>

            {/* Card 4: This Month */}
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: '700' }}>이번 달 접속</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#ea580c', marginTop: '4px' }}>
                {thisMonthViews.toLocaleString()}회
              </div>
            </div>
          </div>

          {/* Period Tabs */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px'
          }}>
            <button
              type="button"
              onClick={() => setStatTab('daily')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: statTab === 'daily' ? '800' : '600',
                border: 'none',
                borderRadius: '8px',
                background: statTab === 'daily' ? '#ffffff' : 'transparent',
                color: statTab === 'daily' ? '#2563eb' : '#64748b',
                boxShadow: statTab === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              📅 일별 (최근 14일)
            </button>
            <button
              type="button"
              onClick={() => setStatTab('weekly')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: statTab === 'weekly' ? '800' : '600',
                border: 'none',
                borderRadius: '8px',
                background: statTab === 'weekly' ? '#ffffff' : 'transparent',
                color: statTab === 'weekly' ? '#2563eb' : '#64748b',
                boxShadow: statTab === 'weekly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              📆 주별 (최근 8주)
            </button>
            <button
              type="button"
              onClick={() => setStatTab('monthly')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: statTab === 'monthly' ? '800' : '600',
                border: 'none',
                borderRadius: '8px',
                background: statTab === 'monthly' ? '#ffffff' : 'transparent',
                color: statTab === 'monthly' ? '#2563eb' : '#64748b',
                boxShadow: statTab === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🗓️ 월별 (최근 6개월)
            </button>
            {selectedClubId === 'all' && (
              <button
                type="button"
                onClick={() => setStatTab('ranking')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: statTab === 'ranking' ? '800' : '600',
                  border: 'none',
                  borderRadius: '8px',
                  background: statTab === 'ranking' ? '#ffffff' : 'transparent',
                  color: statTab === 'ranking' ? '#2563eb' : '#64748b',
                  boxShadow: statTab === 'ranking' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🏆 모영별 순위
              </button>
            )}
          </div>

          {/* Chart & Data Section */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px' }}>
              <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '8px' }}>
                <RefreshCw size={24} color="#2563eb" />
              </div>
              <div>통계 데이터를 분석하는 중입니다...</div>
            </div>
          ) : statTab === 'ranking' ? (
            /* Club Ranking Table */
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>
                🏆 모영별 누적 조회수 순위
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(data?.clubs || []).map((cl, rankIdx) => {
                  const share = totalViews > 0 ? ((cl.total_views / totalViews) * 100).toFixed(1) : '0';
                  return (
                    <div
                      key={cl.club_id}
                      onClick={() => setSelectedClubId(cl.club_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2563eb';
                        e.currentTarget.style.background = '#f0f9ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: rankIdx === 0 ? '#fef08a' : rankIdx === 1 ? '#e2e8f0' : rankIdx === 2 ? '#ffedd5' : '#f1f5f9',
                          color: rankIdx === 0 ? '#854d0e' : rankIdx === 1 ? '#475569' : rankIdx === 2 ? '#9a3412' : '#64748b',
                          fontSize: '11px',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {rankIdx + 1}
                        </span>
                        <span style={{ fontSize: '20px' }}>{cl.club_icon}</span>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>
                            {cl.club_name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            오늘 {cl.today_views}회 · 이번 주 {cl.this_week_views}회 · 이번 달 {cl.this_month_views}회
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#059669' }}>
                          {cl.total_views.toLocaleString()}회
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          점유율 {share}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Bar Chart and Data Table */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Visual Bar Chart */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 14px 10px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                    📈 {statTab === 'daily' ? '최근 14일 일별 추이' : statTab === 'weekly' ? '최근 8주 주별 추이' : '최근 6개월 월별 추이'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    최고 {maxStatValue.toLocaleString()}회
                  </span>
                </div>

                {/* Bars Container */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: '140px',
                  gap: '6px',
                  paddingBottom: '24px',
                  position: 'relative'
                }}>
                  {currentStats.map((item, idx) => {
                    const heightPercent = maxStatValue > 0 ? Math.max(8, (item.views / maxStatValue) * 100) : 8;
                    const isLatest = idx === currentStats.length - 1;
                    return (
                      <div
                        key={item.period}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative'
                        }}
                        title={`${item.label}: ${item.views}회`}
                      >
                        {/* Value Text */}
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: item.views > 0 ? (isLatest ? '#2563eb' : '#475569') : '#cbd5e1',
                          marginBottom: '3px',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.views > 0 ? item.views : '0'}
                        </span>

                        {/* Bar */}
                        <div style={{
                          width: '100%',
                          maxWidth: '28px',
                          height: `${heightPercent}%`,
                          background: isLatest
                            ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                            : item.views > 0
                            ? 'linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)'
                            : '#e2e8f0',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                          boxShadow: isLatest ? '0 2px 4px rgba(37, 99, 235, 0.3)' : 'none'
                        }} />

                        {/* Label beneath bar */}
                        <span style={{
                          position: 'absolute',
                          bottom: '0',
                          fontSize: '9.5px',
                          color: isLatest ? '#1d4ed8' : '#64748b',
                          fontWeight: isLatest ? '800' : '600',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%'
                        }}>
                          {statTab === 'daily'
                            ? item.label.split(' ')[0]
                            : statTab === 'weekly'
                            ? item.label.split(' ')[0]
                            : item.label.split(' ')[1] || item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Table */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700' }}>기간 / 일자</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>조회수</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>비중</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentStats].reverse().map((item) => {
                      const share = totalViews > 0 ? ((item.views / totalViews) * 100).toFixed(1) : '0';
                      return (
                        <tr
                          key={item.period}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1e293b' }}>
                            {item.label}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: item.views > 0 ? '#2563eb' : '#94a3b8' }}>
                            {item.views.toLocaleString()}회
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#fafafa',
          borderRadius: '0 0 16px 16px'
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 18px', fontSize: '13px' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
