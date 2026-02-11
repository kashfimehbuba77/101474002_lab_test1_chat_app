const mongoose = require("mongoose");

const privateMessageSchema = new mongoose.Schema(
  {
    from_user: { type: String, required: true, trim: true },
    to_user: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    date_sent: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model("PrivateMessage", privateMessageSchema);
