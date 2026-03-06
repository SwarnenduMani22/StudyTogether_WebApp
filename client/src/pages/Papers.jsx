import { useEffect, useState } from "react";
import { getPapers } from "../api/paper";
import PaperCard from "../components/PaperCard";
import Skeleton from "../components/Skeleton";

const Papers = () => {
  const [papers, setPapers] = useState([]);

  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("all");
  const [subject, setSubject] = useState("all");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= Fetch Papers ================= */

  const fetchPapers = async () => {
    try {
      setLoading(true);

      const res = await getPapers({
        page,
        search,
        semester,
        subject,
      });

      setPapers(res.data.papers);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      setError("Failed to load papers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, [page, search, semester, subject]);

  /* ================= Reset Page On Filter ================= */

  useEffect(() => {
    setPage(1);
  }, [search, semester, subject]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto fade-in">
        {/* Title */}

        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
          Study Papers 📚
        </h1>

        {/* ================= Filters ================= */}

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <input
            type="text"
            placeholder="Search papers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input md:w-64"
          />

          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="input md:w-48"
          >
            <option value="all">All Semester</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
          </select>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
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
        </div>

        {/* ================= Loading ================= */}

        {loading && (
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {/* ================= Error ================= */}

        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* ================= Empty ================= */}

        {!loading && papers.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No papers found.
          </p>
        )}

        {/* ================= Paper Grid ================= */}

        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!loading &&
            papers.map((paper) => <PaperCard key={paper._id} paper={paper} />)}
        </div>

        {/* ================= Pagination ================= */}

        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-10">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-4 py-2 rounded-md text-sm transition
                ${
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
