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

    coinHistory: {
      type: [
        {
          type: {
            type: String,
            enum: ["earned", "spent", "purchase", "bonus", "refund"],
            required: true,
          },

          amount: {
            type: Number,
            required: true,
            min: 1,
          },

          reason: {
            type: String,
            required: true,
            trim: true,
          },

          paper: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Paper",
          },

          paperTitle: {
            type: String,
            trim: true,
          },

          createdAt: {
            type: Date,
            default: Date.now,
          },
          transactionId: {
            type: String,
            default: null,
          },

          packageName: {
            type: String,
            default: null,
          },

          paymentId: {
            type: String,
            default: null,
          },
          metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
          },
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
  };
};

/* ================= MODEL ================= */

const User = mongoose.model("User", userSchema);

export default User;
