export type UserRole = 'server_admin' | 'head_admin' | 'media_admin' | 'member' | 'guest';

export interface User {
  id: number;
  username: string;
  name: string;
  cell_name: string;
  role: UserRole;
  cell_verified: number;
  is_guest?: boolean;
  acquaintance_name?: string;
  created_at?: string;
  is_leader?: boolean;
  leader_clubs?: string[];
}

export interface Club {
  id: number;
  name: string;
  icon: string;
  description: string;
  manager_names: string;
  manager_ids?: string[];
  member_count?: number;
  view_count?: number;
  created_at?: string;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  author_name: string;
  is_pinned: number;
  is_active?: number;
  created_at: string;
}

export interface PollHighlight {
  id: number;
  club_id: number;
  club_name: string;
  poll_title: string;
  end_date: string;
  voters_count: number;
  total_members?: number;
}

export interface ScheduleHighlight {
  id: number;
  club_id: number;
  club_name: string;
  club_icon?: string;
  title: string;
  event_date: string;
  location?: string;
  fee_info?: string;
  attendees_count: number;
  total_members?: number;
  is_attending?: boolean;
}

export interface MemberItem {
  id: number;
  username: string;
  name: string;
  cell_name: string;
  role?: UserRole;
  is_leader?: boolean;
  leader_clubs?: string[];
}

export interface PopupItem {
  id: number;
  title: string;
  content_text: string;
  image_url?: string;
  end_date: string;
  is_active: number;
  updated_at?: string;
}

export interface CellItem {
  id: number;
  name: string;
  member_count?: number;
  created_at?: string;
}

export interface WelcomeSettings {
  welcome_tagline: string;
  welcome_message: string;
  group_name?: string;
  is_targeted?: boolean;
}

export interface TargetedWelcomeItem {
  id: number;
  group_name: string;
  welcome_tagline: string;
  welcome_message: string;
  user_ids: number[];
  target_users?: { id: number; name: string; cell_name: string }[];
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ServerMetrics {
  traffic: {
    active_sessions: number;
    total_posts: number;
  };
  total_members: number;
  total_guests?: number;
  security: {
    is_locked: boolean;
    fail_count: number;
    cooldown_until: number;
  };
}

export interface Attendee {
  userId: number;
  userName: string;
  cellName: string;
}

export interface ClubPollItem {
  id: number;
  club_id: number;
  title: string;
  description?: string;
  options: string[];
  end_date: string;
  is_closed: number;
  is_pinned?: number;
  creator_name: string;
  created_at: string;
  total_votes: number;
  option_counts: Record<string, number>;
  my_vote: string | null;
  is_expired: boolean;
  comments?: ClubCommentItem[];
}

export interface ClubCommentItem {
  id: number;
  post_id?: number;
  schedule_id?: number;
  poll_id?: number;
  parent_comment_id?: number | null;
  user_id: number;
  user_name: string;
  user_cell: string;
  content: string;
  created_at: string;
}

export interface ManagerHandoverVoteItem {
  id: number;
  club_id: number;
  proposer_id: number;
  proposer_name: string;
  target_user_id: number;
  target_user_name: string;
  action_type: 'appoint' | 'dismiss';
  agreed_user_ids: number[];
  has_agreed: boolean;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}

export interface ClubPostItem {
  id: number;
  club_id: number;
  user_id: number;
  user_name: string;
  user_cell: string;
  content: string;
  image_url?: string;
  is_pinned?: number;
  created_at: string;
  comments?: ClubCommentItem[];
  reactions?: Record<string, number>;
  my_reactions?: string[];
}

export interface ClubScheduleItem {
  id: number;
  club_id: number;
  title: string;
  event_date: string;
  location: string;
  fee_info: string;
  attendees: Attendee[];
  creator_name: string;
  created_at: string;
  is_attending: boolean;
  is_pinned?: number;
  comments?: ClubCommentItem[];
  reactions?: Record<string, number>;
  my_reactions?: string[];
}

export interface ClubPhotoItem {
  id: number;
  club_id: number;
  user_id: number;
  user_name: string;
  image_url: string;
  caption: string;
  created_at: string;
}

export interface ClubDetailData {
  paginated?: boolean;
  nextCursor?: string | null;
  club: Club;
  isManager: boolean;
  polls: ClubPollItem[];
  posts: ClubPostItem[];
  schedules: ClubScheduleItem[];
  photos: ClubPhotoItem[];
  handoverVotes?: ManagerHandoverVoteItem[];
  churchMembers?: MemberItem[];
}

export interface PeriodStatItem {
  period: string; // e.g. "2026-09-25", "2026-W39", "2026-09"
  label: string;  // e.g. "9월 25일 (금)", "9월 4주차", "2026년 9월"
  views: number;
}

export interface ClubAnalyticsData {
  club_id: number;
  club_name: string;
  club_icon: string;
  total_views: number;
  today_views: number;
  this_week_views: number;
  this_month_views: number;
  daily: PeriodStatItem[];
  weekly: PeriodStatItem[];
  monthly: PeriodStatItem[];
}

export interface MultiClubAnalyticsSummary {
  all_total_views: number;
  all_today_views: number;
  all_this_week_views: number;
  all_this_month_views: number;
  clubs: ClubAnalyticsData[];
}


