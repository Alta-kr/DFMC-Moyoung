import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';

// 1. Initial Seed Data
const DEFAULT_CELLS = [
  '둔산제일교회',
  '1청년부 1셀',
  '1청년부 2셀',
  '1청년부 3셀',
  '2청년부 1셀',
  '2청년부 2셀',
  '장년 1셀',
  '장년 2셀',
  '새가족부'
];

const KOREAN_NAMES = [
  '이주환', '강동원', '김민준', '박민수', '이서준', '박도윤', '최영호', '김지은', '정예준', '정다은',
  '최시우', '강하준', '조주원', '윤건우', '임선우', '한서진', '오연우', '신민재', '유현우', '배지호',
  '백지훈', '송우진', '고도현', '문건우', '양승민', '손민성', '권태양', '황준혁', '안지환', '송민규',
  '전태윤', '홍승현', '구진우', '류재원', '곽동하', '심정우', '노시환', '하선호', '곽민혁', '문준서',
  '성시우', '차우진', '우진성', '주선율', '민현우', '진도훈', '변도현', '여승우', '추민재', '도하준',
  '강민서', '김서연', '이서윤', '박지우', '정서현', '최하은', '조하윤', '윤서아', '장지아', '임지유',
  '한채원', '오수아', '서다은', '신예은', '권지원', '황수빈', '안소은', '송예린', '전하린', '홍유나',
  '유서하', '고하은', '문채은', '양지안', '손소율', '배채윤', '조예원', '백시아', '허서율', '유은서',
  '남하율', '심지민', '노다온', '정아린', '하가은', '곽소윤', '성시은', '차예나', '변서영', '우수아',
  '주채원', '민다인', '진서은', '여가은', '도유빈', '구예나', '강서하', '배수현', '신유진', '임예솔'
];

let isInitialized = false;

export async function ensureFirebaseSeeded() {
  if (isInitialized) return;
  if (typeof window !== 'undefined' && localStorage.getItem('dfmc_seeded_v1') === 'true') {
    isInitialized = true;
    return;
  }
  try {
    // Check if cells exist
    const cellsSnap = await getDocs(collection(db, 'cells'));
    if (cellsSnap.empty) {
      console.log('🌱 Seeding initial Firestore data for DFMC Moyoung...');
      // 1. Seed Cells
      for (let i = 0; i < DEFAULT_CELLS.length; i++) {
        const name = DEFAULT_CELLS[i];
        await setDoc(doc(db, 'cells', `cell_${i + 1}`), {
          id: i + 1,
          name,
          created_at: new Date().toISOString()
        });
      }

      // 2. Seed Lobby Settings
      await setDoc(doc(db, 'lobby_settings', 'main'), {
        welcome_tagline: '은혜와 교제가 넘치는 둔산제일교회 모영',
        welcome_message: '이번 주에도 모영에서 기쁨의 교제 함께해요.',
        updated_at: new Date().toISOString()
      });

      // 3. Seed Notice
      await setDoc(doc(db, 'notices', 'notice_1'), {
        id: 1,
        title: '2026년 상반기 둔산제일교회 모영 활동 안내 및 친교 주간',
        content: '할렐루야! 성도님들의 친교와 영적 성장을 위해 상반기 모영이 활발히 진행됩니다. 각 모영에 참석하시어 풍성한 은혜를 나누시기 바랍니다.',
        author_id: 2,
        author_name: '김목사',
        is_pinned: 1,
        created_at: new Date().toISOString()
      });

      // 4. Seed Popup
      await setDoc(doc(db, 'popups', 'popup_1'), {
        id: 1,
        title: '새봄맞이 전교인 모영 축제 안내',
        content_text: '모든 성도님들의 많은 관심과 참여 바랍니다.',
        image_url: '',
        end_date: '2026-12-31',
        is_active: 1,
        updated_at: new Date().toISOString()
      });

      // 5. Seed Core Admin & Demo Users
      const coreUsers = [
        { id: 1, username: 'dfmc8470', name: '서버관리자', cell_name: '둔산제일교회', role: 'server_admin' },
        { id: 2, username: 'pastor', name: '김목사', cell_name: '둔산제일교회', role: 'head_admin' },
        { id: 3, username: 'member1', name: '홍길동', cell_name: '1청년부 1셀', role: 'member' },
        { id: 4, username: 'member2', name: '이은혜', cell_name: '1청년부 2셀', role: 'member' }
      ];

      for (const u of coreUsers) {
        await setDoc(doc(db, 'users', u.username), {
          ...u,
          cell_verified: 1,
          created_at: new Date().toISOString()
        });
      }

      // 6. Seed 100 Korean Members
      for (let i = 0; i < KOREAN_NAMES.length; i++) {
        const uid = i + 5;
        const uname = `user${i + 1}`;
        const name = KOREAN_NAMES[i];
        const cell = DEFAULT_CELLS[i % DEFAULT_CELLS.length];
        await setDoc(doc(db, 'users', uname), {
          id: uid,
          username: uname,
          name,
          cell_name: cell,
          role: 'member',
          cell_verified: 1,
          created_at: new Date().toISOString()
        });
      }

      // 7. Seed 4 Major Clubs
      const majorClubs = [
        {
          id: 1,
          name: '풋살 모영',
          icon: '⚽',
          description: '풋살과 축구를 통해 건강과 은혜로운 교제를 나누는 모임입니다.',
          manager_names: '이주환, 강동원, 김민준',
          member_count: 28
        },
        {
          id: 2,
          name: '배드민턴 모영',
          icon: '🏸',
          description: '매주 토요일 체육관에서 땀 흘리며 친교하는 배드민턴 클럽입니다.',
          manager_names: '박민수, 이서준, 박도윤',
          member_count: 35
        },
        {
          id: 3,
          name: '볼링 모영',
          icon: '🎳',
          description: '남녀노소 누구나 즐겁게 스트라이크를 치며 스트레스를 날려요!',
          manager_names: '최영호, 김지은, 정예준',
          member_count: 19
        },
        {
          id: 4,
          name: '독서 모영',
          icon: '📚',
          description: '한 달에 한 권 신앙 서적과 인문학 도서를 읽고 마음을 나누는 시간.',
          manager_names: '정다은, 최시우, 강하준',
          member_count: 24
        }
      ];

      for (const c of majorClubs) {
        await setDoc(doc(db, 'clubs', String(c.id)), {
          ...c,
          created_at: new Date().toISOString()
        });
      }

      // 8. Seed sample schedules & polls for Futsal
      await setDoc(doc(db, 'club_schedules', 'sched_1'), {
        id: 1,
        club_id: 1,
        title: '토요일 정기 풋살 경기',
        event_date: '2026-10-10 14:00',
        location: '대전 유성구 풋살파크',
        fee_info: '10,000원',
        attendees: [
          { user_id: 5, user_name: '이주환', user_cell: '1청년부 1셀', joined_at: new Date().toISOString() },
          { user_id: 6, user_name: '강동원', user_cell: '1청년부 2셀', joined_at: new Date().toISOString() }
        ],
        is_pinned: 1,
        creator_name: '이주환',
        created_at: new Date().toISOString()
      });

      await setDoc(doc(db, 'club_polls', 'poll_1'), {
        id: 1,
        club_id: 1,
        title: '10월 풋살 유니폼 색상 투표',
        description: '올해 하반기 우리 모영의 공식 팀 유니폼 색상을 결정합니다!',
        options: ['블랙 & 골드', '화이트 & 블루', '네이비'],
        end_date: '2026-10-31',
        is_closed: 0,
        is_pinned: 1,
        creator_id: 5,
        creator_name: '이주환',
        votes: [
          { user_id: 5, user_name: '이주환', selected_option: '블랙 & 골드', voted_at: new Date().toISOString() }
        ],
        created_at: new Date().toISOString()
      });

      console.log('✅ Firestore Seed Data Completed Successfully!');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('dfmc_seeded_v1', 'true');
    }
    isInitialized = true;
  } catch (err) {
    console.warn('Firestore seeding check:', err);
  }
}

// 2. Storage Upload with Auto Compression & Bulletproof Fallbacks
export async function uploadImageFile(file: File): Promise<string> {
  let blobToUpload: Blob;
  try {
    // Compress with safety timeout
    blobToUpload = await compressImage(file, 1200, 0.75);
  } catch (err) {
    console.warn('Image compression fallback to original file:', err);
    blobToUpload = file;
  }

  // Try Firebase Storage with 5s timeout, otherwise fallback to DataURL
  try {
    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const storageRef = ref(storage, fileName);

    const uploadPromise = uploadBytes(storageRef, blobToUpload).then(() => getDownloadURL(storageRef));
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 5000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (storageErr) {
    console.warn('Storage upload failed or timed out, using local DataURL fallback:', storageErr);
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => {
        // Last resort: object URL
        resolve(URL.createObjectURL(blobToUpload));
      };
      reader.readAsDataURL(blobToUpload);
    });
  }
}

// Image compression helper: resize + JPEG quality reduction with timeout & error protection
function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    // If not an image type, resolve immediately with original
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    const timeout = setTimeout(() => {
      console.warn('Image compression timed out, using original file');
      resolve(file);
    }, 4000);

    const reader = new FileReader();
    reader.onerror = () => {
      clearTimeout(timeout);
      resolve(file);
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(file);
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeout);
            return resolve(file);
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);
              resolve(blob || file);
            },
            'image/jpeg',
            quality
          );
        } catch (canvasErr) {
          console.warn('Canvas compression error:', canvasErr);
          clearTimeout(timeout);
          resolve(file);
        }
      };
      img.src = (e.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  });
}
