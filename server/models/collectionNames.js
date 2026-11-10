/* =====================================================================
   COLLECTION NAMES
   WUBRG'r shares one MongoDB database with another project
   ("first-server"). Mongoose would name our collections "users" and so
   on, which would mix our data with theirs. So every collection here
   starts with "wubrgr_", and each name is written once, in this file.
   ===================================================================== */

export const COLLECTIONS = {
  user: 'wubrgr_users',
  refreshToken: 'wubrgr_refreshtokens',
  passwordReset: 'wubrgr_passwordresets',
  binder: 'wubrgr_binders',
  card: 'wubrgr_cards',
  list: 'wubrgr_lists',
  listCard: 'wubrgr_listcards',
};
