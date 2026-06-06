const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");

exports.uploadMedia = asyncHandler(async (req, res) => {
  const files = (req.files || []).map((file) => ({
    filename: file.filename,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size_bytes: file.size,
    public_url: `/uploads/${file.filename}`
  }));

  sendSuccess(res, files, "Media uploaded successfully.", 201);
});
