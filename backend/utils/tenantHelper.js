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

  // Authenticated store users retain access to legacy demo catalog data and their own data
  return {
    ...baseQuery,
    $or: [
      { userId: req.user._id },
      { userId: null },
      { userId: { $exists: false } }
    ]
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

  // Document belongs to the user's business profile
  if (doc.businessId && req.user.businessId && doc.businessId.toString() === req.user.businessId.toString()) {
    return true;
  }

  // Legacy document without a userId is accessible by all authenticated store users
  if (!doc.userId) {
    return true;
  }

  // Store administrators retain access to store resources
  if (req.user.role === 'ADMIN' || req.user.username === 'admin') {
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
