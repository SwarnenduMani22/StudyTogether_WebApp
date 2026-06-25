import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
      unique: true,
      index: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    bookmarks: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Paper",
        },
      ],
      default: [],
    },
    coins: {
      type: Number,
      default: 50,
      min: 0,
    },
    badges: {
      type: [String],
      default: [],
    },
    rank: {
      type: String,
      default: "Beginner",
    },
    totalUploads: {
      type: Number,
      default: 0,
    },
    approvedUploads: {
      type: Number,
      default: 0,
    },

    previewedPapers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Paper",
        },
      ],
      default: [],
    },

    downloadedPapers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Paper",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,

    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },

    toObject: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/* ================= SAFE USER OBJECT ================= */

userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    bookmarks: this.bookmarks,
    createdAt: this.createdAt,
    coins: this.coins,
    previewedPapers: this.previewedPapers,
    downloadedPapers: this.downloadedPapers,
    coinHistory: this.coinHistory,
    badges: this.badges,
    rank: this.rank,
  };
};

/* ================= MODEL ================= */

const User = mongoose.model("User", userSchema);

export default User;
