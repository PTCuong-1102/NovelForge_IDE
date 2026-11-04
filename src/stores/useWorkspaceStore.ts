import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ChapterDocument,
  CharacterRelationEdge,
  LoreEntity,
  StorySnapshot,
  ThemeMode,
} from '@/lib/tauri-bridge';

export type LeftActivityView =
  | 'explorer'
  | 'lorebook'
  | 'search'
  | 'git'
  | 'inspector';

export type CenterTabType =
  | 'chapter'
  | 'lore-entity'
  | 'lore-database'
  | 'relationship-graph'
  | 'timeline-board';

export interface OpenWorkbenchTab {
  id: string;
  title: string;
  type: CenterTabType;
  targetId: string;
  pane: 'primary' | 'secondary';
}

interface WorkspaceState {
  projectName: string;
  theme: ThemeMode;
  activeActivity: LeftActivityView;
  leftSidebarOpen: boolean;
  rightDockOpen: boolean;
  zenMode: boolean;
  splitView: boolean;
  activeBranch: string;
  availableBranches: string[];
  saveStatus: 'saved' | 'saving' | 'unsaved';

  openTabs: OpenWorkbenchTab[];
  activePrimaryTabId: string;
  activeSecondaryTabId: string | null;

  chapters: ChapterDocument[];
  entities: LoreEntity[];
  relations: CharacterRelationEdge[];
  snapshots: StorySnapshot[];

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setActiveActivity: (view: LeftActivityView) => void;
  toggleLeftSidebar: () => void;
  toggleRightDock: () => void;
  toggleZenMode: () => void;
  toggleSplitView: () => void;
  openTab: (tab: Omit<OpenWorkbenchTab, 'pane'>, pane?: 'primary' | 'secondary') => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string, pane: 'primary' | 'secondary') => void;

  updateChapterParagraphs: (chapterId: string, paragraphs: string[]) => void;
  updateChapterMetadata: (chapterId: string, patch: Partial<ChapterDocument>) => void;
  updateEntity: (entityId: string, patch: Partial<LoreEntity>) => void;
  createEntity: (entity: LoreEntity) => void;
  createChapter: (title: string) => void;
  reorderChapters: (fromIndex: number, toIndex: number) => void;
  applyRefactorRename: (
    entityId: string,
    newName: string,
    newAliases: string[],
    selectedMatchIds: Set<string>,
    aliasMap: { from: string; to: string }[]
  ) => void;
  createGitSnapshot: (label: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  createWhatIfBranch: (branchName: string) => void;
  switchBranch: (branchName: string) => void;
  resetToDefaults: () => void;
  exportProjectJson: () => string;
  importProjectJson: (jsonString: string) => boolean;
}

const INITIAL_ENTITIES: LoreEntity[] = [
  {
    id: 'char_linh_001',
    entity_type: 'character',
    title: 'Lâm Vũ Linh',
    aliases: ['Tiểu Linh', 'Đặc vụ số 7'],
    file_path: 'lorebook/characters/lam-vu-linh.md',
    status: 'alive',
    birth_year: 2001,
    age_at_story: 25,
    faction: 'Cục An Ninh Mạng Aegis',
    role: 'Nhân vật chính (Protagonist)',
    appearance: 'Tóc ngắn ngang vai, vết sẹo nhỏ ở cổ tay trái, áo khoác đen chống thấm',
    personality: 'Lạnh lùng, quyết đoán, sợ không gian hẹp nhưng cực kỳ bình tĩnh khi đấu súng',
    tags: ['nhân vật chính', 'hacker', 'đặc vụ'],
    summary:
      'Cựu đặc vụ giải mã tín hiệu ngầm của Aegis, người duy nhất nắm giữ khóa giải mã Dự án Thần Nông.',
    body: `# Tiểu sử nhân vật: Lâm Vũ Linh\n\nSinh năm 2001 tại khu cảng cũ. Sau biến cố sập hầm ngầm năm 19 tuổi, cô mắc chứng sợ không gian hẹp nhưng trở thành chuyên gia xâm nhập hệ thống hàng đầu của Aegis.\n\n## Kỹ năng đặc biệt\n- Giải mã giao thức lượng tử thời gian thực\n- Chiến đấu cận chiến tầm ngắn với súng lục giảm thanh`,
    updated_at: '2026-11-03T22:15:00Z',
  },
  {
    id: 'char_hao_002',
    entity_type: 'character',
    title: 'Trần Hạo',
    aliases: ['Bóng Ma Cảng Đông', 'Hạo Đen'],
    file_path: 'lorebook/characters/tran-hao.md',
    status: 'dead',
    birth_year: 1995,
    age_at_story: 31,
    faction: 'Tổ chức Chợ Đen Hắc Hải',
    role: 'Phản diện phụ / Tình báo hai mang',
    appearance: 'Cao gầy, mắt phải đeo kính thông minh gọng bạc, luôn mang bật lửa đồng cổ',
    personality: 'Thực dụng, đa nghi, luôn chuẩn bị 3 đường lui',
    death_chapter_order: 5,
    death_chapter_title: 'Chương 5: Huyết Chiến Nhà Kho Số 4',
    death_date: '12/10/2026',
    tags: ['phản diện', 'tình báo', 'đã tử vong'],
    summary:
      'Tay buôn tin tình báo ngầm tại Bến Cảng Đông. Đã bị bắn hạ tại Chương 5 ngày 12/10/2026 khi cố kích hoạt bom từ trường.',
    body: `# Hồ sơ: Trần Hạo\n\nKẻ nắm giữ danh sách đặc vụ ngầm tại Bến Cảng Đông. Đã tử vong tại Chương 5 (12/10/2026) dưới tay sát thủ của Hắc Thủy.`,
    updated_at: '2026-11-03T21:40:00Z',
  },
  {
    id: 'char_khanh_003',
    entity_type: 'character',
    title: 'Vũ Đình Khánh',
    aliases: ['Chỉ huy Khánh', 'Lão già Aegis'],
    file_path: 'lorebook/characters/vu-dinh-khanh.md',
    status: 'alive',
    birth_year: 1974,
    age_at_story: 52,
    faction: 'Cục An Ninh Mạng Aegis',
    role: 'Người dẫn dắt (Mentor)',
    appearance: 'Tóc điểm bạc, mặc măng tô xám, giọng nói trầm khàn',
    personality: 'Điềm tĩnh, thâm trầm, che giấu bí mật về cái chết của cha Linh',
    tags: ['mentor', 'chỉ huy', 'aegis'],
    summary:
      'Người trực tiếp tuyển mộ Lâm Vũ Linh vào Đội Đặc Nhiệm số 7 và giao nhiệm vụ điều tra Bến Cảng Đông.',
    body: `# Hồ sơ: Vũ Đình Khánh\n\nPhó cục trưởng Aegis phụ trách các chiến dịch ngoài luồng.`,
    updated_at: '2026-11-03T20:10:00Z',
  },
  {
    id: 'char_my_004',
    entity_type: 'character',
    title: 'Kiều Hạ My',
    aliases: ['Chim Bói Cá', 'Bác sĩ My'],
    file_path: 'lorebook/characters/kieu-ha-my.md',
    status: 'alive',
    birth_year: 2000,
    age_at_story: 26,
    faction: 'Trạm Y Tế Ngầm Khu Nam',
    role: 'Đồng minh kỹ thuật / Pháp y',
    appearance: 'Đeo kính tròn, áo blouse trắng vấy mực, tay luôn cầm máy quét sinh trắc',
    personality: 'Hài hước châm biếm, cực kỳ nhạy bén với dấu vết chất độc',
    tags: ['đồng minh', 'pháp y', 'hậu cần'],
    summary:
      'Bác sĩ pháp y ngầm chuyên cung cấp thiết bị y tế và phân tích mẫu sinh học cho Tiểu Linh.',
    body: `# Hồ sơ: Kiều Hạ My\n\nBạn học cũ của Lâm Vũ Linh tại học viện kỹ thuật sinh học.`,
    updated_at: '2026-11-03T19:00:00Z',
  },
  {
    id: 'loc_cang_dong',
    entity_type: 'location',
    title: 'Bến Cảng Đông',
    aliases: ['Cảng Đông', 'Khu Container 14'],
    file_path: 'lorebook/locations/ben-cang-dong.md',
    status: 'active',
    faction: 'Vùng trung lập Hắc Hải',
    role: 'Bối cảnh chiến đấu chính Hồi 1',
    tags: ['địa danh', 'cảng biển', 'nguy hiểm'],
    summary:
      'Khu cảng công nghiệp bỏ hoang phía đông thành phố, nơi tập kết hàng ngàn thùng container rỉ sét và trạm trung chuyển dữ liệu lậu.',
    body: `# Địa danh: Bến Cảng Đông\n\nQuanh năm sương mù và mưa axit nhẹ. Hệ thống cẩu trục tự động đã ngừng hoạt động từ năm 2022.`,
    updated_at: '2026-11-03T18:30:00Z',
  },
  {
    id: 'loc_thap_aegis',
    entity_type: 'location',
    title: 'Tháp Chỉ Huy Aegis',
    aliases: ['Pháo Đài Kính', 'Tổng Hành Dinh'],
    file_path: 'lorebook/locations/thap-aegis.md',
    status: 'active',
    faction: 'Cục An Ninh Mạng Aegis',
    role: 'Tổng hành dinh',
    tags: ['địa danh', 'trung tâm'],
    summary: 'Tòa tháp 88 tầng tại trung tâm Quận 1, đặt máy chủ lượng tử trung tâm.',
    body: `# Địa danh: Tháp Chỉ Huy Aegis\n\nAn ninh 5 lớp sinh trắc học.`,
    updated_at: '2026-11-03T18:00:00Z',
  },
  {
    id: 'item_khoa_than_nong',
    entity_type: 'item',
    title: 'Ổ Khóa Lượng Tử Thần Nông',
    aliases: ['Lõi Thần Nông', 'Chip Đỏ'],
    file_path: 'lorebook/items/khoa-luong-tu-than-nong.md',
    status: 'active',
    role: 'Vật phẩm cốt lõi (MacGuffin)',
    tags: ['vật phẩm', 'công nghệ cao'],
    summary:
      'Thiết bị lưu trữ khóa mật mã có khả năng mở toàn bộ hồ sơ đen của Dự án Thần Nông.',
    body: `# Vật phẩm: Ổ Khóa Lượng Tử Thần Nông\n\nChỉ kích hoạt bằng nhịp tim của Lâm Vũ Linh.`,
    updated_at: '2026-11-03T17:30:00Z',
  },
];

const INITIAL_CHAPTERS: ChapterDocument[] = [
  {
    id: 'ch_01',
    act_id: 'act_01',
    act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
    order: 1,
    title: 'Chương 1: Bản Giao Thức Lúc Nửa Đêm',
    file_path: 'manuscript/act-01/ch-01-khoi-dau.md',
    status: 'completed',
    pov_character_id: 'char_linh_001',
    pov_character_name: 'Lâm Vũ Linh',
    story_date: '02/10/2026',
    story_year: 2026,
    location_id: 'loc_thap_aegis',
    location_tag: '#Tháp_Chỉ_Huy_Aegis',
    target_words: 1200,
    is_flashback: false,
    paragraphs: [
      'Ánh đèn neon từ Tháp Chỉ Huy Aegis hắt xuống mặt bàn kính lạnh buốt. Lâm Vũ Linh tháo tai nghe giải mã, ngón tay khẽ chạm vào vết sẹo nhỏ ở cổ tay trái khi dòng tín hiệu lạ bất ngờ nhấp nháy trên màn hình trung tâm.',
      'Chỉ huy Khánh đẩy cửa bước vào, đặt tập hồ sơ mật mang dấu niêm phong đỏ trước mặt Tiểu Linh. Tín hiệu phát ra từ Bến Cảng Đông — nơi tưởng chừng đã bị bỏ hoang từ bốn năm trước.',
      'Kiều Hạ My gửi qua kênh liên lạc nội bộ một cảnh báo ngắn: kẻ trung gian Trần Hạo đã xuất hiện tại khu chợ đen cùng manh mối về Ổ Khóa Lượng Tử Thần Nông.',
    ],
    updated_at: '2026-11-01T19:00:00Z',
  },
  {
    id: 'ch_02',
    act_id: 'act_01',
    act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
    order: 2,
    title: 'Chương 2: Bóng Đen Dưới Cầu Tàu',
    file_path: 'manuscript/act-01/ch-02-bien-co.md',
    status: 'completed',
    pov_character_id: 'char_linh_001',
    pov_character_name: 'Lâm Vũ Linh',
    story_date: '05/10/2026',
    story_year: 2026,
    location_id: 'loc_cang_dong',
    location_tag: '#Bến_Cảng_Đông',
    target_words: 1800,
    is_flashback: false,
    paragraphs: [
      'Lớp sương mù dày đặc che phủ những cần cẩu sắt rỉ sét tại Bến Cảng Đông. Lâm Vũ Linh kéo cao cổ áo khoác chống thấm, từng bước len lỏi qua các dãy container số 14.',
      'Mùi rỉ sắt và dầu máy hòa lẫn trong không khí mặn chát của biển đêm. Ở đằng xa, một bóng người gầy gò với chiếc kính thông minh lóe sáng trong bóng tối — Trần Hạo đang đếm những vali dữ liệu ngầm.',
      'Tiểu Linh rút khẩu súng giảm thanh, nhưng tiếng động cơ cano tuần tra của Aegis từ ngoài vịnh bất ngờ vang lên, phá vỡ sự im lặng của cuộc giao dịch.',
    ],
    updated_at: '2026-11-02T10:00:00Z',
  },
  {
    id: 'ch_05',
    act_id: 'act_01',
    act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
    order: 5,
    title: 'Chương 5: Huyết Chiến Nhà Kho Số 4',
    file_path: 'manuscript/act-01/ch-05-nha-kho-so-4.md',
    status: 'completed',
    pov_character_id: 'char_linh_001',
    pov_character_name: 'Lâm Vũ Linh',
    story_date: '12/10/2026',
    story_year: 2026,
    location_id: 'loc_cang_dong',
    location_tag: '#Bến_Cảng_Đông',
    target_words: 1500,
    is_flashback: false,
    paragraphs: [
      'Trong không gian ngập mùi dầu máy tại Bến Cảng Đông, Lâm Vũ Linh áp sát vách thép nhà kho số 4. Trần Hạo đứng trên cầu thang sắt, tay nắm chặt chiếc bật lửa đồng cổ nhằm kích hoạt ngòi nổ từ trường.',
      'Một phát đạn bắn tỉa từ phía bóng tối xuyên qua lớp kính chắn gió. Trần Hạo ngã gục xuống sàn thép, chiếc Ổ Khóa Lượng Tử Thần Nông văng khỏi tay hắn trước khi đội sát thủ Hắc Hải rút lui.',
      'Bác sĩ My xác nhận qua cảm biến sinh tồn từ xa: nhịp tim của Trần Hạo đã ngừng đập hoàn toàn vào lúc 23:40 ngày 12/10/2026.',
    ],
    updated_at: '2026-11-02T21:00:00Z',
  },
  {
    id: 'ch_07',
    act_id: 'act_01',
    act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
    order: 7,
    title: 'Chương 7: Mật Mã Dưới Lớp Sương',
    file_path: 'manuscript/act-01/ch-07-mat-ma.md',
    status: 'completed',
    pov_character_id: 'char_linh_001',
    pov_character_name: 'Lâm Vũ Linh',
    story_date: '14/10/2026',
    story_year: 2026,
    location_id: 'loc_thap_aegis',
    location_tag: '#Tháp_Chỉ_Huy_Aegis',
    target_words: 1400,
    is_flashback: false,
    paragraphs: [
      'Trở về phòng thí nghiệm ngầm của Kiều Hạ My, Lâm Vũ Linh cắm Lõi Thần Nông vào trạm giải mã độc lập. Từng lớp dữ liệu bị khóa hé lộ tọa độ cầu tàu số 9 tại Bến Cảng Đông.',
      'Vũ Đình Khánh dặn Tiểu Linh không được tự ý hành động, nhưng cô nhận ra có kẻ nội gián ngay trong hàng ngũ Tháp Chỉ Huy Aegis đang theo dõi mọi bước đi của Đặc vụ số 7.',
    ],
    updated_at: '2026-11-03T18:00:00Z',
  },
  {
    id: 'ch_08',
    act_id: 'act_01',
    act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
    order: 8,
    title: 'Chương 8: Đêm Mưa Tại Bến Cảng',
    file_path: 'manuscript/act-01/ch-08-dem-mua-ben-cang.md',
    status: 'editing',
    pov_character_id: 'char_linh_001',
    pov_character_name: 'Lâm Vũ Linh',
    story_date: '15/10/2026',
    story_year: 2026,
    location_id: 'loc_cang_dong',
    location_tag: '#Bến_Cảng_Đông',
    target_words: 4000,
    is_flashback: false,
    paragraphs: [
      'Mưa như trút nước xuống Bến Cảng Đông. Gió biển thổi qua những dãy thùng hàng tạo nên âm thanh lạnh lẽo giữa màn đêm lạnh lẽo, phủ lên mặt cầu tàu một lớp sương lạnh lẽo đến tê người.',
      'Lâm Vũ Linh siết chặt khẩu súng giảm thanh trong tay, ánh mắt sắc lạnh quét qua dãy container số 14. Cô không ngờ Trần Hạo lại xuất hiện ngay phía sau cần cẩu rỉ sét và chĩa súng về phía mình.',
      'Cô bước lùi lại phía sau thùng hàng, cố giữ nhịp thở ổn định trong khi tín hiệu từ Ổ Khóa Lượng Tử Thần Nông bắt đầu phát sáng dưới lớp áo khoác.',
      'Qua bộ đàm tần số thấp, giọng Kiều Hạ My vang lên đứt quãng cảnh báo rằng đội truy kích từ Tháp Chỉ Huy Aegis của Chỉ huy Khánh sẽ phong tỏa toàn bộ Cảng Đông trong vòng bảy phút nữa.',
    ],
    updated_at: '2026-11-03T23:50:00Z',
  },
];

const INITIAL_RELATIONS: CharacterRelationEdge[] = [
  {
    id: 'rel-1',
    source_id: 'char_khanh_003',
    target_id: 'char_linh_001',
    label: 'Chỉ huy / Sư đồ',
    relation_type: 'mentor',
    min_chapter: 1,
    max_chapter: 20,
  },
  {
    id: 'rel-2',
    source_id: 'char_linh_001',
    target_id: 'char_my_004',
    label: 'Đồng minh sinh tử',
    relation_type: 'ally',
    min_chapter: 1,
    max_chapter: 20,
  },
  {
    id: 'rel-3',
    source_id: 'char_linh_001',
    target_id: 'char_hao_002',
    label: 'Kẻ thù truy đuổi',
    relation_type: 'enemy',
    min_chapter: 1,
    max_chapter: 20,
  },
  {
    id: 'rel-4',
    source_id: 'char_khanh_003',
    target_id: 'char_hao_002',
    label: 'Giao dịch ngầm / Phản bội',
    relation_type: 'betrayal',
    min_chapter: 5,
    max_chapter: 20,
  },
];

const INITIAL_SNAPSHOTS: StorySnapshot[] = [
  {
    id: 'snap-01',
    branch_name: 'main',
    label: 'Hoàn tất Chương 5 — Trần Hạo tử vong tại Nhà Kho Số 4',
    timestamp: '2026-11-02 21:05',
    word_count_delta: 420,
    total_words: 2890,
    chapter_snapshots: {},
  },
  {
    id: 'snap-02',
    branch_name: 'main',
    label: 'Bản nháp Chương 8 — Đêm mưa tại Bến Cảng Đông',
    timestamp: '2026-11-03 23:50',
    word_count_delta: 530,
    total_words: 3420,
    chapter_snapshots: {},
  },
];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      projectName: 'Huyết Cảng 2026',
      theme: 'obsidian',
      activeActivity: 'explorer',
      leftSidebarOpen: true,
      rightDockOpen: true,
      zenMode: false,
      splitView: false,
      activeBranch: 'main',
      availableBranches: [
        'main',
        'what-if/tran-hao-con-song',
        'what-if/linh-phan-boi-aegis',
      ],
      saveStatus: 'saved',

      openTabs: [
        {
          id: 'tab-ch-08',
          title: 'Ch.08: Đêm Mưa Tại Bến Cảng',
          type: 'chapter',
          targetId: 'ch_08',
          pane: 'primary',
        },
        {
          id: 'tab-char-linh',
          title: 'Lâm Vũ Linh',
          type: 'lore-entity',
          targetId: 'char_linh_001',
          pane: 'primary',
        },
        {
          id: 'tab-lore-db',
          title: 'Lorebook Database',
          type: 'lore-database',
          targetId: 'lore-all',
          pane: 'secondary',
        },
      ],
      activePrimaryTabId: 'tab-ch-08',
      activeSecondaryTabId: 'tab-lore-db',

      chapters: INITIAL_CHAPTERS,
      entities: INITIAL_ENTITIES,
      relations: INITIAL_RELATIONS,
      snapshots: INITIAL_SNAPSHOTS,

      setTheme: (theme) => set({ theme }),

      setActiveActivity: (view) =>
        set((state) => ({
          activeActivity: view,
          leftSidebarOpen:
            state.activeActivity === view ? !state.leftSidebarOpen : true,
        })),

      toggleLeftSidebar: () =>
        set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),

      toggleRightDock: () =>
        set((state) => ({ rightDockOpen: !state.rightDockOpen })),

      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

      toggleSplitView: () =>
        set((state) => {
          const nextSplit = !state.splitView;
          return {
            splitView: nextSplit,
            activeSecondaryTabId: state.activeSecondaryTabId || 'tab-lore-db',
          };
        }),

      openTab: (newTab, pane = 'primary') =>
        set((state) => {
          const existing = state.openTabs.find(
            (t) => t.targetId === newTab.targetId && t.type === newTab.type
          );
          if (existing) {
            if (pane === 'secondary') {
              return {
                splitView: true,
                activeSecondaryTabId: existing.id,
              };
            }
            return { activePrimaryTabId: existing.id };
          }

          const created: OpenWorkbenchTab = { ...newTab, pane };
          return {
            openTabs: [...state.openTabs, created],
            ...(pane === 'secondary'
              ? { splitView: true, activeSecondaryTabId: created.id }
              : { activePrimaryTabId: created.id }),
          };
        }),

      closeTab: (tabId) =>
        set((state) => {
          if (state.openTabs.length <= 1) return state;
          const filtered = state.openTabs.filter((t) => t.id !== tabId);
          let nextPrimary = state.activePrimaryTabId;
          if (nextPrimary === tabId) {
            nextPrimary = filtered[0]?.id || '';
          }
          return {
            openTabs: filtered,
            activePrimaryTabId: nextPrimary,
          };
        }),

      setActiveTab: (tabId, pane) =>
        set(() =>
          pane === 'secondary'
            ? { activeSecondaryTabId: tabId }
            : { activePrimaryTabId: tabId }
        ),

      updateChapterParagraphs: (chapterId, paragraphs) =>
        set((state) => ({
          saveStatus: 'saved',
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, paragraphs, updated_at: new Date().toISOString() }
              : ch
          ),
        })),

      updateChapterMetadata: (chapterId, patch) =>
        set((state) => ({
          saveStatus: 'saved',
          chapters: state.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, ...patch, updated_at: new Date().toISOString() }
              : ch
          ),
        })),

      updateEntity: (entityId, patch) =>
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === entityId
              ? { ...e, ...patch, updated_at: new Date().toISOString() }
              : e
          ),
        })),

      createEntity: (entity) =>
        set((state) => ({
          entities: [...state.entities, entity],
        })),

      createChapter: (title) =>
        set((state) => {
          const nextOrder =
            state.chapters.reduce((max, c) => Math.max(max, c.order), 0) + 1;
          const newId = `ch_${String(nextOrder).padStart(2, '0')}`;
          const newChapter: ChapterDocument = {
            id: newId,
            act_id: 'act_01',
            act_title: 'Hồi 1: Tín Hiệu Từ Đáy Biển',
            order: nextOrder,
            title: title || `Chương ${nextOrder}: Phân Cảnh Mới`,
            file_path: `manuscript/act-01/ch-${String(nextOrder).padStart(2, '0')}.md`,
            status: 'draft',
            pov_character_id: 'char_linh_001',
            pov_character_name: 'Lâm Vũ Linh',
            story_date: '16/10/2026',
            story_year: 2026,
            location_id: 'loc_cang_dong',
            location_tag: '#Bến_Cảng_Đông',
            target_words: 3000,
            is_flashback: false,
            paragraphs: [
              'Bắt đầu viết phân cảnh mới tại đây. Gõ / để mở Slash Command hoặc @ để gắn thẻ nhân vật từ Lorebook.',
            ],
            updated_at: new Date().toISOString(),
          };
          const tabId = `tab-${newId}`;
          return {
            chapters: [...state.chapters, newChapter],
            openTabs: [
              ...state.openTabs,
              {
                id: tabId,
                title: newChapter.title,
                type: 'chapter',
                targetId: newId,
                pane: 'primary',
              },
            ],
            activePrimaryTabId: tabId,
          };
        }),

      reorderChapters: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.chapters];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { chapters: next };
        }),

      applyRefactorRename: (
        entityId,
        newName,
        newAliases,
        selectedMatchIds,
        aliasMap
      ) =>
        set((state) => {
          const targetEntity = state.entities.find((e) => e.id === entityId);
          if (!targetEntity) return state;

          const pairs: { from: string; to: string }[] = [
            { from: targetEntity.title, to: newName },
            ...aliasMap.filter((a) => a.from.trim() && a.to.trim()),
          ];

          const updatedChapters = state.chapters.map((ch) => {
            const nextParagraphs = ch.paragraphs.map((para, pIdx) => {
              let nextPara = para;
              for (const pair of pairs) {
                const matchId = `ref-${ch.id}-p${pIdx}-${pair.from}`;
                if (selectedMatchIds.has(matchId) && nextPara.includes(pair.from)) {
                  nextPara = nextPara.split(pair.from).join(pair.to);
                }
              }
              return nextPara;
            });

            return {
              ...ch,
              pov_character_name:
                ch.pov_character_id === entityId ? newName : ch.pov_character_name,
              paragraphs: nextParagraphs,
            };
          });

          const updatedEntities = state.entities.map((e) =>
            e.id === entityId
              ? {
                  ...e,
                  title: newName,
                  aliases: newAliases,
                  body: e.body.split(targetEntity.title).join(newName),
                  updated_at: new Date().toISOString(),
                }
              : e
          );

          const updatedTabs = state.openTabs.map((t) =>
            t.targetId === entityId ? { ...t, title: newName } : t
          );

          return {
            chapters: updatedChapters,
            entities: updatedEntities,
            openTabs: updatedTabs,
          };
        }),

      createGitSnapshot: (label) =>
        set((state) => {
          const snapMap: Record<string, string[]> = {};
          state.chapters.forEach((c) => {
            snapMap[c.id] = [...c.paragraphs];
          });
          const newSnap: StorySnapshot = {
            id: `snap-${Date.now()}`,
            branch_name: state.activeBranch,
            label:
              label ||
              `Snapshot tự động (${new Date().toLocaleTimeString('vi-VN')})`,
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            word_count_delta: 125,
            total_words: 3545,
            chapter_snapshots: snapMap,
          };
          return {
            snapshots: [newSnap, ...state.snapshots],
            saveStatus: 'saved',
          };
        }),

      restoreSnapshot: (snapshotId) =>
        set((state) => {
          const targetSnap = state.snapshots.find((s) => s.id === snapshotId);
          if (!targetSnap || !targetSnap.chapter_snapshots) return state;

          const restoredChapters = state.chapters.map((ch) => {
            if (targetSnap.chapter_snapshots[ch.id]) {
              return {
                ...ch,
                paragraphs: [...targetSnap.chapter_snapshots[ch.id]],
                updated_at: new Date().toISOString(),
              };
            }
            return ch;
          });

          return {
            chapters: restoredChapters,
            activeBranch: targetSnap.branch_name,
            saveStatus: 'saved',
          };
        }),

      createWhatIfBranch: (branchName) =>
        set((state) => {
          const formatted = branchName.startsWith('what-if/')
            ? branchName
            : `what-if/${branchName.toLowerCase().replace(/\s+/g, '-')}`;
          return {
            availableBranches: state.availableBranches.includes(formatted)
              ? state.availableBranches
              : [...state.availableBranches, formatted],
            activeBranch: formatted,
          };
        }),

      switchBranch: (branchName) => set({ activeBranch: branchName }),

      resetToDefaults: () =>
        set({
          chapters: INITIAL_CHAPTERS,
          entities: INITIAL_ENTITIES,
          relations: INITIAL_RELATIONS,
          snapshots: INITIAL_SNAPSHOTS,
          activeBranch: 'main',
        }),

      exportProjectJson: () => {
        const state = get();
        return JSON.stringify(
          {
            projectName: state.projectName,
            chapters: state.chapters,
            entities: state.entities,
            relations: state.relations,
            snapshots: state.snapshots,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        );
      },

      importProjectJson: (jsonString) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (parsed && Array.isArray(parsed.chapters) && Array.isArray(parsed.entities)) {
            set({
              chapters: parsed.chapters,
              entities: parsed.entities,
              relations: parsed.relations || INITIAL_RELATIONS,
              snapshots: parsed.snapshots || INITIAL_SNAPSHOTS,
              projectName: parsed.projectName || 'Dự án nhập từ tệp',
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'novelforge-workspace-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectName: state.projectName,
        theme: state.theme,
        chapters: state.chapters,
        entities: state.entities,
        relations: state.relations,
        snapshots: state.snapshots,
        activeBranch: state.activeBranch,
        availableBranches: state.availableBranches,
      }),
    }
  )
);
