export const merchantScopeCte = (merchantKeyParam = 1, scopeTypeParam = 2) => `
  with merchant_scope as (
    select $${merchantKeyParam}::uuid as merchant_key
    where $${scopeTypeParam}::merchant_scope_type = 'merchant'
    union
    select mcm.merchant_key
    from merchant_canonical_map mcm
    where $${scopeTypeParam}::merchant_scope_type = 'canonical'
      and mcm.canonical_merchant_key = $${merchantKeyParam}::uuid
    union
    select $${merchantKeyParam}::uuid
    where $${scopeTypeParam}::merchant_scope_type = 'canonical'
  )
`;
