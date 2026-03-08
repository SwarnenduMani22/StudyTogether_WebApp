import { useEffect, useState } from "react";
import { getTrendingPapers } from "../../api/paper";

import PaperCard from "./PaperCard";
import Skeleton from "../common/Skeleton";

const TrendingPapers = () => {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= FETCH TRENDING ================= */

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getTrendingPapers();

        const papersData = data?.papers || data || [];

        /* limit top papers */

        setPapers(Array.isArray(papersData) ? papersData.slice(0, 6) : []);
      } catch (err) {
        console.error("Trending load failed:", err);
        setError("Failed to load trending papers");
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      {/* ================= TITLE ================= */}

      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
          🔥 Trending Papers
        </h2>

        <p className="text-gray-500 mt-3">Most downloaded study materials</p>
      </div>

      {/* ================= LOADING ================= */}

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {/* ================= ERROR ================= */}

      {!loading && error && (
        <div className="text-center text-red-500 font-medium">{error}</div>
      )}

      {/* ================= EMPTY ================= */}

      {!loading && !error && papers.length === 0 && (
        <div className="text-center text-gray-500">
          No trending papers available.
        </div>
      )}

      {/* ================= PAPERS ================= */}

      {!loading && papers.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {papers.map((paper) => (
            <PaperCard key={paper._id} paper={paper} />
          ))}
        </div>
      )}
    </section>
  );
};

export default TrendingPapers;
