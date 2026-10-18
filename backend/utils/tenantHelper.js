/**
 * Centralized multi-tenant query scoping and ownership helper.
 * Enforces database-level isolation between users while preserving legacy demo compatibility for the React frontend.
 */

const getTenantQuery = (req, baseQuery = {}) => {
  if (!req.user) {
    // Unauthenticated legacy requests (e.g. React frontend when running in anonymous/demo fallback)
    return {
      ...baseQuery,
      $or: [{ userId: null }, { userId: { $exists: false } }, { isDemoRecord: true }]
    };
  }

  // Built-in store administrators ('admin', 'cashier') retain access to legacy demo data and their own data
  if (req.user.username === 'admin' || req.user.username === 'cashier') {
    return {
      ...baseQuery,
      $or: [
        { userId: req.user._id },
        { userId: null },
        { userId: { $exists: false } }
      ]
    };
  }

  // Normal / Multi-user accounts (e.g., Google Sign-In or dedicated shopkeeper accounts):
  // Strictly scoped to their own records. They NEVER see demo data or other tenants' data.
  return {
    ...baseQuery,
    userId: req.user._id
  };
};

/**
 * Asserts whether the authenticated user has authorization to read/modify/delete a specific document.
 */
const hasTenantAccess = (doc, req) => {
  if (!doc) return false;
  if (!req.user) {
    // Legacy document access for unauthenticated calls
    return !doc.userId;
  }

  // Document belongs directly to this user
  if (doc.userId && doc.userId.toString() === req.user._id.toString()) {
    return true;
  }

  // Legacy document without a userId is accessible by store administrators
  if (!doc.userId && (req.user.username === 'admin' || req.user.username === 'cashier')) {
    return true;
  }

  return false;
};

/**
 * Attaches the current tenant user ID to new record creation objects.
 */
const attachTenantId = (payload, req) => {
  if (req && req.user && req.user._id) {
    return { ...payload, userId: req.user._id };
  }
  return payload;
};

module.exports = {
  getTenantQuery,
  hasTenantAccess,
  attachTenantId
};
