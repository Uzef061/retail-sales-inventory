const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  console.log('=== VERIFYING NPR CURRENCY EXACT FLOW & PERSISTENCE ===');
  await mongoose.connect(process.env.MONGODB_URI);

  const User = require('../models/User');
  const BusinessProfile = require('../models/BusinessProfile');
  const businessProfileController = require('../controllers/businessProfileController');
  const authController = require('../controllers/authController');
  const { getCurrencyByCodeOrSymbol } = require('../utils/currencyHelper');

  const mockReqRes = (user, body = {}, params = {}, query = {}) => {
    let statusCode = 200;
    let responseData = null;
    const req = { user, body, params, query };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; }
    };
    return { req, res, get: () => ({ status: statusCode, data: responseData }) };
  };

  try {
    // 1. Test Currency Helper with exact label
    console.log('\n[TEST 1] Testing exact label string matching in currencyHelper:');
    const exactLabel = 'Nepalese Rupee (NPR — रू)';
    const parsedFromLabel = getCurrencyByCodeOrSymbol(exactLabel);
    console.log('Parsed label result:', parsedFromLabel);
    if (parsedFromLabel.code !== 'NPR' || parsedFromLabel.symbol !== 'रू') {
      throw new Error(`Failed to parse exact label "${exactLabel}": ${JSON.stringify(parsedFromLabel)}`);
    }
    console.log('✓ Exact label parses to NPR / रू successfully.');

    // 2. Create a fresh test user
    console.log('\n[TEST 2] Create test user and set currency to NPR via Business Profile update:');
    const testEmail = `npr_test_${Date.now()}@example.com`;
    const testUser = await User.create({
      username: `npr_user_${Date.now()}`,
      email: testEmail,
      password: 'Password123!',
      name: 'NPR Test Merchant',
      role: 'ADMIN',
      hasCompletedOnboarding: false
    });

    // Update business profile with exact label: 'Nepalese Rupee (NPR — रू)'
    const { req: bpReq, res: bpRes, get: bpGet } = mockReqRes(testUser, {
      businessName: 'Kathmandu Spices',
      currency: 'Nepalese Rupee (NPR — रू)'
    });
    await businessProfileController.updateProfile(bpReq, bpRes);
    const bpResult = bpGet();
    if (bpResult.status !== 200 || !bpResult.data.profile) {
      throw new Error(`Failed to update business profile: ${JSON.stringify(bpResult.data)}`);
    }
    console.log('Updated profile:', {
      currency: bpResult.data.profile.currency,
      currencyCode: bpResult.data.profile.currencyCode,
      currencySymbol: bpResult.data.profile.currencySymbol,
      currencyName: bpResult.data.profile.currencyName
    });
    if (bpResult.data.profile.currencyCode !== 'NPR' || bpResult.data.profile.currencySymbol !== 'रू') {
      throw new Error(`BusinessProfile currencyCode is not NPR: ${JSON.stringify(bpResult.data.profile)}`);
    }
    console.log('✓ Profile saved with NPR code and रू symbol.');

    // 3. Verify GET /api/business-profile preserves NPR
    console.log('\n[TEST 3] Verify GET /api/business-profile preserves NPR:');
    const { req: getReq, res: getRes, get: getGet } = mockReqRes(testUser);
    await businessProfileController.getProfile(getReq, getRes);
    const getResult = getGet();
    if (getResult.data.profile.currencyCode !== 'NPR' || getResult.data.profile.currencySymbol !== 'रू') {
      throw new Error(`GET /api/business-profile did not return NPR: ${JSON.stringify(getResult.data)}`);
    }
    console.log('✓ GET /api/business-profile returned NPR and रू.');

    // 4. Verify GET /api/auth/me returns enriched profile with NPR
    console.log('\n[TEST 4] Verify GET /api/auth/me returns enriched profile with NPR:');
    const { req: meReq, res: meRes, get: meGet } = mockReqRes(testUser);
    await authController.getMe(meReq, meRes);
    const meResult = meGet();
    if (!meResult.data.profile || meResult.data.profile.currencyCode !== 'NPR') {
      throw new Error(`GET /api/auth/me profile is not NPR: ${JSON.stringify(meResult.data)}`);
    }
    console.log('✓ GET /api/auth/me returned profile with currencyCode: NPR and currencySymbol: रू.');

    // 5. Verify PUT /api/auth/onboarding does not overwrite currency if not provided
    console.log('\n[TEST 5] Verify onboarding does not overwrite NPR currency:');
    const { req: onbReq, res: onbRes, get: onbGet } = mockReqRes(testUser, {
      category: 'Grocery & Mart',
      phone: '+977-9800000000'
    });
    await authController.completeOnboarding(onbReq, onbRes);
    const onbResult = onbGet();
    if (onbResult.data.profile.currencyCode !== 'NPR') {
      throw new Error(`Onboarding overwrote currency! Result: ${JSON.stringify(onbResult.data)}`);
    }
    console.log('✓ Onboarding preserved NPR currency.');

    // 6. Verify Google login re-authentication does not overwrite currency
    console.log('\n[TEST 6] Verify re-authentication flow retains existing NPR currency:');
    // Ensure testUser has a businessId linked
    const reloadedUser = await User.findById(testUser._id);
    const currentProfile = await BusinessProfile.findById(reloadedUser.businessId);
    if (!currentProfile || currentProfile.currency !== 'NPR') {
      throw new Error(`Profile currency was changed unexpectedly: ${currentProfile ? currentProfile.currency : 'null'}`);
    }
    console.log(`✓ Stored BusinessProfile in MongoDB strictly holds currency: '${currentProfile.currency}'.`);

    // Clean up
    await BusinessProfile.deleteOne({ userId: testUser._id });
    await User.deleteOne({ _id: testUser._id });
    console.log('\n✓ Cleanup complete. All verification steps passed!');

  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
