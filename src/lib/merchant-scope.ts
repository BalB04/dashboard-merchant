export const merchantScopeCte = (userAccountIdParam = 1, scopeMarkerParam = 2) => `
  with merchant_scope as (
    select dm.merchant_key
    from dim_merchant dm
    where dm.user_account_id = $${userAccountIdParam}::bigint
      and $${scopeMarkerParam}::text = 'account'
  )
`;
