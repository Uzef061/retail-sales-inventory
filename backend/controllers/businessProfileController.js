const BusinessProfile = require('../models/BusinessProfile');
const { getCurrencyByCodeOrSymbol, isValidCurrency } = require('../utils/currencyHelper');

// GET /api/business-profile
exports.getProfile = async (req, res) => {
  try {
    let profile = await BusinessProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await BusinessProfile.create({
        userId: req.user._id,
        businessName: req.user.name ? `${req.user.name}'s Store` : 'My Store',
        ownerName: req.user.name || '',
        currency: 'INR'
      });
    }
    const currInfo = getCurrencyByCodeOrSymbol(profile.currency);
    const profileJson = profile.toObject();
    profileJson.currencySymbol = currInfo.symbol;
    profileJson.currencyCode = currInfo.code;
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

    let profile = await BusinessProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new BusinessProfile({ userId: req.user._id });
    }

    if (businessName !== undefined) profile.businessName = businessName.trim();
    if (ownerName !== undefined) profile.ownerName = ownerName.trim();
    if (category !== undefined) profile.category = category.trim();
    if (phone !== undefined) profile.phone = phone.trim();
    if (email !== undefined) profile.email = email.trim();
    if (address !== undefined) profile.address = address.trim();
    if (currency !== undefined) {
      const trimmedCurr = currency.trim();
      const currObj = getCurrencyByCodeOrSymbol(trimmedCurr);
      profile.currency = currObj.code;
    }
    if (taxNumber !== undefined) profile.taxNumber = taxNumber.trim();
    if (logoUrl !== undefined) profile.logoUrl = logoUrl.trim();
    if (receiptFooter !== undefined) profile.receiptFooter = receiptFooter.trim();

    const savedProfile = await profile.save();
    const currInfo = getCurrencyByCodeOrSymbol(savedProfile.currency);
    const profileJson = savedProfile.toObject();
    profileJson.currencySymbol = currInfo.symbol;
    profileJson.currencyCode = currInfo.code;

    res.status(200).json({ success: true, message: 'Business profile updated successfully', profile: profileJson });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating business profile', error: error.message });
  }
};
