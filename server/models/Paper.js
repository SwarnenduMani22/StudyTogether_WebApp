import mongoose from "mongoose";

const paperSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Paper title is required"],
      trim: true,
      maxlength: 200,
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
    },

    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: 1,
      max: 8,
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
    },

    views: {
      type: Number,
      default: 0,
    },

    downloads: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* ================= INDEXES ================= */

/* Text search */
paperSchema.index({ title: "text", subject: "text" });

/* Filter optimization */
paperSchema.index({ subject: 1 });
paperSchema.index({ semester: 1 });

/* Popular papers query */
paperSchema.index({ downloads: -1 });
paperSchema.index({ views: -1 });

/* ================= VIRTUAL FIELD ================= */

paperSchema.virtual("popularityScore").get(function () {
  return this.views + this.downloads * 2;
});

/* ================= SAFE RESPONSE ================= */

paperSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    title: this.title,
    subject: this.subject,
    semester: this.semester,
    pdfLink: this.pdfLink,
    views: this.views,
    downloads: this.downloads,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Paper", paperSchema);
