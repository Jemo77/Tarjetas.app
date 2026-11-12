// Tipos compartidos con el backend (contrato API)

export type GlobalRole = "SUPER_ADMIN" | "USER";
export type MemberRole = "OWNER" | "MANAGER" | "STAFF";

export interface Membership {
  establishmentId: string;
  establishmentName: string;
  role: MemberRole;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  emailVerified: boolean;
  memberships: Membership[];
}

export type CardStatus = "ACTIVE" | "COMPLETED" | "REDEEMED" | "EXPIRED";
export type StampStatus = "VALID" | "VOIDED";
export type StampSource = "QR" | "NFC" | "MANUAL";
export type ValidationMode = "STATIC" | "ROTATING";
export type EstablishmentStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type CustomerSegment = "NEW" | "ACTIVE" | "LOYAL" | "AT_RISK" | "LOST";

export interface CardTemplate {
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string | null;
  backgroundColor: string;
  backgroundImageUrl: string | null;
  textColor: string;
  accentColor: string;
  logoUrl: string | null;
  stampIconKey: string | null;
  stampIconUrl: string | null;
  emptySlotStyle: "outline" | "dotted" | "filled";
  layout?: Record<string, unknown> | null;
}

export interface EstablishmentSummary {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  logoUrl: string | null;
  timezone: string;
}

export interface WalletCard {
  id: string;
  cycle: number;
  stampsRequired: number;
  stampsCount: number;
  status: CardStatus;
  rewardTitle: string;
  rewardDescription: string | null;
  completedAt: Date | string | null;
  expiresAt: Date | string | null;
}

export interface WalletGroup {
  establishment: EstablishmentSummary;
  template: CardTemplate;
  cards: WalletCard[];
  activeCard: WalletCard;
}

export interface ClaimCardResult {
  id: string;
  cycle: number;
  stampsRequired: number;
  stampsCount: number;
  status: CardStatus;
  rewardTitle: string;
  redeemCode: string | null;
  completedAt: Date | string | null;
  expiresAt: Date | string | null;
  justCompleted: boolean;
}

export interface ClaimResult {
  stamp: { id: string; date: string; source: StampSource; timestamp: string };
  card: ClaimCardResult;
  establishment: { id: string; name: string; timezone: string };
}

export interface PublicStampPointInfo {
  establishment: {
    id: string;
    name: string;
    category: string | null;
    logoUrl: string | null;
    address: string | null;
    city: string | null;
    timezone: string;
    status: EstablishmentStatus;
    active: boolean;
    subscriptionStatus: SubscriptionStatus | null;
  };
  template: CardTemplate | null;
  point: { mode: ValidationMode; label: string };
}

export interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  path?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}