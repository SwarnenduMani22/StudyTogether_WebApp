export const KNOWLEDGE_BASE = {
  authentication: {
    title: "Authentication & Registration",
    keywords: ["register", "signup", "sign up", "auth", "account", "create account", "join"],
    content: "To register, go to the Sign Up page and enter your name, email, and a password containing at least 8 characters. The email must be a valid format and unique. Logins require your registered email and password."
  },
  login_logout: {
    title: "Login, Logout & Session Management",
    keywords: ["login", "signin", "sign in", "logout", "log out", "session", "cookies", "sign out"],
    content: "Authentication sessions are managed securely via JWT access tokens (expires in 15m) and secure HttpOnly SameSite refresh tokens (expires in 7 days). Logging out invalidates the refresh token on the server and clears local storage."
  },
  password_reset: {
    title: "Password Modification & Reset",
    keywords: ["reset password", "change password", "update password", "forgot password", "password reset"],
    content: "You can change your password inside the User Profile settings page. New passwords must be at least 8 characters. Changing your password automatically invalidates all other active refresh sessions for security."
  },
  user_profile: {
    title: "User Profile Management",
    keywords: ["profile", "change name", "avatar", "user details", "update details", "settings"],
    content: "Go to the Profile page to update your display name and change your password. You can also view your unlocked badges, current rank status, and stats summary."
  },
  upload_paper: {
    title: "Uploading Study Papers",
    keywords: ["upload", "submit paper", "add paper", "add file", "upload pdf"],
    content: "To upload a paper, click the 'Upload Paper' button. You must provide a title, select a subject, specify a semester (1 to 8), and choose a PDF file (max 5MB). Non-admin users are limited to 2 pending uploads at a time."
  },
  draft_papers: {
    title: "Saved Drafts Support",
    keywords: ["draft", "save draft", "edit draft", "my drafts", "unpublished"],
    content: "When uploading, you can choose 'Save Draft' instead of submitting. Drafts are not sent to moderators and do not count towards the 2 pending uploads limit. You can edit, delete, or publish drafts from the 'My Uploaded Papers' page."
  },
  edit_delete_paper: {
    title: "Editing & Deleting Papers",
    keywords: ["edit paper", "delete paper", "remove paper", "modify paper", "update paper"],
    content: "Authors and administrators can edit or delete papers from the 'My Uploaded Papers' page. Deleting a paper automatically triggers cascades that pull the paper from bookmarks and download lists across all users, and removes files from Cloudinary."
  },
  paper_approval: {
    title: "Moderation & Approval Workflow",
    keywords: ["approval", "approve", "reject", "moderation", "pending review", "status"],
    content: "Submissions enter a pending review queue. Admins inspect the PDF and approve or reject it. Approved papers award the owner +30 coins. Rejected papers are deleted along with their Cloudinary raw assets."
  },
  search_filters: {
    title: "Search & Filtering",
    keywords: ["search", "find", "filter", "subject", "semester", "full text search"],
    content: "The papers page uses MongoDB full-text indexing. You can search papers using keywords and filter results by specific subjects (e.g. Data Structure, DBMS, OS) or semesters (1-8)."
  },
  preview_download: {
    title: "Paper Previews & Downloads",
    keywords: ["preview", "download", "view paper", "get pdf", "download cost"],
    content: "Standard users spend 10 coins to preview a paper, and 40 coins to download a paper (reduced to 30 coins if you previewed first). Previews and downloads are free for admins, paper owners, and previously unlocked purchases."
  },
  coins_wallet: {
    title: "Coin Economy & Wallet",
    keywords: ["coins", "wallet", "buy coins", "balance", "transactions", "purchase"],
    content: "Earn +30 coins by getting papers approved. Spend coins to preview (10) or download (40) papers. You can buy coin packages on the Wallet page via our verified Razorpay checkout integrations. Refund requests are processed by admins."
  },
  razorpay: {
    title: "Razorpay Gateway Checkout",
    keywords: ["razorpay", "payment gateway", "checkout", "webhook", "verified checkout"],
    content: "Payments are processed securely via the Razorpay gateway. We use cryptographically signed webhooks to verify transactions before crediting balances to your account."
  },
  ratings_comments: {
    title: "Ratings & Comments",
    keywords: ["rate", "rating", "stars", "comment", "feedback", "delete comment"],
    content: "Users can rate papers (1 to 5 stars, one vote per paper) and post comments. Users can delete their own comments, and admins can moderate/delete any comment."
  },
  bookmarks: {
    title: "Bookmarks Collection",
    keywords: ["bookmark", "save paper", "collection", "my bookmarks", "favorite"],
    content: "Click the bookmark icon on any paper card to add it to your Bookmarks tab for easy reference. Bookmarking does not cost any coins."
  },
  leaderboard: {
    title: "Gamification & Leaderboard",
    keywords: ["leaderboard", "rank", "badges", "points", "best user", "top uploader", "streak"],
    content: "Ranks range from Beginner, Explorer, Scholar, Expert, to Legend based on coins and approved uploads. Daily streaks (3-day / 7-day) award active streaks badges automatically."
  },
  dashboard: {
    title: "Personal Dashboard & Stats",
    keywords: ["dashboard", "my stats", "contributions", "upload count"],
    content: "The Dashboard page displays user totals (approved/pending papers, uploads count) and quick shortcuts to uploading files and viewing study folders."
  },
  admin_features: {
    title: "Administrator Controls",
    keywords: ["admin controls", "refund user", "change roles", "system metrics", "moderation list"],
    content: "Admins have access to full system metrics, user roles management, moderation lists (with single and bulk approval/rejections), and coin refund workflows."
  },
  troubleshooting_errors: {
    title: "Common Errors & Troubleshooting",
    keywords: ["error", "pending upload", "failed", "limit reached", "out of coins", "cannot download"],
    content: "1. 'Upload limit reached': Regular users can only have 2 pending review papers at once. Save as draft instead. 2. 'Insufficient balance': Earn coins by uploading documents or purchase packages. 3. 'Connection timed out': Verify your internet connectivity."
  }
};

export const getPlatformResponse = (query) => {
  const q = query.toLowerCase();
  let bestMatch = null;
  let maxScore = 0;

  for (const key in KNOWLEDGE_BASE) {
    const article = KNOWLEDGE_BASE[key];
    let score = 0;

    article.keywords.forEach((keyword) => {
      if (q.includes(keyword)) {
        score += keyword.split(" ").length; // weight longer phrases heavier
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestMatch = article;
    }
  }

  if (bestMatch && maxScore > 0) {
    // calculate confidence based on number of matched terms
    const confidence = Math.min(0.5 + (maxScore * 0.1), 1.0);
    return {
      answer: bestMatch.content,
      confidence,
      title: bestMatch.title
    };
  }

  return {
    answer: "Welcome to StudyTogether Helpdesk! I can explain features like wallet transactions, Razorpay, uploading papers, draft files, bookmarks, leaderboards, and how to troubleshoot common issues. Could you rephrase your question?",
    confidence: 0.0,
    title: "General Help"
  };
};
