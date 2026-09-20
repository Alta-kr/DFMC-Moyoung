export type UserRole = 'server_admin' | 'head_admin' | 'media_admin' | 'member';

export interface User {
  id: number;
  username: string;
  name: string;
  cell_name: string;
  role: UserRole;
  cell_verified: number;
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
  member_count?: number;
  created_at?: string;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  author_name: string;
  is_pinned: number;
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
}

export interface ServerMetrics {
  traffic: {
    today: number;
    total: number;
  };
  storage: {
    used_bytes: number;
    limit_bytes: number;
    used_mb: string;
    limit_mb: number;
    percentage: string;
  };
  total_members: number;
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
  creator_name: string;
  created_at: string;
  total_votes: number;
  option_counts: Record<string, number>;
  my_vote: string | null;
  is_expired: boolean;
}

export interface ClubPostItem {
  id: number;
  club_id: number;
  user_id: number;
  user_name: string;
  user_cell: string;
  content: string;
  image_url?: string;
  created_at: string;
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
  club: Club;
  isManager: boolean;
  polls: ClubPollItem[];
  posts: ClubPostItem[];
  schedules: ClubScheduleItem[];
  photos: ClubPhotoItem[];
}
