const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, "Username can contain letters, numbers, underscore only"]
    },
    firstname: { type: String, required: true, trim: true, maxlength: 50 },
    lastname: { type: String, required: true, trim: true, maxlength: 50 },
    password: { type: String, required: true, minlength: 6 },
    createon: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

// nicer unique error
userSchema.post("save", function (error, doc, next) {
  if (error && error.code === 11000) next(new Error("Username already exists"));
  else next(error);
});

module.exports = mongoose.model("User", userSchema);
