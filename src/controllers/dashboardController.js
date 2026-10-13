const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { getSummary } = require('../services/dashboardService');

// @desc    Dashboard summary cards
// @route   GET /api/dashboard/summary
// @access  Private
exports.summary = asyncHandler(async (req, res) => {
  const summary = await getSummary();
  return sendSuccess(res, { summary });
});
