import mongoose from "mongoose";

const paperSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */

    title: {
      type: String,
      required: [true, "Paper title is required"],
      trim: true,
      maxlength: 200,
      index: true,
    },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      enum: [
        "Data Structure",
        "Operating System",
        "DBMS",
        "Computer Network",
        "Software Engineering",
        "Artificial Intelligence",
      ],
      index: true,
    },

    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: 1,
      max: 8,
      index: true,
    },

    pdfLink: {
      type: String,
      required: [true, "PDF link is required"],
      trim: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ================= ADMIN APPROVAL ================= */

    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
      index: true,
    },

    /* ================= ANALYTICS ================= */

    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    downloads: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ================= RATINGS ================= */

    ratings: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          value: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
          },
        },
      ],
      default: [],
    },

    /* ================= ACTIVE FLAG ================= */

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* ================= INDEXES ================= */

paperSchema.index({ title: "text", subject: "text" });

paperSchema.index({ subject: 1, semester: 1 });

paperSchema.index({ downloads: -1 });

paperSchema.index({ views: -1 });

paperSchema.index({ status: 1, isActive: 1 });

/* 🔥 UNIQUE INDEX (NO DUPLICATE PAPERS) */

paperSchema.index({ title: 1, subject: 1, semester: 1 }, { unique: true });

/* ================= VIRTUAL FIELDS ================= */

/* Popularity Score */

paperSchema.virtual("popularityScore").get(function () {
  const ratingScore = this.ratings?.length || 0;
  return this.views + this.downloads * 2 + ratingScore * 5;
});

/* Average Rating */

paperSchema.virtual("averageRating").get(function () {
  if (!this.ratings || this.ratings.length === 0) return 0;

  const sum = this.ratings.reduce((acc, r) => acc + r.value, 0);

  return Number((sum / this.ratings.length).toFixed(1));
});

/* ================= METHODS ================= */

/* ⭐ ONE USER = ONE RATING */

paperSchema.methods.addOrUpdateRating = function (userId, rating) {
  const existingRating = this.ratings.find(
    (r) => r.user.toString() === userId.toString(),
  );

  if (existingRating) {
    existingRating.value = rating;
  } else {
    this.ratings.push({
      user: userId,
      value: rating,
    });
  }
};

/* Safe API response */

paperSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    title: this.title,
    subject: this.subject,
    semester: this.semester,
    pdfLink: this.pdfLink,
    views: this.views,
    downloads: this.downloads,
    averageRating: this.averageRating,
    popularityScore: this.popularityScore,
    status: this.status,
    createdAt: this.createdAt,
  };
};

const Paper = mongoose.model("Paper", paperSchema);

export default Paper;
