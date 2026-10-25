const BusinessProfile = require('../models/BusinessProfile');
const { getCurrencyByCodeOrSymbol, isValidCurrency } = require('../utils/currencyHelper');

// GET /api/business-profile
exports.getProfile = async (req, res) => {
  try {
    let profile = null;
    if (req.user && req.user.businessId) {
      profile = await BusinessProfile.findById(req.user.businessId);
    }
    if (!profile && req.user && req.user._id) {
      profile = await BusinessProfile.findOne({ userId: req.user._id });
    }
    if (!profile && req.user && req.user._id) {
      profile = await BusinessProfile.create({
        userId: req.user._id,
        businessName: req.user.name ? `${req.user.name}'s Store` : 'My Store',
        ownerName: req.user.name || '',
        currency: 'INR'
      });
      req.user.businessId = profile._id;
      await req.user.save();
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Business profile not found.' });
    }

    const currInfo = getCurrencyByCodeOrSymbol(profile.currency);
    const profileJson = profile.toObject();
    profileJson.currency = currInfo.code;
    profileJson.currencySymbol = currInfo.symbol;
    profileJson.currencyCode = currInfo.code;
    profileJson.currencyName = currInfo.name;

    res.status(200).json({ success: true, profile: profileJson });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching business profile', error: error.message });
  }
};

// PUT /api/business-profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      businessName,
      ownerName,
      category,
      phone,
      email,
      address,
      currency,
      taxNumber,
      logoUrl,
      receiptFooter
    } = req.body;

    let profile = null;
    if (req.user && req.user.businessId) {
      profile = await BusinessProfile.findById(req.user.businessId);
    }
    if (!profile && req.user && req.user._id) {
      profile = await BusinessProfile.findOne({ userId: req.user._id });
    }
    if (!profile && req.user && req.user._id) {
      profile = new BusinessProfile({ userId: req.user._id });
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Unable to locate or initialize business profile.' });
    }

    if (businessName !== undefined) profile.businessName = businessName.trim();
    if (ownerName !== undefined) profile.ownerName = ownerName.trim();
    if (category !== undefined) profile.category = category.trim();
    if (phone !== undefined) profile.phone = phone.trim();
    if (email !== undefined) profile.email = email.trim();
    if (address !== undefined) profile.address = address.trim();
    if (currency !== undefined && currency !== null) {
      const trimmedCurr = String(currency).trim();
      if (trimmedCurr.length > 0) {
        const currObj = getCurrencyByCodeOrSymbol(trimmedCurr);
        profile.currency = currObj.code;
      }
    }
    if (taxNumber !== undefined) profile.taxNumber = taxNumber.trim();
    if (logoUrl !== undefined) profile.logoUrl = logoUrl.trim();
    if (receiptFooter !== undefined) profile.receiptFooter = receiptFooter.trim();

    const savedProfile = await profile.save();

    if (req.user && !req.user.businessId) {
      req.user.businessId = savedProfile._id;
      await req.user.save();
    }

    const currInfo = getCurrencyByCodeOrSymbol(savedProfile.currency);
    const profileJson = savedProfile.toObject();
    profileJson.currency = currInfo.code;
    profileJson.currencySymbol = currInfo.symbol;
    profileJson.currencyCode = currInfo.code;
    profileJson.currencyName = currInfo.name;

    res.status(200).json({ success: true, message: 'Business profile updated successfully', profile: profileJson });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating business profile', error: error.message });
  }
};
