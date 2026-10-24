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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    disabledReason: {
      type: String,
      default: null,
    },
    disabledAt: {
      type: Date,
      default: null,
    },
    disabledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusHistory: [
      {
        action: {
          type: String,
          enum: ["disabled", "enabled"],
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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
    appliedGrants: [
      {
        idempotencyKey: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    badges: {
      type: [String],
      default: [],
    },
    rank: {
      type: String,
      default: "Beginner",
    },
    lastActiveDate: {
      type: String,
      default: "",
    },
    dailyStreak: {
      type: Number,
      default: 0,
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
    lastActiveDate: this.lastActiveDate,
    dailyStreak: this.dailyStreak,
    isActive: this.isActive !== false,
    status: this.status || "active",
    disabledReason: this.disabledReason || null,
    disabledAt: this.disabledAt || null,
  };
};

/* ================= INDEXES ================= */
userSchema.index({ coins: -1, approvedUploads: -1, totalUploads: -1 });
userSchema.index({ createdAt: -1 });

/* ================= MODEL ================= */

const User = mongoose.model("User", userSchema);

export default User;
