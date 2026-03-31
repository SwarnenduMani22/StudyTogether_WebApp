import { useCallback, useEffect, useState } from "react";
import { getPapers } from "../api/paper";

import PaperCard from "../components/papers/PaperCard";
import Skeleton from "../components/common/Skeleton";

const Papers = () => {
  const [papers, setPapers] = useState([]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [semester, setSemester] = useState("all");
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState("new");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= SEARCH DEBOUNCE ================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  /* ================= FETCH PAPERS ================= */

  const fetchPapers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getPapers({
        page,
        search: debouncedSearch.trim(),
        semester: semester === "all" ? "" : semester,
        subject: subject === "all" ? "" : subject,
        sort,
      });

      const papersData = data?.papers || [];

      setPapers(Array.isArray(papersData) ? papersData : []);
      setTotalPages(data?.totalPages || 1);
    } catch (err) {
      console.error(err);
      setError("Failed to load papers");
      setPapers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, semester, subject, sort]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  /* ================= SEARCH SUGGEST ================= */

  useEffect(() => {
    if (!search.trim()) return setSuggestions([]);

    const filtered = papers
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5);

    setSuggestions(filtered);
  }, [search, papers]);

  /* ================= DELETE REFRESH ================= */

  const handleDeleteRefresh = () => {
    fetchPapers();
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
          Study Papers 📚
        </h1>

        {/* FILTERS */}

        <div className="flex flex-col md:flex-row gap-4 mb-8 relative">
          {/* SEARCH */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search papers..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="input md:w-64"
            />

            {suggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-white dark:bg-gray-800 shadow-lg rounded mt-1">
                {suggestions.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      setSearch(item.title);
                      setSuggestions([]);
                    }}
                    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEM */}
          <select
            value={semester}
            onChange={(e) => {
              setPage(1);
              setSemester(e.target.value);
            }}
            className="input md:w-48"
          >
            <option value="all">All Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>

          {/* SUBJECT */}
          <select
            value={subject}
            onChange={(e) => {
              setPage(1);
              setSubject(e.target.value);
            }}
            className="input md:w-48"
          >
            <option value="all">All Subjects</option>
            <option value="Data Structure">Data Structure</option>
            <option value="Operating System">Operating System</option>
            <option value="DBMS">DBMS</option>
            <option value="Computer Network">Computer Network</option>
            <option value="Software Engineering">Software Engineering</option>
            <option value="Artificial Intelligence">
              Artificial Intelligence
            </option>
          </select>

          {/* SORT */}
          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
            className="input md:w-48"
          >
            <option value="new">Newest</option>
            <option value="views">Most Viewed</option>
            <option value="downloads">Most Downloaded</option>
          </select>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        )}

        {/* ERROR */}
        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* EMPTY */}
        {!loading && papers.length === 0 && !error && (
          <p className="text-center text-gray-500">No papers found</p>
        )}

        {/* GRID */}
        {!loading && papers.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6">
            {papers.map((paper) => (
              <PaperCard
                key={paper._id}
                paper={paper}
                onDelete={handleDeleteRefresh}
              />
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-10">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-4 py-2 rounded ${
                  page === i + 1
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Papers;
