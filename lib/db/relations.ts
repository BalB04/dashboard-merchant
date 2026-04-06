import { relations } from "drizzle-orm/relations";
import {
  adminSessions,
  adminUsers,
  dimCategory,
  dimCluster,
  dimMerchant,
  dimRule,
  factClusterPoint,
  factTransaction,
  merchantFeedback,
  merchantUsers,
  users,
} from "./schema";

export const dimMerchantRelations = relations(dimMerchant, ({ one, many }) => ({
  category: one(dimCategory, {
    fields: [dimMerchant.categoryId],
    references: [dimCategory.categoryId],
  }),
  cluster: one(dimCluster, {
    fields: [dimMerchant.clusterId],
    references: [dimCluster.clusterId],
  }),
  rules: many(dimRule),
  transactions: many(factTransaction),
}));

export const dimCategoryRelations = relations(dimCategory, ({ many }) => ({
  merchants: many(dimMerchant),
}));

export const dimClusterRelations = relations(dimCluster, ({ many }) => ({
  merchants: many(dimMerchant),
  clusterPoints: many(factClusterPoint),
}));

export const dimRuleRelations = relations(dimRule, ({ one, many }) => ({
  merchant: one(dimMerchant, {
    fields: [dimRule.ruleMerchant],
    references: [dimMerchant.merchantKey],
  }),
  transactions: many(factTransaction),
}));

export const factTransactionRelations = relations(factTransaction, ({ one }) => ({
  merchant: one(dimMerchant, {
    fields: [factTransaction.merchantKey],
    references: [dimMerchant.merchantKey],
  }),
  rule: one(dimRule, {
    fields: [factTransaction.ruleKey],
    references: [dimRule.ruleKey],
  }),
}));

export const factClusterPointRelations = relations(factClusterPoint, ({ one }) => ({
  cluster: one(dimCluster, {
    fields: [factClusterPoint.clusterId],
    references: [dimCluster.clusterId],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  merchantUser: one(merchantUsers, {
    fields: [users.id],
    references: [merchantUsers.userId],
  }),
  feedbackEntries: many(merchantFeedback),
}));

export const merchantUsersRelations = relations(merchantUsers, ({ one }) => ({
  user: one(users, {
    fields: [merchantUsers.userId],
    references: [users.id],
  }),
}));

export const merchantFeedbackRelations = relations(merchantFeedback, ({ one }) => ({
  user: one(users, {
    fields: [merchantFeedback.userId],
    references: [users.id],
  }),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, {
    fields: [adminSessions.userId],
    references: [adminUsers.id],
  }),
}));
