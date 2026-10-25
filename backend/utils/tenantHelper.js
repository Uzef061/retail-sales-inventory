/**
 * Centralized multi-tenant query scoping and ownership helper.
 * Enforces database-level isolation between users/businesses while preserving legacy demo compatibility.
 */

const getTenantQuery = (req, baseQuery = {}) => {
  let tenantFilter;
  if (!req || !req.user) {
    // Unauthenticated access: only allow unassigned demo records
    tenantFilter = {
      $or: [{ userId: null }, { userId: { $exists: false } }, { isDemoRecord: true }]
    };
  } else {
    // Authenticated tenant: strictly scoped to this user's ID (and businessId)
    // Never leak unassigned/demo records (userId: null) to authenticated accounts!
    const orConditions = [
      { userId: req.user._id }
    ];
    if (req.user.businessId) {
      orConditions.push({ businessId: req.user.businessId });
    }
    tenantFilter = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
  }

  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return tenantFilter;
  }

  // If baseQuery contains an $or, combine via $and to avoid property key collision in JS objects!
  if (baseQuery.$or) {
    const { $or: baseOr, ...rest } = baseQuery;
    return {
      ...rest,
      $and: [
        { $or: baseOr },
        tenantFilter
      ]
    };
  }

  return {
    ...baseQuery,
    ...tenantFilter
  };
};

/**
 * Asserts whether the authenticated user has authorization to read/modify/delete a specific document.
 * Enforces strict multi-tenant boundary: a user (regardless of role 'ADMIN') can NEVER access,
 * modify, or delete another store/business's records.
 */
const hasTenantAccess = (doc, req) => {
  if (!doc) return false;
  if (!req.user) {
    // Unauthenticated access only permitted for unassigned legacy records
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

  // Unassigned legacy/demo records are not accessible to authenticated tenant accounts
  return false;
};

/**
 * Attaches the current tenant user ID and business ID to new record creation objects.
 */
const attachTenantId = (payload, req) => {
  if (req && req.user && req.user._id) {
    const updated = { ...payload, userId: req.user._id };
    if (req.user.businessId) {
      updated.businessId = req.user.businessId;
    }
    return updated;
  }
  return payload;
};

module.exports = {
  getTenantQuery,
  hasTenantAccess,
  attachTenantId
};
