import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  pgView,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const daterange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "daterange";
  },
});

export const transactionStatus = pgEnum("transaction_status", ["success", "failed"]);
export const merchantScopeType = pgEnum("merchant_scope_type", ["merchant", "canonical"]);

export const dimCategory = pgTable("dim_category", {
  categoryId: integer("category_id").primaryKey().notNull(),
  category: varchar("category", { length: 500 }).notNull(),
});

export const dimCluster = pgTable("dim_cluster", {
  clusterId: bigint("cluster_id", { mode: "number" }).primaryKey().notNull(),
  cluster: varchar("cluster", { length: 500 }).notNull(),
  branch: varchar("branch", { length: 500 }).notNull(),
  region: varchar("region", { length: 500 }).notNull(),
});

export const dimMerchant = pgTable(
  "dim_merchant",
  {
    merchantKey: uuid("merchant_key").primaryKey().notNull(),
    keywordCode: varchar("keyword_code", { length: 500 }).notNull(),
    merchantName: varchar("merchant_name", { length: 500 }).notNull(),
    uniqMerchant: varchar("uniq_merchant", { length: 500 }).notNull(),
    clusterId: bigint("cluster_id", { mode: "number" })
      .references(() => dimCluster.clusterId)
      .notNull(),
    categoryId: integer("category_id")
      .references(() => dimCategory.categoryId)
      .notNull(),
  },
  (table) => [
    unique("dim_merchant_keyword_code_key").on(table.keywordCode),
    index("dim_merchant_idx_dim_merchant_category_id").on(table.categoryId),
    index("dim_merchant_idx_dim_merchant_cluster_id").on(table.clusterId),
  ],
);

export const dimRule = pgTable(
  "dim_rule",
  {
    ruleKey: uuid("rule_key").primaryKey().notNull(),
    ruleMerchant: uuid("rule_merchant")
      .references(() => dimMerchant.merchantKey)
      .notNull(),
    pointRedeem: integer("point_redeem").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false, mode: "string" }).notNull(),
    period: daterange("period").notNull(),
  },
  (table) => [
    index("dim_rule_idx_dim_rule_merchant").on(table.ruleMerchant),
    check("ck_dim_rule_point_positive", sql`${table.pointRedeem} >= 0`),
    check("ck_dim_rule_period_valid", sql`NOT isempty(${table.period})`),
  ],
);

export const factTransaction = pgTable(
  "fact_transaction",
  {
    transactionKey: uuid("transaction_key").primaryKey().notNull(),
    transactionAt: timestamp("transaction_at", { withTimezone: false, mode: "string" }).notNull(),
    ruleKey: uuid("rule_key")
      .references(() => dimRule.ruleKey)
      .notNull(),
    merchantKey: uuid("merchant_key")
      .references(() => dimMerchant.merchantKey)
      .notNull(),
    status: transactionStatus("status").notNull(),
    qty: integer("qty").default(1).notNull(),
    pointRedeem: integer("point_redeem").notNull(),
    msisdn: varchar("msisdn", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: false, mode: "string" }).notNull(),
  },
  (table) => [
    index("fact_transaction_idx_ft_merchant_status_time").on(
      table.merchantKey,
      table.status,
      table.transactionAt,
    ),
    index("fact_transaction_index_6").on(table.msisdn),
    index("fact_transaction_rule").on(table.ruleKey),
    check("ck_fact_transaction_qty_valid", sql`${table.qty} >= 1`),
    check("ck_fact_transaction_point_positive", sql`${table.pointRedeem} >= 0`),
    check("ck_fact_transaction_msisdn_digits", sql`${table.msisdn} ~ '^[0-9]{8,20}$'`),
  ],
);

export const factClusterPoint = pgTable(
  "fact_cluster_point",
  {
    pointKey: uuid("point_key").primaryKey().notNull(),
    monthYear: date("month_year", { mode: "string" }).notNull(),
    clusterId: bigint("cluster_id", { mode: "number" })
      .references(() => dimCluster.clusterId)
      .notNull(),
    totalPoint: bigint("total_point", { mode: "number" }).notNull(),
    pointOwner: bigint("point_owner", { mode: "number" }).notNull(),
  },
  (table) => [index("fact_cluster_point_idx_fcp_month_cluster").on(table.monthYear, table.clusterId)],
);

export const users = pgTable(
  "users",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    email: text("email").notNull(),
    username: text("username"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").default("merchant").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    unique("users_email_unique").on(table.email),
    unique("users_username_unique").on(table.username),
    check("users_role_check", sql`${table.role} in ('merchant', 'admin')`),
  ],
);

export const merchantUsers = pgTable(
  "merchant_users",
  {
    userId: bigint("user_id", { mode: "number" })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    merchantKey: uuid("merchant_key").notNull(),
    scopeType: merchantScopeType("scope_type").default("merchant").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    unique("merchant_users_user_id_merchant_key_unique").on(table.userId, table.merchantKey),
    index("idx_merchant_users_merchant_key").on(table.merchantKey),
  ],
);

export const merchantCanonicalMap = pgTable("merchant_canonical_map", {
  merchantKey: uuid("merchant_key").primaryKey().notNull(),
  canonicalMerchantKey: uuid("canonical_merchant_key").notNull(),
  uniqMerchant: text("uniq_merchant").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false, mode: "string" }).defaultNow(),
});

export const providerBanners = pgTable(
  "provider_banners",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    imageKey: text("image_key").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    cta: text("cta").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [index("idx_provider_banners_active").on(table.isActive), index("idx_provider_banners_sort").on(table.sortOrder)],
);

export const merchantFeedback = pgTable(
  "merchant_feedback",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    merchantKey: uuid("merchant_key").notNull(),
    userId: bigint("user_id", { mode: "number" })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    status: text("status").default("open").notNull(),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_merchant_feedback_merchant").on(table.merchantKey),
    index("idx_merchant_feedback_user").on(table.userId),
    index("idx_merchant_feedback_status").on(table.status),
    check("merchant_feedback_type_check", sql`${table.type} in ('report', 'critic', 'suggestion')`),
    check("merchant_feedback_status_check", sql`${table.status} in ('open', 'in_progress', 'resolved')`),
  ],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: false, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: false, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [unique("admin_users_email_unique").on(table.email), index("admin_users_active_idx").on(table.isActive)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id")
      .references(() => adminUsers.id, { onDelete: "cascade" })
      .notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: false, mode: "string" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: false, mode: "string" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: false, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    unique("admin_sessions_token_hash_unique").on(table.sessionTokenHash),
    index("admin_sessions_expires_at_idx").on(table.expiresAt),
    index("admin_sessions_user_id_idx").on(table.userId),
  ],
);

export const vwOverviewTransaction = pgView("vw_overview_transaction", {
  transactionKey: uuid("transaction_key"),
  transactionAt: timestamp("transaction_at", { withTimezone: false, mode: "string" }),
  status: transactionStatus("status"),
  merchantKey: uuid("merchant_key"),
  qty: integer("qty"),
  pointRedeem: integer("point_redeem"),
  totalPoint: bigint("total_point", { mode: "number" }),
  msisdn: varchar("msisdn", { length: 20 }),
  keywordCode: varchar("keyword_code", { length: 500 }),
  merchantName: varchar("merchant_name", { length: 500 }),
  uniqMerchant: varchar("uniq_merchant", { length: 500 }),
  categoryId: integer("category_id"),
  category: varchar("category", { length: 500 }),
  clusterId: bigint("cluster_id", { mode: "number" }),
  cluster: varchar("cluster", { length: 500 }),
  branch: varchar("branch", { length: 500 }),
  region: varchar("region", { length: 500 }),
}).as(sql`
  select
    ft.transaction_key,
    ft.transaction_at,
    ft.status,
    ft.merchant_key,
    ft.qty,
    ft.point_redeem,
    (ft.qty * ft.point_redeem)::bigint as total_point,
    ft.msisdn,
    dm.keyword_code,
    dm.merchant_name,
    dm.uniq_merchant,
    dcat.category_id,
    dcat.category,
    dcl.cluster_id,
    dcl.cluster,
    dcl.branch,
    dcl.region
  from fact_transaction ft
  join dim_merchant dm on dm.merchant_key = ft.merchant_key
  join dim_category dcat on dcat.category_id = dm.category_id
  join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
`);

export const vwRuleMerchantDim = pgView("vw_rule_merchant_dim", {
  ruleKey: uuid("rule_key"),
  merchantKey: uuid("merchant_key"),
  pointRedeem: integer("point_redeem"),
  period: daterange("period"),
  startPeriod: date("start_period", { mode: "string" }),
  endPeriod: date("end_period", { mode: "string" }),
  merchantName: varchar("merchant_name", { length: 500 }),
  keywordCode: varchar("keyword_code", { length: 500 }),
  uniqMerchant: varchar("uniq_merchant", { length: 500 }),
  clusterId: bigint("cluster_id", { mode: "number" }),
  categoryId: integer("category_id"),
  category: varchar("category", { length: 500 }),
  branch: varchar("branch", { length: 500 }),
  cluster: varchar("cluster", { length: 500 }),
  region: varchar("region", { length: 500 }),
}).as(sql`
  select
    dr.rule_key,
    dr.rule_merchant as merchant_key,
    dr.point_redeem,
    dr.period,
    lower(dr.period) as start_period,
    (upper(dr.period) - interval '1 day')::date as end_period,
    dm.merchant_name,
    dm.keyword_code,
    dm.uniq_merchant,
    dm.cluster_id,
    dm.category_id,
    dcat.category,
    dcl.branch,
    dcl.cluster,
    dcl.region
  from dim_rule dr
  join dim_merchant dm on dm.merchant_key = dr.rule_merchant
  join dim_category dcat on dcat.category_id = dm.category_id
  join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
`);

export const vwMerchantTxMonthlyAgg = pgView("vw_merchant_tx_monthly_agg", {
  monthYear: date("month_year", { mode: "string" }),
  merchantKey: uuid("merchant_key"),
  category: varchar("category", { length: 500 }),
  branch: varchar("branch", { length: 500 }),
  cluster: varchar("cluster", { length: 500 }),
  uniqMerchant: varchar("uniq_merchant", { length: 500 }),
  txCount: integer("tx_count"),
  successTxCount: integer("success_tx_count"),
  failedTxCount: integer("failed_tx_count"),
  uniqueRedeemer: integer("unique_redeemer"),
  uniqueRedeemerSuccess: integer("unique_redeemer_success"),
  totalPointSuccess: bigint("total_point_success", { mode: "number" }),
}).as(sql`
  select
    date_trunc('month', transaction_at)::date as month_year,
    merchant_key,
    category,
    branch,
    cluster,
    uniq_merchant,
    count(*)::integer as tx_count,
    count(*) filter (where status = 'success')::integer as success_tx_count,
    count(*) filter (where status = 'failed')::integer as failed_tx_count,
    count(distinct msisdn)::integer as unique_redeemer,
    count(distinct msisdn) filter (where status = 'success')::integer as unique_redeemer_success,
    coalesce(sum(total_point) filter (where status = 'success'), 0::bigint) as total_point_success
  from vw_overview_transaction
  group by date_trunc('month', transaction_at)::date, merchant_key, category, branch, cluster, uniq_merchant
`);
