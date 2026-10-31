import { useState, useEffect, useMemo } from "react";
import { getPapers } from "../api/paper";
import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";

import PaperCard from "../components/papers/PaperCard";
import Skeleton from "../components/common/Skeleton";

const Papers = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(false);

  const [semester, setSemester] = useState("all");
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState("new");

  /* ================= SEARCH DEBOUNCE ================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  /* ================= TANSTACK REACT QUERY ================= */

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey: ["papers", debouncedSearch, semester, subject, sort],
    queryFn: async ({ pageParam = 1 }) => {
      return await getPapers({
        page: pageParam,
        search: debouncedSearch.trim(),
        semester: semester === "all" ? "" : semester,
        subject: subject === "all" ? "" : subject,
        sort,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (pages.length < lastPage.totalPages) {
        return pages.length + 1;
      }
      return undefined;
    },
  });

  const papers = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.papers || []) : [];
  }, [data]);

  /* ================= SEARCH SUGGEST ================= */

  const suggestions = useMemo(() => {
    if (selectedSuggestion || !search.trim()) return [];

    return papers
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5);
  }, [papers, search, selectedSuggestion]);

  /* ================= DELETE REFRESH ================= */

  const handleDeleteRefresh = () => {
    refetch(); // Automatically invalidates cache and fetches fresh data
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
                setSearch(e.target.value);
                setSelectedSuggestion(false);
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
                      setSelectedSuggestion(true);
                    }}
                    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-800 dark:text-white"
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
            onChange={(e) => setSemester(e.target.value)}
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
            onChange={(e) => setSubject(e.target.value)}
            className="input md:w-48"
          >
            <option value="all">All Subjects</option>
            <option value="Data Structure">Data Structure</option>
            <option value="Operating System">Operating System</option>
            <option value="DBMS">DBMS</option>
            <option value="Computer Network">Computer Network</option>
            <option value="Software Engineering">Software Engineering</option>
            <option value="Artificial Intelligence">Artificial Intelligence</option>
          </select>

          {/* SORT */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input md:w-48"
          >
            <option value="new">Newest</option>
            <option value="views">Most Viewed</option>
            <option value="downloads">Most Downloaded</option>
          </select>
        </div>

        {/* LOADING SKELETON (Initial Load Only) */}
        {isLoading && (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl bg-gray-300 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        )}

        {/* ERROR */}
        {isError && <p className="text-red-500 text-center font-bold">Failed to load papers. Please try again later.</p>}

        {/* EMPTY */}
        {!isLoading && papers.length === 0 && !isError && (
          <p className="text-center text-gray-500 text-lg mt-10">No papers found</p>
        )}

        {/* INFINITE SCROLL GRID */}
        {!isLoading && papers.length > 0 && (
          <InfiniteScroll
            dataLength={papers.length}
            next={fetchNextPage}
            hasMore={hasNextPage}
            loader={
              <div className="flex justify-center my-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            }
            endMessage={
              <p className="text-center text-gray-500 mt-10">
                You have seen all papers! 🎉
              </p>
            }
          >
            <div className="grid md:grid-cols-3 gap-6 overflow-hidden p-2">
              {papers.map((paper) => (
                <PaperCard
                  key={paper._id}
                  paper={paper}
                  onDelete={handleDeleteRefresh}
                />
              ))}
            </div>
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
};

export default Papers;
