export type FilterOption = {
  value: string;
  label: string;
};

export type MerchantIdentity = {
  email: string;
  merchantKey: string;
};

export type DashboardFilterSelection = {
  months: string[];
  categories: string[];
  branches: string[];
  keywords: string[];
};

export type DashboardFilterOptions = {
  months: FilterOption[];
  categories: FilterOption[];
  branches: FilterOption[];
  keywords: FilterOption[];
};

export type DashboardBootstrap = {
  identity: MerchantIdentity;
  options: DashboardFilterOptions;
  applied: DashboardFilterSelection;
  latestMonth: string;
};

export type OverviewResponse = {
  month: string;
  monthLabel: string;
  previousMonthLabel: string;
  merchant: {
    merchantKey: string;
    email: string;
    merchantNames: string[];
    uniqMerchants: string[];
    categories: string[];
    keywords: string[];
    startPeriod: string | null;
    endPeriod: string | null;
    pointRedeem: number | null;
  };
  myKpi: {
    redeem: number;
    uniqueRedeemer: number;
    burningPoin: number;
    previous: {
      redeem: number;
      uniqueRedeemer: number;
      burningPoin: number;
    };
  };
  monthlyTrend: { month: string; redeem: number; uniqueRedeemer: number; burningPoin: number }[];
  dailyTrend: { date: string; redeem: number; uniqueRedeemer: number; burningPoin: number }[];
  keywordRules: {
    keyword: string;
    startPeriod: string;
    endPeriod: string;
    status: "active" | "upcoming" | "expired";
    daysToEnd: number;
  }[];
  transactions: {
    transactionAt: string;
    keyword: string;
    status: string;
    qty: number;
    pointRedeem: number;
    redeemPointTotal: number;
    msisdn: string;
    category: string;
    branch: string;
    cluster: string;
  }[];
};

export type OperationalResponse = {
  month: string;
  monthLabel: string;
  merchant: {
    merchantKey: string;
    email: string;
  };
  transactionStatus: { success: number; failed: number };
  keywordSummary: { keyword: string; totalRedeem: number; uniqueRedeemer: number; burningPoin: number }[];
  keywordRules: {
    keyword: string;
    startPeriod: string;
    endPeriod: string;
    status: "active" | "upcoming" | "expired";
    daysToEnd: number;
  }[];
  transactions: {
    transactionAt: string;
    keyword: string;
    status: string;
    qty: number;
    pointRedeem: number;
    redeemPointTotal: number;
    msisdn: string;
    category: string;
    branch: string;
    cluster: string;
  }[];
};

export type ProgramRow = {
  keyword: string;
  merchantName: string;
  uniqMerchant: string;
  programName: string;
  startPeriod: string;
  endPeriod: string;
  status: "active" | "upcoming" | "expired";
  imageUrl: string | null;
  redeem: number;
  uniqueRedeemer: number;
  burningPoin: number;
  failed: number;
};

export type Banner = {
  id: string;
  imageUrl?: string;
  title: string;
  subtitle: string;
  cta: string;
};

export type ProgramsResponse = {
  month: string;
  monthLabel: string;
  banners: Banner[];
  programs: ProgramRow[];
  promotionPerformance: {
    redeem: number;
    uniqueRedeemer: number;
    burningPoin: number;
    failed: number;
  };
};

export type FeedbackType = "report" | "critic" | "suggestion";
export type FeedbackStatus = "open" | "in_progress" | "resolved";

export type FeedbackAttachment = {
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  downloadUrl: string;
};

export type FeedbackItem = {
  id: string;
  type: FeedbackType;
  category: string;
  title: string;
  message: string;
  status: FeedbackStatus | "canceled";
  attachment: FeedbackAttachment | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
